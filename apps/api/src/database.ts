import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  createEmptyProfile,
  normalizeProfile,
  normalizeQuestion,
  type ApplicantProfile,
  type LearnedAnswer,
  type LearnedAnswerInput,
  type LearnedAnswerMatch,
  type LearnedQuestionCandidate
} from "@application-copilot/shared";

interface LearnedAnswerRow {
  id: number;
  question: string;
  normalized_question: string;
  answer: string;
  control_type: LearnedAnswer["controlType"];
  created_at: string;
  updated_at: string;
}

export interface ApplicationRepository {
  getProfile(): ApplicantProfile;
  saveProfile(profile: ApplicantProfile): ApplicantProfile;
  listLearnedAnswers(): LearnedAnswer[];
  saveLearnedAnswer(input: LearnedAnswerInput): LearnedAnswer;
  matchLearnedAnswers(candidates: LearnedQuestionCandidate[]): LearnedAnswerMatch[];
  deleteLearnedAnswer(id: number): boolean;
  close(): void;
}

function mapLearnedAnswer(row: LearnedAnswerRow): LearnedAnswer {
  return {
    id: row.id,
    question: row.question,
    normalizedQuestion: row.normalized_question,
    answer: row.answer,
    controlType: row.control_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createApplicationRepository(databasePath: string): ApplicationRepository {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      profile_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learned_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      normalized_question TEXT NOT NULL UNIQUE,
      answer TEXT NOT NULL,
      control_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const findProfile = database.prepare("SELECT profile_json FROM profiles WHERE id = 1");
  const upsertProfile = database.prepare(`
    INSERT INTO profiles (id, profile_json, updated_at)
    VALUES (1, @profileJson, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      profile_json = excluded.profile_json,
      updated_at = excluded.updated_at
  `);
  const answerColumns = `
    id, question, normalized_question, answer, control_type, created_at, updated_at
  `;
  const findAnswer = database.prepare(`
    SELECT ${answerColumns}
    FROM learned_answers
    WHERE normalized_question = ?
  `);
  const listAnswers = database.prepare(`
    SELECT ${answerColumns}
    FROM learned_answers
    ORDER BY updated_at DESC, id DESC
  `);
  const upsertAnswer = database.prepare(`
    INSERT INTO learned_answers (
      question, normalized_question, answer, control_type, created_at, updated_at
    )
    VALUES (
      @question, @normalizedQuestion, @answer, @controlType, @createdAt, @updatedAt
    )
    ON CONFLICT(normalized_question) DO UPDATE SET
      question = excluded.question,
      answer = excluded.answer,
      control_type = excluded.control_type,
      updated_at = excluded.updated_at
  `);
  const deleteAnswer = database.prepare("DELETE FROM learned_answers WHERE id = ?");

  return {
    getProfile() {
      const row = findProfile.get() as { profile_json: string } | undefined;
      if (!row) return createEmptyProfile();
      return normalizeProfile(JSON.parse(row.profile_json) as ApplicantProfile);
    },
    saveProfile(input) {
      const profile = normalizeProfile(input);
      profile.updatedAt = new Date().toISOString();
      upsertProfile.run({ profileJson: JSON.stringify(profile), updatedAt: profile.updatedAt });
      return profile;
    },
    listLearnedAnswers() {
      return (listAnswers.all() as LearnedAnswerRow[]).map(mapLearnedAnswer);
    },
    saveLearnedAnswer(input) {
      const normalizedQuestion = normalizeQuestion(input.question);
      const timestamp = new Date().toISOString();
      upsertAnswer.run({
        question: input.question.trim(),
        normalizedQuestion,
        answer: input.answer.trim(),
        controlType: input.controlType,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      return mapLearnedAnswer(findAnswer.get(normalizedQuestion) as LearnedAnswerRow);
    },
    matchLearnedAnswers(candidates) {
      return candidates.map((candidate) => {
        const row = findAnswer.get(normalizeQuestion(candidate.question)) as LearnedAnswerRow | undefined;
        return {
          fieldId: candidate.fieldId,
          learnedAnswer: row ? mapLearnedAnswer(row) : null
        };
      });
    },
    deleteLearnedAnswer(id) {
      return deleteAnswer.run(id).changes > 0;
    },
    close() {
      database.close();
    }
  };
}

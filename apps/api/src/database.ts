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
  embedding_json: string | null;
  embedding_model: string | null;
}

export interface StoredLearnedAnswer extends LearnedAnswer {
  embedding: number[] | null;
  embeddingModel: string | null;
}

export interface StoredEmbedding {
  vector: number[];
  model: string;
}

export interface ApplicationRepository {
  getProfile(): ApplicantProfile;
  saveProfile(profile: ApplicantProfile): ApplicantProfile;
  listLearnedAnswers(): LearnedAnswer[];
  listStoredLearnedAnswers(): StoredLearnedAnswer[];
  saveLearnedAnswer(input: LearnedAnswerInput, embedding?: StoredEmbedding): LearnedAnswer;
  updateLearnedAnswerEmbedding(id: number, embedding: StoredEmbedding): void;
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

function mapStoredLearnedAnswer(row: LearnedAnswerRow): StoredLearnedAnswer {
  return {
    ...mapLearnedAnswer(row),
    embedding: row.embedding_json ? JSON.parse(row.embedding_json) as number[] : null,
    embeddingModel: row.embedding_model
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
      updated_at TEXT NOT NULL,
      embedding_json TEXT,
      embedding_model TEXT
    );
  `);

  const learnedAnswerColumns = database
    .prepare("PRAGMA table_info(learned_answers)")
    .all() as Array<{ name: string }>;
  const learnedAnswerColumnNames = new Set(learnedAnswerColumns.map((column) => column.name));
  if (!learnedAnswerColumnNames.has("embedding_json")) {
    database.exec("ALTER TABLE learned_answers ADD COLUMN embedding_json TEXT");
  }
  if (!learnedAnswerColumnNames.has("embedding_model")) {
    database.exec("ALTER TABLE learned_answers ADD COLUMN embedding_model TEXT");
  }

  const findProfile = database.prepare("SELECT profile_json FROM profiles WHERE id = 1");
  const upsertProfile = database.prepare(`
    INSERT INTO profiles (id, profile_json, updated_at)
    VALUES (1, @profileJson, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      profile_json = excluded.profile_json,
      updated_at = excluded.updated_at
  `);
  const answerColumns = `
    id, question, normalized_question, answer, control_type, created_at, updated_at,
    embedding_json, embedding_model
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
      question, normalized_question, answer, control_type, created_at, updated_at,
      embedding_json, embedding_model
    )
    VALUES (
      @question, @normalizedQuestion, @answer, @controlType, @createdAt, @updatedAt,
      @embeddingJson, @embeddingModel
    )
    ON CONFLICT(normalized_question) DO UPDATE SET
      question = excluded.question,
      answer = excluded.answer,
      control_type = excluded.control_type,
      updated_at = excluded.updated_at,
      embedding_json = COALESCE(excluded.embedding_json, learned_answers.embedding_json),
      embedding_model = COALESCE(excluded.embedding_model, learned_answers.embedding_model)
  `);
  const updateAnswerEmbedding = database.prepare(`
    UPDATE learned_answers
    SET embedding_json = @embeddingJson, embedding_model = @embeddingModel
    WHERE id = @id
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
    listStoredLearnedAnswers() {
      return (listAnswers.all() as LearnedAnswerRow[]).map(mapStoredLearnedAnswer);
    },
    saveLearnedAnswer(input, embedding) {
      const normalizedQuestion = normalizeQuestion(input.question);
      const timestamp = new Date().toISOString();
      upsertAnswer.run({
        question: input.question.trim(),
        normalizedQuestion,
        answer: input.answer.trim(),
        controlType: input.controlType,
        createdAt: timestamp,
        updatedAt: timestamp,
        embeddingJson: embedding ? JSON.stringify(embedding.vector) : null,
        embeddingModel: embedding?.model ?? null
      });
      return mapLearnedAnswer(findAnswer.get(normalizedQuestion) as LearnedAnswerRow);
    },
    updateLearnedAnswerEmbedding(id, embedding) {
      updateAnswerEmbedding.run({
        id,
        embeddingJson: JSON.stringify(embedding.vector),
        embeddingModel: embedding.model
      });
    },
    matchLearnedAnswers(candidates) {
      return candidates.map((candidate) => {
        const row = findAnswer.get(normalizeQuestion(candidate.question)) as LearnedAnswerRow | undefined;
        return {
          fieldId: candidate.fieldId,
          learnedAnswer: row ? mapLearnedAnswer(row) : null,
          matchKind: row ? "exact" : "none",
          similarity: null
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

import type {
  DetectedControlType,
  LearnedAnswer,
  LearnedAnswerInput,
  LearnedAnswerMatch,
  LearnedQuestionCandidate,
  SemanticMatchingStatus
} from "@application-copilot/shared";
import type { ApplicationRepository, StoredLearnedAnswer } from "./database.js";
import { cosineSimilarity, type EmbeddingProvider } from "./embeddings.js";

export const AUTOMATIC_MATCH_THRESHOLD = 0.9;
export const SUGGESTION_THRESHOLD = 0.7;

export interface AnswerMatchingService {
  getStatus(): SemanticMatchingStatus;
  saveAnswer(input: LearnedAnswerInput): Promise<LearnedAnswer>;
  matchAnswers(candidates: LearnedQuestionCandidate[]): Promise<LearnedAnswerMatch[]>;
}

function controlFamily(controlType: DetectedControlType): string {
  if (["select", "radio", "checkbox"].includes(controlType)) return "choice";
  if (["text", "textarea"].includes(controlType)) return "written";
  return controlType;
}

function controlsAreCompatible(
  candidate: DetectedControlType,
  stored: DetectedControlType
): boolean {
  return controlFamily(candidate) === controlFamily(stored);
}

export function createAnswerMatchingService(
  repository: ApplicationRepository,
  embeddingProvider: EmbeddingProvider | null
): AnswerMatchingService {
  return {
    getStatus() {
      return {
        enabled: Boolean(embeddingProvider),
        model: embeddingProvider?.model ?? null,
        automaticMatchThreshold: AUTOMATIC_MATCH_THRESHOLD,
        suggestionThreshold: SUGGESTION_THRESHOLD
      };
    },

    async saveAnswer(input) {
      if (!embeddingProvider) return repository.saveLearnedAnswer(input);

      try {
        const [vector] = await embeddingProvider.embed([input.question]);
        if (!vector) return repository.saveLearnedAnswer(input);
        return repository.saveLearnedAnswer(input, { vector, model: embeddingProvider.model });
      } catch (error) {
        console.warn("Embedding creation failed; saving the exact answer without an embedding.", error);
        return repository.saveLearnedAnswer(input);
      }
    },

    async matchAnswers(candidates) {
      const exactMatches = repository.matchLearnedAnswers(candidates);
      if (!embeddingProvider) return exactMatches;

      const unmatched = candidates.filter((candidate) =>
        exactMatches.some((match) => match.fieldId === candidate.fieldId && match.matchKind === "none")
      );
      if (!unmatched.length) return exactMatches;

      try {
        let storedAnswers = repository.listStoredLearnedAnswers();
        if (!storedAnswers.length) return exactMatches;

        const missingEmbeddings = storedAnswers.filter((answer) =>
          !answer.embedding || answer.embeddingModel !== embeddingProvider.model
        );
        if (missingEmbeddings.length) {
          const vectors = await embeddingProvider.embed(
            missingEmbeddings.map((answer) => answer.question)
          );
          missingEmbeddings.forEach((answer, index) => {
            const vector = vectors[index];
            if (vector) {
              repository.updateLearnedAnswerEmbedding(answer.id, {
                vector,
                model: embeddingProvider.model
              });
            }
          });
          storedAnswers = repository.listStoredLearnedAnswers();
        }

        const candidateVectors = await embeddingProvider.embed(
          unmatched.map((candidate) => candidate.question)
        );
        const semanticMatches = new Map<string, LearnedAnswerMatch>();

        unmatched.forEach((candidate, index) => {
          const candidateVector = candidateVectors[index];
          const compatibleAnswers = storedAnswers.filter((answer) =>
            answer.embedding &&
            answer.embeddingModel === embeddingProvider.model &&
            controlsAreCompatible(candidate.controlType, answer.controlType)
          );
          const best = findBestMatch(candidateVector, compatibleAnswers);

          if (!best || best.similarity < SUGGESTION_THRESHOLD) {
            semanticMatches.set(candidate.fieldId, {
              fieldId: candidate.fieldId,
              learnedAnswer: null,
              matchKind: "none",
              similarity: best?.similarity ?? null
            });
            return;
          }

          semanticMatches.set(candidate.fieldId, {
            fieldId: candidate.fieldId,
            learnedAnswer: best.answer,
            matchKind: best.similarity >= AUTOMATIC_MATCH_THRESHOLD ? "semantic" : "suggestion",
            similarity: best.similarity
          });
        });

        return exactMatches.map((match) =>
          match.matchKind === "exact" ? match : semanticMatches.get(match.fieldId) ?? match
        );
      } catch (error) {
        console.warn("Semantic matching failed; falling back to exact matching.", error);
        return exactMatches;
      }
    }
  };
}

function findBestMatch(
  candidateVector: number[] | undefined,
  answers: StoredLearnedAnswer[]
): { answer: LearnedAnswer; similarity: number } | null {
  if (!candidateVector) return null;

  let best: { answer: LearnedAnswer; similarity: number } | null = null;
  for (const answer of answers) {
    if (!answer.embedding) continue;
    const similarity = cosineSimilarity(candidateVector, answer.embedding);
    if (!best || similarity > best.similarity) {
      const { embedding: _embedding, embeddingModel: _embeddingModel, ...publicAnswer } = answer;
      best = { answer: publicAnswer, similarity };
    }
  }
  return best;
}

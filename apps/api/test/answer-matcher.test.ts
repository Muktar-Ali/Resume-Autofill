import assert from "node:assert/strict";
import test from "node:test";
import { createAnswerMatchingService } from "../src/answer-matcher.js";
import { createApplicationRepository } from "../src/database.js";
import type { EmbeddingProvider } from "../src/embeddings.js";

const vectors: Record<string, number[]> = {
  "Are you willing to relocate?": [1, 0],
  "Would you be open to moving for this position?": [0.95, Math.sqrt(1 - 0.95 ** 2)],
  "Can you move closer to the office?": [0.71, Math.sqrt(1 - 0.71 ** 2)],
  "What is your favorite programming language?": [0, 1]
};

const fakeProvider: EmbeddingProvider = {
  model: "test-embedding-model",
  async embed(inputs) {
    return inputs.map((input) => vectors[input] ?? [0, 1]);
  }
};

test("semantic matching separates automatic, suggested, and unrelated questions", async () => {
  const repository = createApplicationRepository(":memory:");
  const matcher = createAnswerMatchingService(repository, fakeProvider);

  try {
    const saved = await matcher.saveAnswer({
      question: "Are you willing to relocate?",
      answer: "yes",
      controlType: "select"
    });

    const matches = await matcher.matchAnswers([
      {
        fieldId: "exact",
        question: "ARE YOU WILLING TO RELOCATE!",
        controlType: "radio"
      },
      {
        fieldId: "strong",
        question: "Would you be open to moving for this position?",
        controlType: "radio"
      },
      {
        fieldId: "review",
        question: "Can you move closer to the office?",
        controlType: "select"
      },
      {
        fieldId: "unrelated",
        question: "What is your favorite programming language?",
        controlType: "select"
      }
    ]);

    assert.equal(matches.find((match) => match.fieldId === "exact")?.matchKind, "exact");
    assert.equal(matches.find((match) => match.fieldId === "strong")?.matchKind, "semantic");
    assert.equal(matches.find((match) => match.fieldId === "strong")?.learnedAnswer?.id, saved.id);
    assert.equal(
      "embedding" in (matches.find((match) => match.fieldId === "strong")?.learnedAnswer ?? {}),
      false
    );
    assert.equal(matches.find((match) => match.fieldId === "review")?.matchKind, "suggestion");
    assert.equal(matches.find((match) => match.fieldId === "unrelated")?.matchKind, "none");
  } finally {
    repository.close();
  }
});

test("semantic matching excludes incompatible control families", async () => {
  const repository = createApplicationRepository(":memory:");
  const matcher = createAnswerMatchingService(repository, fakeProvider);

  try {
    await matcher.saveAnswer({
      question: "Are you willing to relocate?",
      answer: "yes",
      controlType: "select"
    });
    const [match] = await matcher.matchAnswers([{
      fieldId: "written",
      question: "Would you be open to moving for this position?",
      controlType: "textarea"
    }]);

    assert.equal(match.matchKind, "none");
    assert.equal(match.learnedAnswer, null);
  } finally {
    repository.close();
  }
});

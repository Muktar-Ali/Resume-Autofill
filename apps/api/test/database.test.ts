import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProfile } from "@application-copilot/shared";
import { createApplicationRepository } from "../src/database.js";

test("a profile survives a SQLite save and reload", () => {
  const repository = createApplicationRepository(":memory:");
  const profile = createEmptyProfile();
  profile.personal.firstName = "Jordan";
  profile.personal.email = "jordan@example.com";

  const saved = repository.saveProfile(profile);
  const loaded = repository.getProfile();

  assert.ok(saved.updatedAt);
  assert.equal(loaded.personal.firstName, "Jordan");
  assert.equal(loaded.personal.email, "jordan@example.com");
  assert.equal(loaded.links.github, "");
  repository.close();
});

test("learned answers are normalized, updated, matched, listed, and deleted", () => {
  const repository = createApplicationRepository(":memory:");

  const first = repository.saveLearnedAnswer({
    question: "Are you willing to relocate?",
    answer: "Yes",
    controlType: "select"
  });
  const updated = repository.saveLearnedAnswer({
    question: "ARE YOU WILLING TO RELOCATE",
    answer: "No",
    controlType: "radio"
  });
  const [match] = repository.matchLearnedAnswers([
    { fieldId: "relocation", question: "Are you willing to relocate!", controlType: "radio" }
  ]);

  assert.equal(updated.id, first.id);
  assert.equal(repository.listLearnedAnswers().length, 1);
  assert.equal(match.learnedAnswer?.answer, "No");
  assert.equal(repository.deleteLearnedAnswer(first.id), true);
  assert.equal(repository.listLearnedAnswers().length, 0);
  repository.close();
});

import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProfile, type DetectedField, type LearnedAnswer } from "@application-copilot/shared";
import {
  applyLearnedAnswer,
  createFieldPreview,
  isDraftPrompt,
  matchProfilePath,
  normalizeFieldLabel
} from "../src/matching/field-matcher";

function field(label: string, controlType: DetectedField["controlType"] = "text"): DetectedField {
  return {
    fieldId: label,
    label,
    controlType,
    name: "",
    required: false,
    options: [],
    locator: { id: "", name: "", domIndex: 0 }
  };
}

test("normalizes punctuation, casing, and required markers", () => {
  assert.equal(normalizeFieldLabel("  FIRST Name:*  "), "first name");
});

test("matches common application labels to conservative profile paths", () => {
  assert.equal(matchProfilePath("Given name"), "personal.firstName");
  assert.equal(matchProfilePath("LinkedIn Profile URL"), "links.linkedin");
  assert.equal(matchProfilePath("Are you legally authorized to work in the US?"), "work.authorizedToWork");
  assert.equal(matchProfilePath("Why do you want to work here?"), null);
});

test("reports whether a recognized field has a saved profile value", () => {
  const profile = createEmptyProfile();
  profile.personal.email = "applicant@example.com";

  const preview = createFieldPreview(field("Email address", "email"), profile);

  assert.equal(preview.classification, "recognized");
  assert.equal(preview.profilePath, "personal.email");
  assert.equal(preview.hasSavedValue, true);
});

test("excludes passwords and separates job-specific draft prompts", () => {
  assert.equal(createFieldPreview(field("Account password", "password"), null).classification, "excluded");
  assert.equal(isDraftPrompt("Why do you want to work here?"), true);
  assert.equal(createFieldPreview(field("Why this company?", "textarea"), null).classification, "draft");
});

test("promotes an exact unknown match to a learned field", () => {
  const preview = createFieldPreview(field("Are you willing to relocate?", "select"), null);
  const learnedAnswer: LearnedAnswer = {
    id: 1,
    question: "Are you willing to relocate?",
    normalizedQuestion: "are you willing to relocate",
    answer: "yes",
    controlType: "select",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z"
  };

  const learned = applyLearnedAnswer(preview, learnedAnswer);

  assert.equal(preview.classification, "unknown");
  assert.equal(learned.classification, "learned");
  assert.equal(learned.learnedAnswer?.answer, "yes");
});

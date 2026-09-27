import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProfile, type DetectedField } from "@application-copilot/shared";
import { createFieldPreview, matchProfilePath, normalizeFieldLabel } from "../src/matching/field-matcher";

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

test("excludes passwords and leaves essay prompts unknown", () => {
  assert.equal(createFieldPreview(field("Account password", "password"), null).classification, "excluded");
  assert.equal(createFieldPreview(field("Why this company?", "textarea"), null).classification, "unknown");
});

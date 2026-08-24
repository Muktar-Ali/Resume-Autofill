import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProfile } from "@application-copilot/shared";
import { createProfileRepository } from "../src/database.js";

test("a profile survives a SQLite save and reload", () => {
  const repository = createProfileRepository(":memory:");
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

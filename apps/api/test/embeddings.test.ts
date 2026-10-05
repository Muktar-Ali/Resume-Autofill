import assert from "node:assert/strict";
import test from "node:test";
import { cosineSimilarity } from "../src/embeddings.js";

test("cosine similarity measures vector direction and handles invalid inputs", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0.8, 0.6]) - 0.8) < 0.000001);
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
});

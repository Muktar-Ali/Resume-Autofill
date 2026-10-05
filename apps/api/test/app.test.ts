import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createRequestHandler } from "../src/app.js";
import { createApplicationRepository } from "../src/database.js";

test("learned-answer API saves, matches, lists, validates, and deletes", async () => {
  const repository = createApplicationRepository(":memory:");
  const server = createServer(createRequestHandler(repository));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const createResponse = await fetch(`${baseUrl}/api/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Are you willing to relocate?",
        answer: "yes",
        controlType: "select"
      })
    });
    const created = await createResponse.json() as { id: number; answer: string };

    assert.equal(createResponse.status, 201);
    assert.equal(created.answer, "yes");

    const matchResponse = await fetch(`${baseUrl}/api/answers/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: [{
          fieldId: "relocation",
          question: "ARE YOU WILLING TO RELOCATE!",
          controlType: "radio"
        }]
      })
    });
    const matches = await matchResponse.json() as Array<{ learnedAnswer: { id: number } | null }>;
    assert.equal(matches[0].learnedAnswer?.id, created.id);

    const listResponse = await fetch(`${baseUrl}/api/answers`);
    const list = await listResponse.json() as unknown[];
    assert.equal(list.length, 1);

    const invalidResponse = await fetch(`${baseUrl}/api/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Password", answer: "secret", controlType: "password" })
    });
    assert.equal(invalidResponse.status, 400);

    const deleteResponse = await fetch(`${baseUrl}/api/answers/${created.id}`, { method: "DELETE" });
    assert.equal(deleteResponse.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
    repository.close();
  }
});

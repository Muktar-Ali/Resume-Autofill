import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { FieldFillInstruction } from "@application-copilot/shared";
import { fillApplicationFields } from "../src/content/fill-fields";

function instruction(
  fieldId: string,
  controlType: FieldFillInstruction["controlType"],
  value: string,
  locator: FieldFillInstruction["locator"]
): FieldFillInstruction {
  return { fieldId, label: fieldId, controlType, value, locator };
}

test("fills empty controls, preserves existing values, and never submits", () => {
  const dom = new JSDOM(`
    <form id="application">
      <input id="first" name="first_name">
      <input id="email" name="email" value="existing@example.com">
      <select id="country" name="country">
        <option value="">Choose one</option>
        <option value="US">United States</option>
      </select>
      <fieldset>
        <legend>Authorized?</legend>
        <label><input type="radio" name="authorized" value="yes"> Yes</label>
        <label><input type="radio" name="authorized" value="no"> No</label>
      </fieldset>
      <input id="password" type="password">
      <button type="submit">Submit</button>
    </form>
  `, { url: "https://example.test/jobs/1" });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;

  let firstNameEvents = 0;
  let submissions = 0;
  document.querySelector("#first")?.addEventListener("input", () => firstNameEvents++);
  document.querySelector("#first")?.addEventListener("change", () => firstNameEvents++);
  document.querySelector("#application")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submissions++;
  });

  const results = fillApplicationFields([
    instruction("first", "text", "Jordan", { id: "first", name: "first_name", domIndex: 0 }),
    instruction("email", "email", "new@example.com", { id: "email", name: "email", domIndex: 1 }),
    instruction("country", "select", "United States", { id: "country", name: "country", domIndex: 2 }),
    instruction("authorized", "radio", "yes", { id: "", name: "authorized", domIndex: 3 }),
    instruction("password", "password", "never-fill", { id: "password", name: "", domIndex: 5 })
  ]);

  assert.equal((document.querySelector("#first") as HTMLInputElement).value, "Jordan");
  assert.equal((document.querySelector("#email") as HTMLInputElement).value, "existing@example.com");
  assert.equal((document.querySelector("#country") as HTMLSelectElement).value, "US");
  assert.equal((document.querySelector('input[name="authorized"][value="yes"]') as HTMLInputElement).checked, true);
  assert.equal((document.querySelector("#password") as HTMLInputElement).value, "");
  assert.equal(firstNameEvents, 2);
  assert.equal(submissions, 0);
  assert.deepEqual(results.map((result) => result.status), [
    "filled",
    "skipped-nonempty",
    "filled",
    "filled",
    "unsupported"
  ]);

  dom.window.close();
});

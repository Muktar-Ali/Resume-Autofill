import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { scanApplicationPage } from "../src/content/detect-fields";

function installDom(html: string) {
  const dom = new JSDOM(html, { url: "https://example.test/jobs/1" });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  return dom;
}

test("extracts accessible labels and skips hidden or disabled controls", () => {
  const dom = installDom(`
    <form>
      <label for="first">First name *</label><input id="first" name="given_name" required>
      <input name="email" type="email" aria-label="Email address">
      <fieldset>
        <legend>Are you authorized to work?</legend>
        <label><input type="radio" name="authorized" value="yes"> Yes</label>
        <label><input type="radio" name="authorized" value="no"> No</label>
      </fieldset>
      <label>Country<select name="country"><option value="US">United States</option></select></label>
      <textarea placeholder="Why this company?"></textarea>
      <input type="file" aria-label="Upload résumé">
      <input type="password" aria-label="Account password">
      <input type="hidden" name="tracking_code">
      <input disabled aria-label="Disabled field">
    </form>
  `);

  const fields = scanApplicationPage();

  assert.equal(fields.length, 7);
  assert.equal(fields[0].label, "First name");
  assert.equal(fields[0].required, true);
  assert.equal(fields[1].label, "Email address");
  assert.equal(fields[2].label, "Are you authorized to work?");
  assert.deepEqual(fields[2].options, [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" }
  ]);
  assert.equal(fields.some((item) => item.name === "tracking_code"), false);
  assert.equal(fields.some((item) => item.label === "Disabled field"), false);

  dom.window.close();
});

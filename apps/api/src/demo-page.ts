export const demoApplicationPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Application Copilot · Detection Demo</title>
    <style>
      :root { font-family: system-ui, sans-serif; color: #17231d; background: #f5f2eb; }
      body { max-width: 760px; margin: 0 auto; padding: 48px 24px 96px; }
      h1 { font-family: Georgia, serif; font-size: 42px; font-weight: 500; margin-bottom: 8px; }
      .intro { color: #5d6862; line-height: 1.5; }
      form { display: grid; gap: 22px; margin-top: 36px; padding: 28px; background: white; border: 1px solid #d6d9d4; border-radius: 16px; }
      label, fieldset { display: grid; gap: 7px; font-weight: 700; }
      input, select, textarea { border: 1px solid #bfc7c1; border-radius: 8px; padding: 11px; font: inherit; }
      fieldset { border: 1px solid #d6d9d4; border-radius: 10px; padding: 16px; }
      fieldset label { display: flex; align-items: center; font-weight: 400; }
      fieldset input { width: auto; }
      button { border: 0; border-radius: 9px; padding: 12px; background: #1f6a4a; color: white; font: inherit; font-weight: 700; }
    </style>
  </head>
  <body>
    <p>SAFE LOCAL TEST PAGE</p>
    <h1>Sample job application</h1>
    <p class="intro">This form exists only to test Application Copilot's read-only field detector. The submit button does nothing.</p>
    <form onsubmit="event.preventDefault()">
      <label for="first-name">First name *</label>
      <input id="first-name" name="given_name" required />

      <label>Last name <input name="family_name" /></label>

      <input name="contact_email" type="email" aria-label="Email address" />
      <input name="phone" type="tel" placeholder="Phone number" />

      <label for="country">Country of residence</label>
      <select id="country" name="country">
        <option value="">Choose a country</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
      </select>

      <label for="linkedin">LinkedIn profile URL</label>
      <input id="linkedin" name="linkedin_url" type="url" />

      <fieldset>
        <legend>Are you legally authorized to work in the United States?</legend>
        <label><input type="radio" name="authorized" value="yes" /> Yes</label>
        <label><input type="radio" name="authorized" value="no" /> No</label>
      </fieldset>

      <label for="relocation">Are you willing to relocate?</label>
      <select id="relocation" name="relocation">
        <option value="">Choose an answer</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>

      <label for="motivation">Why do you want to work here?</label>
      <textarea id="motivation" name="motivation"></textarea>

      <label for="resume">Upload résumé</label>
      <input id="resume" name="resume" type="file" />

      <label for="account-password">Application account password</label>
      <input id="account-password" name="password" type="password" />

      <input type="hidden" name="internal_tracking_code" value="not-detected" />
      <button type="submit">Submit disabled demo</button>
    </form>
  </body>
</html>`;

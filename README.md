# Application Copilot

Application Copilot is a local-first Chrome extension that helps applicants reuse common information, remember answers to application questions, and prepare editable AI drafts for job-specific prompts.

## Current architecture

```text
React Chrome extension → Node API at 127.0.0.1:4318 → SQLite database
```

The repository is an npm workspace:

```text
apps/
  extension/   React + TypeScript + Vite Chrome extension
  api/         Node + TypeScript HTTP API
packages/
  shared/      Profile types, defaults, and normalization
data/          Local SQLite database (ignored by Git)
```

## Run the current version

Dependencies are already installed. From the project root, build the extension:

```bash
npm run build
```

Keep the local API running in a terminal while using the extension:

```bash
npm run dev:api
```

The API should print:

```text
Application Copilot API running at http://127.0.0.1:4318
Semantic matching: disabled (add OPENAI_API_KEY to the root .env file)
```

Semantic question matching is optional. To enable it, copy `.env.example` to `.env`, add your own OpenAI API key to `.env`, and restart the API. The key remains in the ignored local `.env` file and is used only by the Node backend; it is never bundled into the Chrome extension.

Then install the compiled extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Remove the earlier vanilla prototype if it is still listed.
4. Select **Load unpacked**.
5. Choose `apps/extension/dist` inside this repository.
6. Open Application Copilot and select **Set up profile**.
7. Save a test profile, close the page, and reopen it to verify persistence.

## Test field detection

With the local API running, open the safe demo application:

```text
http://127.0.0.1:4318/demo
```

Then:

1. Return to `chrome://extensions` and reload Application Copilot after each new build.
2. Open the demo application in a regular tab.
3. Click the Application Copilot extension icon.
4. Select **Scan this page**.
5. Confirm the preview reports 11 fields: 7 profile fields, 1 unknown relocation question, 1 draft prompt, 1 unsupported upload, and 1 excluded password.
6. Choose an answer for **Are you willing to relocate?** and select **Save answer**.
7. Confirm the card changes from **Unknown** to **Learned**.
8. Review the checked profile and learned fields and select **Fill selected fields**.
9. Refresh the demo, scan again, and confirm the relocation answer is remembered.

## Test semantic matching

First save an answer to **Are you willing to relocate?** on `http://127.0.0.1:4318/demo`. With semantic matching enabled, open:

```text
http://127.0.0.1:4318/demo-semantic
```

The alternate page asks **Would you be open to moving for this position?** Scan it and inspect the match. A strong match is marked **Learned**. A medium-confidence match is marked **Confirm match** and stays unselectable until you choose **Use answer**. Choosing **Not the same** returns it to the normal unknown-answer workflow.

The scanner reads field structure only: labels, control types, names, required status, and available dropdown/radio options. It does not read entered values. Filling is a separate user-triggered action that skips existing values, file uploads, passwords, unknown questions, and form submission.

After changing extension code, run `npm run build` again and press the reload button for the extension on `chrome://extensions`. The Node API automatically restarts when its source changes.

## Useful checks

```bash
npm run typecheck
npm test
npm run build
```

## Persistence

The profile is saved in `data/application-copilot.db`. The extension itself keeps no personal profile data now; it makes requests to the local Node API. The database file is ignored by Git so personal information cannot be accidentally committed.

The SQLite schema contains a singleton `profiles` record with:

- A versioned JSON profile document.
- An update timestamp.

JSON is used for the singleton profile to keep the proven profile model intact. Employment history, question aliases, applications, and AI drafts will receive dedicated relational tables as those features are implemented.

Reusable unfamiliar questions are stored separately in `learned_answers`. Each record contains the original question, a normalized unique question, the approved answer, its control type, timestamps, and optional embedding data. Exact matching remains deterministic and runs first. When semantic matching is enabled, the backend embeds differently worded questions, compares them with cosine similarity, automatically accepts scores of 0.90 or higher, requests confirmation from 0.70 through 0.89, and leaves lower scores unknown. These initial thresholds should be tuned with real application examples.

## Current security boundary

- The API binds to `127.0.0.1`, so it is not exposed to the local network.
- Browser access is allowed for Chrome-extension pages and the local development UI.
- The extension uses `activeTab` to inspect a page only after the user clicks **Scan this page**.
- The scanner does not receive permanent access to every website.
- Autofill sends only user-selected profile values to the active page and never submits the form.
- Without `OPENAI_API_KEY`, no data is transmitted to an AI provider and exact matching continues to work.
- With semantic matching enabled, question labels are sent to OpenAI to create embeddings. Profile values and saved answers are not sent for semantic matching.
- The OpenAI API key exists only in the backend environment and is never returned by the API or included in extension files.
- Nothing submits applications automatically.

Before distributing the extension, the local API will need extension authentication. The current origin check is appropriate for local development but does not prevent another installed extension from calling the API.

## Planned milestones

1. React/Node/SQLite transition — **complete**
2. Page-field detection and preview — **complete**
3. Standard-field autofill — **complete**
4. Exact learned-answer memory — **complete**
5. Similar-question matching — **current**
6. Secure, job-specific AI drafting
7. Export, import, deletion, and expanded ATS compatibility

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
```

Then install the compiled extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Remove the earlier vanilla prototype if it is still listed.
4. Select **Load unpacked**.
5. Choose `apps/extension/dist` inside this repository.
6. Open Application Copilot and select **Set up profile**.
7. Save a test profile, close the page, and reopen it to verify persistence.

After changing extension code, run `npm run build` again and press the reload button for the extension on `chrome://extensions`. The Node API automatically restarts when its source changes.

## Useful checks

```bash
npm run typecheck
npm test
npm run build
```

## Persistence

The profile is saved in `data/application-copilot.db`. The extension itself keeps no personal profile data now; it makes requests to the local Node API. The database file is ignored by Git so personal information cannot be accidentally committed.

The current SQLite schema contains a singleton `profiles` record with:

- A versioned JSON profile document.
- An update timestamp.

JSON is used during this first transition to keep the proven profile model intact. Employment history, learned answers, question aliases, applications, and AI drafts will receive dedicated relational tables as those features are implemented.

## Current security boundary

- The API binds to `127.0.0.1`, so it is not exposed to the local network.
- Browser access is allowed for Chrome-extension pages and the local development UI.
- The extension requests access only to the local API; it cannot inspect job pages yet.
- No data is transmitted to an external server.
- No AI provider is connected.
- Nothing submits applications automatically.

Before distributing the extension, the local API will need extension authentication. The current origin check is appropriate for local development but does not prevent another installed extension from calling the API.

## Planned milestones

1. React/Node/SQLite transition — **current**
2. Page-field detection and preview
3. Standard-field autofill
4. Unknown-question inbox and learned-answer memory
5. Similar-question matching
6. Secure, job-specific AI drafting
7. Export, import, deletion, and expanded ATS compatibility

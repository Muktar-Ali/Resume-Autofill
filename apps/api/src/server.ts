import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequestHandler } from "./app.js";
import { createApplicationRepository } from "./database.js";

const HOST = "127.0.0.1";
const PORT = 4318;
const here = dirname(fileURLToPath(import.meta.url));
const databasePath = resolve(here, "../../../data/application-copilot.db");
const repository = createApplicationRepository(databasePath);
const server = createServer(createRequestHandler(repository));

server.listen(PORT, HOST, () => {
  console.log(`Application Copilot API running at http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${databasePath}`);
});

function shutdown() {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

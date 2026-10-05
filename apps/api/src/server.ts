import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createAnswerMatchingService } from "./answer-matcher.js";
import { createRequestHandler } from "./app.js";
import { createApplicationRepository } from "./database.js";
import { createOpenAIEmbeddingProvider } from "./embeddings.js";

const HOST = "127.0.0.1";
const PORT = 4318;
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env"), quiet: true });
const databasePath = resolve(here, "../../../data/application-copilot.db");
const repository = createApplicationRepository(databasePath);
const embeddingProvider = createOpenAIEmbeddingProvider();
const answerMatcher = createAnswerMatchingService(repository, embeddingProvider);
const server = createServer(createRequestHandler(repository, answerMatcher));

server.listen(PORT, HOST, () => {
  console.log(`Application Copilot API running at http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${databasePath}`);
  console.log(
    embeddingProvider
      ? `Semantic matching: enabled (${embeddingProvider.model})`
      : "Semantic matching: disabled (add OPENAI_API_KEY to the root .env file)"
  );
});

function shutdown() {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

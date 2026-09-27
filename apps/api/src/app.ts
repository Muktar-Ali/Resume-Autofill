import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeProfile, type ApplicantProfile } from "@application-copilot/shared";
import type { ProfileRepository } from "./database.js";
import { demoApplicationPage } from "./demo-page.js";

const MAX_BODY_BYTES = 100_000;

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  const allowed = !origin || origin.startsWith("chrome-extension://") || origin === "http://localhost:5173";
  if (origin && allowed) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function sendHtml(response: ServerResponse, status: number, value: string) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
  });
  response.end(value);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createRequestHandler(repository: ProfileRepository) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    setCors(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.url === "/health" && request.method === "GET") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.url === "/demo" && request.method === "GET") {
      sendHtml(response, 200, demoApplicationPage);
      return;
    }

    if (request.url === "/api/profile" && request.method === "GET") {
      sendJson(response, 200, repository.getProfile());
      return;
    }

    if (request.url === "/api/profile" && request.method === "PUT") {
      try {
        const body = normalizeProfile((await readJson(request)) as Partial<ApplicantProfile>);
        sendJson(response, 200, repository.saveProfile(body));
      } catch {
        sendJson(response, 400, { error: "The profile payload is invalid." });
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  };
}

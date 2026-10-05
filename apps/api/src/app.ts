import type { IncomingMessage, ServerResponse } from "node:http";
import {
  normalizeProfile,
  type ApplicantProfile,
  type DetectedControlType,
  type LearnedAnswerInput,
  type LearnedQuestionCandidate
} from "@application-copilot/shared";
import type { ApplicationRepository } from "./database.js";
import { demoApplicationPage } from "./demo-page.js";

const MAX_BODY_BYTES = 100_000;
const CONTROL_TYPES: DetectedControlType[] = [
  "text", "email", "tel", "url", "number", "date", "select", "textarea",
  "checkbox", "radio", "file", "password", "other"
];

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  const allowed = !origin || origin.startsWith("chrome-extension://") || origin === "http://localhost:5173";
  if (origin && allowed) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
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

function isControlType(value: unknown): value is DetectedControlType {
  return typeof value === "string" && CONTROL_TYPES.includes(value as DetectedControlType);
}

function parseLearnedAnswerInput(value: unknown): LearnedAnswerInput {
  if (!value || typeof value !== "object") throw new Error("Expected an object");
  const candidate = value as Record<string, unknown>;
  const question = typeof candidate.question === "string" ? candidate.question.trim() : "";
  const answer = typeof candidate.answer === "string" ? candidate.answer.trim() : "";

  if (!question || question.length > 1_000) throw new Error("Question is invalid");
  if (!answer || answer.length > 10_000) throw new Error("Answer is invalid");
  if (!isControlType(candidate.controlType) || ["password", "file"].includes(candidate.controlType)) {
    throw new Error("Control type is invalid");
  }

  return { question, answer, controlType: candidate.controlType };
}

function parseQuestionCandidates(value: unknown): LearnedQuestionCandidate[] {
  if (!value || typeof value !== "object") throw new Error("Expected an object");
  const questions = (value as Record<string, unknown>).questions;
  if (!Array.isArray(questions) || questions.length > 100) throw new Error("Questions are invalid");

  return questions.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Question is invalid");
    const candidate = value as Record<string, unknown>;
    const fieldId = typeof candidate.fieldId === "string" ? candidate.fieldId : "";
    const question = typeof candidate.question === "string" ? candidate.question.trim() : "";
    if (!fieldId || !question || question.length > 1_000 || !isControlType(candidate.controlType)) {
      throw new Error("Question is invalid");
    }
    return { fieldId, question, controlType: candidate.controlType };
  });
}

export function createRequestHandler(repository: ApplicationRepository) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    setCors(request, response);
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (pathname === "/health" && request.method === "GET") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (pathname === "/demo" && request.method === "GET") {
      sendHtml(response, 200, demoApplicationPage);
      return;
    }

    if (pathname === "/api/profile" && request.method === "GET") {
      sendJson(response, 200, repository.getProfile());
      return;
    }

    if (pathname === "/api/profile" && request.method === "PUT") {
      try {
        const body = normalizeProfile((await readJson(request)) as Partial<ApplicantProfile>);
        sendJson(response, 200, repository.saveProfile(body));
      } catch {
        sendJson(response, 400, { error: "The profile payload is invalid." });
      }
      return;
    }

    if (pathname === "/api/answers" && request.method === "GET") {
      sendJson(response, 200, repository.listLearnedAnswers());
      return;
    }

    if (pathname === "/api/answers" && request.method === "POST") {
      try {
        const body = parseLearnedAnswerInput(await readJson(request));
        sendJson(response, 201, repository.saveLearnedAnswer(body));
      } catch {
        sendJson(response, 400, { error: "The learned answer payload is invalid." });
      }
      return;
    }

    if (pathname === "/api/answers/match" && request.method === "POST") {
      try {
        const questions = parseQuestionCandidates(await readJson(request));
        sendJson(response, 200, repository.matchLearnedAnswers(questions));
      } catch {
        sendJson(response, 400, { error: "The question match payload is invalid." });
      }
      return;
    }

    const answerIdMatch = pathname.match(/^\/api\/answers\/(\d+)$/);
    if (answerIdMatch && request.method === "DELETE") {
      const deleted = repository.deleteLearnedAnswer(Number(answerIdMatch[1]));
      if (!deleted) sendJson(response, 404, { error: "Learned answer not found." });
      else sendJson(response, 200, { deleted: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  };
}

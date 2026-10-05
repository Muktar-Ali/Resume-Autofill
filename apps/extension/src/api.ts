import type {
  ApplicantProfile,
  LearnedAnswer,
  LearnedAnswerInput,
  LearnedAnswerMatch,
  LearnedQuestionCandidate,
  SemanticMatchingStatus
} from "@application-copilot/shared";

const API_BASE_URL = "http://127.0.0.1:4318";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getProfile(): Promise<ApplicantProfile> {
  return request<ApplicantProfile>("/api/profile");
}

export function saveProfile(profile: ApplicantProfile): Promise<ApplicantProfile> {
  return request<ApplicantProfile>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile)
  });
}

export function getLearnedAnswers(): Promise<LearnedAnswer[]> {
  return request<LearnedAnswer[]>("/api/answers");
}

export function saveLearnedAnswer(input: LearnedAnswerInput): Promise<LearnedAnswer> {
  return request<LearnedAnswer>("/api/answers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function matchLearnedAnswers(
  questions: LearnedQuestionCandidate[]
): Promise<LearnedAnswerMatch[]> {
  return request<LearnedAnswerMatch[]>("/api/answers/match", {
    method: "POST",
    body: JSON.stringify({ questions })
  });
}

export function getSemanticMatchingStatus(): Promise<SemanticMatchingStatus> {
  return request<SemanticMatchingStatus>("/api/answers/semantic-status");
}

export function deleteLearnedAnswer(id: number): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/api/answers/${id}`, { method: "DELETE" });
}

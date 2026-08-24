import type { ApplicantProfile } from "@application-copilot/shared";

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

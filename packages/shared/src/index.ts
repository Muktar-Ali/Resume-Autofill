export type YesNoAnswer = "" | "yes" | "no";

export type ProfileFieldPath =
  | "personal.firstName"
  | "personal.lastName"
  | "personal.preferredName"
  | "personal.email"
  | "personal.phone"
  | "personal.city"
  | "personal.state"
  | "personal.country"
  | "personal.postalCode"
  | "links.linkedin"
  | "links.github"
  | "links.portfolio"
  | "work.currentTitle"
  | "work.currentCompany"
  | "work.yearsOfExperience"
  | "work.authorizedToWork"
  | "work.requiresSponsorship";

export type DetectedControlType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "checkbox"
  | "radio"
  | "file"
  | "password"
  | "other";

export interface DetectedFieldOption {
  label: string;
  value: string;
}

export interface FieldLocator {
  id: string;
  name: string;
  domIndex: number;
}

export interface DetectedField {
  fieldId: string;
  label: string;
  controlType: DetectedControlType;
  name: string;
  required: boolean;
  options: DetectedFieldOption[];
  locator: FieldLocator;
}

export type FieldClassification =
  | "recognized"
  | "learned"
  | "suggested"
  | "unknown"
  | "draft"
  | "unsupported"
  | "excluded";

export interface LearnedAnswer {
  id: number;
  question: string;
  normalizedQuestion: string;
  answer: string;
  controlType: DetectedControlType;
  createdAt: string;
  updatedAt: string;
}

export interface LearnedAnswerInput {
  question: string;
  answer: string;
  controlType: DetectedControlType;
}

export interface LearnedQuestionCandidate {
  fieldId: string;
  question: string;
  controlType: DetectedControlType;
}

export interface LearnedAnswerMatch {
  fieldId: string;
  learnedAnswer: LearnedAnswer | null;
  matchKind: "exact" | "semantic" | "suggestion" | "none";
  similarity: number | null;
}

export interface SemanticMatchingStatus {
  enabled: boolean;
  model: string | null;
  automaticMatchThreshold: number;
  suggestionThreshold: number;
}

export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FieldFillInstruction {
  fieldId: string;
  label: string;
  controlType: DetectedControlType;
  locator: FieldLocator;
  value: string;
}

export type FieldFillStatus = "filled" | "skipped-nonempty" | "not-found" | "no-option" | "unsupported";

export interface FieldFillResult {
  fieldId: string;
  status: FieldFillStatus;
  message: string;
}

export interface ApplicantProfile {
  version: 1;
  updatedAt: string | null;
  personal: {
    firstName: string;
    lastName: string;
    preferredName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  links: {
    linkedin: string;
    github: string;
    portfolio: string;
  };
  work: {
    currentTitle: string;
    currentCompany: string;
    yearsOfExperience: string;
    authorizedToWork: YesNoAnswer;
    requiresSponsorship: YesNoAnswer;
  };
}

export function createEmptyProfile(): ApplicantProfile {
  return {
    version: 1,
    updatedAt: null,
    personal: {
      firstName: "",
      lastName: "",
      preferredName: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      country: "",
      postalCode: ""
    },
    links: { linkedin: "", github: "", portfolio: "" },
    work: {
      currentTitle: "",
      currentCompany: "",
      yearsOfExperience: "",
      authorizedToWork: "",
      requiresSponsorship: ""
    }
  };
}

export function isProfileStarted(profile: ApplicantProfile): boolean {
  return Boolean(
    profile.personal.firstName ||
      profile.personal.lastName ||
      profile.personal.email ||
      profile.personal.phone
  );
}

export function normalizeProfile(input: Partial<ApplicantProfile> | undefined): ApplicantProfile {
  const empty = createEmptyProfile();
  const profile = input ?? {};

  return {
    ...empty,
    ...profile,
    version: 1,
    personal: { ...empty.personal, ...profile.personal },
    links: { ...empty.links, ...profile.links },
    work: { ...empty.work, ...profile.work }
  };
}

import type {
  ApplicantProfile,
  DetectedField,
  FieldClassification,
  LearnedAnswer,
  LearnedAnswerMatch,
  ProfileFieldPath
} from "@application-copilot/shared";

export interface FieldPreview extends DetectedField {
  classification: FieldClassification;
  profilePath: ProfileFieldPath | null;
  learnedAnswer: LearnedAnswer | null;
  learnedMatchKind: LearnedAnswerMatch["matchKind"] | null;
  similarity: number | null;
  hasSavedValue: boolean;
  explanation: string;
}

interface MatchRule {
  path: ProfileFieldPath;
  patterns: RegExp[];
}

const MATCH_RULES: MatchRule[] = [
  { path: "links.linkedin", patterns: [/\blinked\s*in\b/] },
  { path: "links.github", patterns: [/\bgithub\b/] },
  { path: "links.portfolio", patterns: [/^(your )?(portfolio|portfolio url|personal website|website|website url)$/] },
  { path: "personal.firstName", patterns: [/\b(first|given) name\b/] },
  { path: "personal.lastName", patterns: [/\b(last|family) name\b/, /^surname$/] },
  { path: "personal.preferredName", patterns: [/\b(preferred|chosen) name\b/] },
  { path: "personal.email", patterns: [/^(your )?(email|email address|e mail)$/] },
  { path: "personal.phone", patterns: [/^(your )?(phone|phone number|mobile|mobile number|telephone|telephone number)$/] },
  { path: "personal.city", patterns: [/^(current |home )?(city|city town)$/] },
  { path: "personal.state", patterns: [/^(state|province|region|state province|state or region)$/] },
  { path: "personal.country", patterns: [/^(country|country of residence|current country)$/] },
  { path: "personal.postalCode", patterns: [/^(zip|zip code|postal code|postcode)$/] },
  { path: "work.currentTitle", patterns: [/^(current )?(job title|title|position)$/] },
  { path: "work.currentCompany", patterns: [/^(current )?(company|company name|employer|employer name)$/] },
  { path: "work.yearsOfExperience", patterns: [/\b(years|number of years|total years)\b.*\bexperience\b/] },
  { path: "work.authorizedToWork", patterns: [/\b(legally )?authorized\b.*\bwork\b/, /\bwork authorization\b/] },
  { path: "work.requiresSponsorship", patterns: [/\b(require|need|seeking)\b.*\bsponsor(ship)?\b/, /\bsponsor(ship)?\b.*\b(require|need)\b/] }
];

export function normalizeFieldLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[*:()?,./_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchProfilePath(label: string): ProfileFieldPath | null {
  const normalized = normalizeFieldLabel(label);
  if (!normalized) return null;

  for (const rule of MATCH_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) return rule.path;
  }

  return null;
}

export function isDraftPrompt(label: string): boolean {
  const normalized = normalizeFieldLabel(label);
  return [
    /^why .*\b(work|join|interested)\b/,
    /\bwhy (this|our) (company|role|position|organization)\b/,
    /\bcover letter\b/,
    /\bpersonal statement\b/
  ].some((pattern) => pattern.test(normalized));
}

export function getProfileValue(profile: ApplicantProfile, path: ProfileFieldPath): string {
  const [group, field] = path.split(".") as [keyof ApplicantProfile, string];
  const section = profile[group];

  if (!section || typeof section !== "object") return "";
  const value = (section as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

export function createFieldPreview(
  field: DetectedField,
  profile: ApplicantProfile | null
): FieldPreview {
  if (field.controlType === "password") {
    return {
      ...field,
      classification: "excluded",
      profilePath: null,
      learnedAnswer: null,
      learnedMatchKind: null,
      similarity: null,
      hasSavedValue: false,
      explanation: "Password fields are never handled."
    };
  }

  if (field.controlType === "file") {
    return {
      ...field,
      classification: "unsupported",
      profilePath: null,
      learnedAnswer: null,
      learnedMatchKind: null,
      similarity: null,
      hasSavedValue: false,
      explanation: "File uploads will be handled in a later milestone."
    };
  }

  if (isDraftPrompt(field.label)) {
    return {
      ...field,
      classification: "draft",
      profilePath: null,
      learnedAnswer: null,
      learnedMatchKind: null,
      similarity: null,
      hasSavedValue: false,
      explanation: "This prompt needs a job-specific draft and will not reuse a generic answer."
    };
  }

  const profilePath = matchProfilePath(field.label);

  if (!profilePath) {
    return {
      ...field,
      classification: "unknown",
      profilePath: null,
      learnedAnswer: null,
      learnedMatchKind: null,
      similarity: null,
      hasSavedValue: false,
      explanation: "No safe profile match was found."
    };
  }

  return {
    ...field,
    classification: "recognized",
    profilePath,
    learnedAnswer: null,
    learnedMatchKind: null,
    similarity: null,
    hasSavedValue: Boolean(profile && getProfileValue(profile, profilePath).trim()),
    explanation: profile ? "Matched to the applicant profile." : "Matched, but the profile API is unavailable."
  };
}

export function applyLearnedAnswer(
  preview: FieldPreview,
  match: LearnedAnswerMatch
): FieldPreview {
  if (preview.classification !== "unknown" || !match.learnedAnswer) return preview;

  if (match.matchKind === "suggestion") {
    return {
      ...preview,
      classification: "suggested",
      learnedAnswer: match.learnedAnswer,
      learnedMatchKind: match.matchKind,
      similarity: match.similarity,
      hasSavedValue: false,
      explanation: "A similar learned question was found. Confirm it before filling."
    };
  }

  if (!["exact", "semantic"].includes(match.matchKind)) return preview;

  return {
    ...preview,
    classification: "learned",
    learnedAnswer: match.learnedAnswer,
    learnedMatchKind: match.matchKind,
    similarity: match.similarity,
    hasSavedValue: true,
    explanation: match.matchKind === "semantic"
      ? "Strongly matched to a similarly worded learned question."
      : "Matched to an approved learned answer."
  };
}

export function dismissLearnedSuggestion(preview: FieldPreview): FieldPreview {
  if (preview.classification !== "suggested") return preview;
  return {
    ...preview,
    classification: "unknown",
    learnedAnswer: null,
    learnedMatchKind: null,
    similarity: null,
    hasSavedValue: false,
    explanation: "The suggested question was rejected. Enter a reusable answer if appropriate."
  };
}

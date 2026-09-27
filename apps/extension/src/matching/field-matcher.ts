import type {
  ApplicantProfile,
  DetectedField,
  FieldClassification,
  ProfileFieldPath
} from "@application-copilot/shared";

export interface FieldPreview extends DetectedField {
  classification: FieldClassification;
  profilePath: ProfileFieldPath | null;
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
      hasSavedValue: false,
      explanation: "Password fields are never handled."
    };
  }

  if (field.controlType === "file") {
    return {
      ...field,
      classification: "unsupported",
      profilePath: null,
      hasSavedValue: false,
      explanation: "File uploads will be handled in a later milestone."
    };
  }

  const profilePath = matchProfilePath(field.label);

  if (!profilePath) {
    return {
      ...field,
      classification: "unknown",
      profilePath: null,
      hasSavedValue: false,
      explanation: "No safe profile match was found."
    };
  }

  return {
    ...field,
    classification: "recognized",
    profilePath,
    hasSavedValue: Boolean(profile && getProfileValue(profile, profilePath).trim()),
    explanation: profile ? "Matched to the applicant profile." : "Matched, but the profile API is unavailable."
  };
}

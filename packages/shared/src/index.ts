export type YesNoAnswer = "" | "yes" | "no";

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

import type {
  CropCode,
  FlagCode,
  Goal,
  LanguageCode,
  SoilType,
} from "@nextcrop/api-client";

const LOCATION_KEY = "nextcrop.draft.location.v1";
const WIZARD_KEY = "nextcrop.draft.wizard.v1";

export interface LocationDraft {
  lat?: number;
  lon?: number;
  district_id?: string;
  subcounty_id?: string;
}

export interface WizardDraft {
  previous_crops: CropCode[];
  soil_type: SoilType | null;
  goal: Goal | null;
  flags: FlagCode[];
  seasons: number;
  language: LanguageCode;
}

const read = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Drafts are best-effort.
  }
};

export const readLocationDraft = (): LocationDraft | null =>
  read<LocationDraft>(LOCATION_KEY);

export const saveLocationDraft = (draft: LocationDraft): void => {
  write(LOCATION_KEY, draft);
};

export const readWizardDraft = (language: LanguageCode): WizardDraft => {
  const stored = read<WizardDraft>(WIZARD_KEY);
  return {
    previous_crops: stored?.previous_crops ?? [],
    soil_type: stored?.soil_type ?? null,
    goal: stored?.goal ?? null,
    flags: stored?.flags ?? [],
    seasons: stored?.seasons ?? 4,
    language,
  };
};

export const saveWizardDraft = (draft: WizardDraft): void => {
  write(WIZARD_KEY, draft);
};

export const clearDrafts = (): void => {
  try {
    window.localStorage.removeItem(LOCATION_KEY);
    window.localStorage.removeItem(WIZARD_KEY);
  } catch {
    // Ignore storage failures.
  }
};

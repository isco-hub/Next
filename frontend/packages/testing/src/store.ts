import {
  resolveLocation,
  type AuditEntry,
  type ConsentRecord,
  type Feedback,
  type FieldObservation,
  type LanguageCode,
  type Plot,
  type Recommendation,
  type Role,
  type RulePack,
  type Session,
  type User,
} from "@nextcrop/api-client";
import { generateOutlook } from "./climate";
import { generatePlan, sampleRequest } from "./engine";
import {
  DRAFT_RULE_PACK_YAML,
  SAMPLE_DISCLAIMER,
  SAMPLE_RULE_PACK_YAML,
  SEED_NOW_ISO,
} from "./fixtures";
import { runGoldenTests } from "./golden";

const STORAGE_KEY = "nextcrop.mock.state.v3";
const SCHEMA_VERSION = 3;

export interface RegisteredFarmer {
  farmer_ref: string;
  name: string;
  phone: string;
  language: LanguageCode;
  subcounty_id: string;
  created_at: string;
  created_by: string;
}

export interface MockUssdSession {
  session_id: string;
  phone_number: string;
  language: LanguageCode;
  step:
    | "menu"
    | "crop"
    | "soil"
    | "goal"
    | "district"
    | "subcounty"
    | "feedback_crop"
    | "feedback_rating";
  previous_crop?: string;
  soil?: string;
  goal?: string;
  district_id?: string;
  recommendation_id?: string;
  updated_at: string;
}

export interface MockState {
  version: number;
  users: User[];
  phones: Record<string, string>;
  sessions: Record<string, string>;
  plots: Plot[];
  recommendations: Recommendation[];
  feedback: Feedback[];
  consents: ConsentRecord[];
  observations: FieldObservation[];
  rulePacks: RulePack[];
  audit: AuditEntry[];
  registeredFarmers: RegisteredFarmer[];
  ussd: Record<string, MockUssdSession>;
  idempotency: Record<string, string>;
}

const hashString = (value: string): string => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const newId = (prefix: string): string => {
  const random =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random.replace(/-/g, "").slice(0, 16)}`;
};

export const nowIso = (): string => new Date().toISOString();

export const addHours = (value: Date, hours: number): string =>
  new Date(value.getTime() + hours * 3_600_000).toISOString();

const USERS: User[] = [
  {
    id: "user-farmer",
    role: "farmer",
    display_name: "Demo farmer",
    language: "en",
    district_id: "lira",
    subcounty_ids: ["lira.lira"],
    consent_version: "2026-01",
    mfa_required: false,
  },
  {
    id: "user-officer",
    role: "extension_officer",
    display_name: "Demo extension officer",
    language: "en",
    district_id: "lira",
    subcounty_ids: ["lira.lira", "lira.agweng", "lira.barr"],
    consent_version: "2026-01",
    mfa_required: false,
  },
  {
    id: "user-coop",
    role: "cooperative",
    display_name: "Demo cooperative",
    language: "en",
    district_id: "lira",
    subcounty_ids: ["lira.lira"],
    consent_version: "2026-01",
    mfa_required: false,
  },
  {
    id: "user-agronomist",
    role: "agronomist",
    display_name: "Demo agronomist",
    language: "en",
    district_id: null,
    subcounty_ids: [],
    consent_version: "2026-01",
    mfa_required: false,
  },
  {
    id: "user-admin",
    role: "admin",
    display_name: "Demo rule administrator",
    language: "en",
    district_id: null,
    subcounty_ids: [],
    consent_version: "2026-01",
    mfa_required: true,
  },
];

const PHONES: Record<string, string> = {
  "+256770000001": "user-officer",
  "+256770000002": "user-admin",
  "+256770000003": "user-farmer",
  "+256770000004": "user-coop",
  "+256770000005": "user-agronomist",
};

const SESSIONS: Record<string, string> = {
  "demo-farmer-token": "user-farmer",
  "demo-officer-token": "user-officer",
  "demo-coop-token": "user-coop",
  "demo-agronomist-token": "user-agronomist",
  "demo-admin-token": "user-admin",
};

const seedRecommendation = (
  id: string,
  plot: Plot,
  createdAt: string,
  goal: "restore_soil" | "max_cash" | "drought_survival",
  previous: Plot["previous_crops"],
): Recommendation => {
  const location = resolveLocation({
    lat: plot.lat,
    lon: plot.lon,
    district_id: plot.district_id,
    subcounty_id: plot.subcounty_id,
  });
  const input = sampleRequest({
    previous_crops: previous,
    soil_type: plot.soil_type,
    goal,
    seasons: 4,
    language: "en",
    channel: "web",
    lat: plot.lat,
    lon: plot.lon,
    district_id: plot.district_id,
    subcounty_id: plot.subcounty_id,
  });
  const outlook = generateOutlook(location, { now: new Date(createdAt) });
  const plan = generatePlan(input, {
    outlook,
    now: new Date(createdAt),
    packVersion: "2.0.0",
  });
  return {
    id,
    pack_version: "2.0.0",
    created_at: createdAt,
    channel: "web",
    language: "en",
    inputs: input,
    outlook,
    seasons: plan.seasons,
    disclaimer: SAMPLE_DISCLAIMER,
    disclaimer_key: "plan.disclaimerBody",
  };
};

const seed = (): MockState => {
  const golden = runGoldenTests();
  const plots: Plot[] = [
    {
      id: "plot-home",
      user_id: "user-farmer",
      name: "Home garden",
      lat: 2.247,
      lon: 32.901,
      soil_type: "loam",
      size_acres: 1.5,
      previous_crops: ["maize", "soya"],
      district_id: "lira",
      subcounty_id: "lira.lira",
      grid_cell_id: "LC-2.25-32.90",
      created_at: "2026-03-02T09:00:00.000Z",
      updated_at: "2026-09-12T10:30:00.000Z",
    },
    {
      id: "plot-river",
      user_id: "user-farmer",
      name: "River plot",
      lat: 2.301,
      lon: 32.841,
      soil_type: "sandy",
      size_acres: 2.2,
      previous_crops: ["groundnut", "sorghum"],
      district_id: "lira",
      subcounty_id: "lira.agweng",
      grid_cell_id: "LC-2.30-32.84",
      created_at: "2026-04-15T08:00:00.000Z",
      updated_at: "2026-10-01T16:00:00.000Z",
    },
    {
      id: "plot-acacia",
      user_id: "user-farmer",
      name: "Acacia field",
      lat: 2.531,
      lon: 32.461,
      soil_type: "clay",
      size_acres: 3,
      previous_crops: ["cassava"],
      district_id: "apac",
      subcounty_id: "apac.apac",
      grid_cell_id: "LC-2.53-32.46",
      created_at: "2025-05-20T11:00:00.000Z",
      updated_at: "2026-08-18T09:15:00.000Z",
    },
  ];
  const recommendations = [
    seedRecommendation(
      "rec_seed_1",
      plots[0]!,
      "2026-10-20T07:20:00.000Z",
      "restore_soil",
      ["maize", "soya"],
    ),
    seedRecommendation(
      "rec_seed_2",
      plots[1]!,
      "2026-08-02T12:10:00.000Z",
      "max_cash",
      ["groundnut", "sorghum"],
    ),
  ];
  const feedback: Feedback[] = [
    {
      id: "feedback_seed_1",
      recommendation_id: "rec_seed_1",
      season: "A",
      followed: true,
      crop_planted: "soya",
      rating: "better",
      thumbs: "up",
      reason_code: "price",
      comment: "",
      created_at: "2026-06-12T10:00:00.000Z",
      rule_ids: recommendations[0]?.seasons[0]?.rule_ids ?? [],
    },
  ];
  const consents: ConsentRecord[] = [
    {
      id: "consent_seed_1",
      user_id: "user-farmer",
      version: "2026-01",
      channels: ["web", "sms"],
      data_sharing: true,
      language: "en",
      accepted_at: "2026-03-02T08:59:00.000Z",
      withdrawn_at: null,
    },
  ];
  const observations: FieldObservation[] = [
    {
      id: "obs_seed_1",
      officer_id: "user-officer",
      plot_id: "plot-home",
      farmer_ref: "F-1042",
      crop_planted: "soya",
      pest_sighting: null,
      disease_sighting: null,
      note: "Good pod fill after the late rains.",
      observed_at: "2026-07-14T09:00:00.000Z",
    },
    {
      id: "obs_seed_2",
      officer_id: "user-officer",
      plot_id: null,
      farmer_ref: "F-1088",
      crop_planted: "maize",
      pest_sighting: "fall armyworm",
      disease_sighting: null,
      note: "Scout weekly; treat young larvae only.",
      observed_at: "2026-08-03T11:30:00.000Z",
    },
  ];
  const rulePacks: RulePack[] = [
    {
      id: "rp_published_200",
      version: "2.0.0",
      status: "published",
      yaml_document: SAMPLE_RULE_PACK_YAML,
      created_by: "user-agronomist",
      created_at: "2026-09-01T08:00:00.000Z",
      updated_at: "2026-09-18T14:00:00.000Z",
      approved_by: "user-admin",
      published_at: "2026-09-18T15:00:00.000Z",
      pack_hash: hashString(SAMPLE_RULE_PACK_YAML),
      golden_tests_passed: golden.every((test) => test.pass),
      golden_tests: golden,
      base_version: null,
    },
    {
      id: "rp_draft_210",
      version: "2.1.0",
      status: "draft",
      yaml_document: DRAFT_RULE_PACK_YAML,
      created_by: "user-agronomist",
      created_at: "2026-11-08T08:00:00.000Z",
      updated_at: "2026-11-12T16:45:00.000Z",
      approved_by: null,
      published_at: null,
      pack_hash: hashString(DRAFT_RULE_PACK_YAML),
      golden_tests_passed: false,
      golden_tests: golden.map((test) => ({ ...test, pass: false })),
      base_version: "2.0.0",
    },
  ];
  const audit: AuditEntry[] = [
    {
      id: "audit_seed_1",
      at: "2026-09-18T15:00:00.000Z",
      actor: "user-admin",
      action: "rulepack.publish",
      target: "2.0.0",
      detail: "Published after agronomist approval. All 12 golden tests passed.",
      trace_id: "trace-9f11",
    },
    {
      id: "audit_seed_2",
      at: "2026-11-08T08:05:00.000Z",
      actor: "user-agronomist",
      action: "rulepack.create",
      target: "2.1.0",
      detail: "Draft based on 2.0.0; drought bonus adjusted to +11.",
      trace_id: "trace-2ab4",
    },
    {
      id: "audit_seed_3",
      at: "2026-11-12T16:45:00.000Z",
      actor: "user-agronomist",
      action: "rulepack.update",
      target: "2.1.0",
      detail: "Updated scoring parameters.",
      trace_id: "trace-77c0",
    },
  ];

  return {
    version: SCHEMA_VERSION,
    users: USERS,
    phones: PHONES,
    sessions: SESSIONS,
    plots,
    recommendations,
    feedback,
    consents,
    observations,
    rulePacks,
    audit,
    registeredFarmers: [
      {
        farmer_ref: "F-1042",
        name: "Akello Grace",
        phone: "+256771234567",
        language: "en",
        subcounty_id: "lira.lira",
        created_at: "2026-03-02T09:00:00.000Z",
        created_by: "user-officer",
      },
      {
        farmer_ref: "F-1088",
        name: "Okello Peter",
        phone: "+256772345678",
        language: "en",
        subcounty_id: "lira.agweng",
        created_at: "2026-04-15T10:00:00.000Z",
        created_by: "user-officer",
      },
    ],
    ussd: {},
    idempotency: {},
  };
};

const read = (): MockState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockState;
    return parsed.version === SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
};

let memoryState: MockState | null = null;

export const getMockState = (): MockState => {
  if (memoryState) return memoryState;
  const stored = read();
  memoryState = stored ?? seed();
  return memoryState;
};

export const saveMockState = (): void => {
  if (!memoryState || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    // The demo still works in memory when storage is unavailable.
  }
};

export const resetMockState = (): MockState => {
  memoryState = seed();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
  saveMockState();
  return memoryState;
};

export const findUserByToken = (token: string | null): User | null => {
  if (!token) return null;
  const state = getMockState();
  const userId = state.sessions[token];
  if (!userId) return null;
  return state.users.find((user) => user.id === userId) ?? null;
};

export const findUserByRole = (role: Role): User | null =>
  getMockState().users.find((user) => user.role === role) ?? null;

export const findUserByPhone = (phone: string): User | null => {
  const state = getMockState();
  const userId = state.phones[phone];
  if (!userId) return findUserByRole("farmer");
  return state.users.find((user) => user.id === userId) ?? null;
};

export const createSessionForPhone = (phone: string): Session => {
  const state = getMockState();
  const user = findUserByPhone(phone);
  if (!user) throw new Error("No demo user for this phone number.");
  const token = `demo-token-${user.role}-${hashString(phone)}`;
  state.sessions[token] = user.id;
  if (!state.phones[phone]) state.phones[phone] = user.id;
  saveMockState();
  return {
    token,
    refresh_token: `refresh-${hashString(`${phone}:${token}`)}`,
    user,
    expires_at: addHours(new Date(), 12),
    refresh_expires_at: addHours(new Date(), 24 * 30),
  };
};

export const removeSession = (token: string | null): void => {
  if (!token) return;
  const state = getMockState();
  delete state.sessions[token];
  saveMockState();
};

export const addAudit = (
  actor: string,
  action: string,
  target: string,
  detail: string,
): AuditEntry => {
  const state = getMockState();
  const entry: AuditEntry = {
    id: newId("audit"),
    at: nowIso(),
    actor,
    action,
    target,
    detail,
    trace_id: `trace-${hashString(`${action}:${target}:${Date.now()}`)}`,
  };
  state.audit.unshift(entry);
  return entry;
};

export const addPlot = (plot: Plot): void => {
  getMockState().plots.push(plot);
};

export const addRecommendation = (recommendation: Recommendation): void => {
  getMockState().recommendations.unshift(recommendation);
};

export const addFeedback = (entry: Feedback): void => {
  getMockState().feedback.unshift(entry);
};

export const ensureState = (): MockState => getMockState();

export const seedTimestamp = SEED_NOW_ISO;

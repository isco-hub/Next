export type LanguageCode = "en";

export type CropCode =
  | "maize"
  | "sorghum"
  | "finger_millet"
  | "soya"
  | "groundnut"
  | "bean"
  | "cowpea"
  | "simsim"
  | "sunflower"
  | "cassava"
  | "other";

export type PlantableCropCode = Exclude<CropCode, "other">;

export type SoilType = "sandy" | "loam" | "clay" | "unknown";

export type Goal = "restore_soil" | "max_cash" | "drought_survival";

export type FlagCode =
  | "striga"
  | "cassava_disease"
  | "armyworm"
  | "low_fertility"
  | "groundnut_disease";

export type MoistureClass = "dry" | "normal" | "wet";

export type OnsetStatus =
  | "not_started"
  | "onset_detected"
  | "false_start_risk"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

export type Channel = "web" | "ussd" | "sms";

export type SeasonLetter = "A" | "B";

export type Role =
  | "farmer"
  | "extension_officer"
  | "cooperative"
  | "agronomist"
  | "admin";

export type CropFamily = "cereal" | "legume" | "oilseed" | "perennial";

export interface CropDefinition {
  code: PlantableCropCode;
  family: CropFamily;
  cycleMonths: [number, number];
  betterSeason: "A" | "B" | "either";
  labelKey: string;
}

export const CROPS: readonly CropDefinition[] = [
  { code: "maize", family: "cereal", cycleMonths: [3, 4], betterSeason: "A", labelKey: "crop.maize" },
  { code: "sorghum", family: "cereal", cycleMonths: [3, 5], betterSeason: "either", labelKey: "crop.sorghum" },
  { code: "finger_millet", family: "cereal", cycleMonths: [3, 4], betterSeason: "either", labelKey: "crop.finger_millet" },
  { code: "soya", family: "legume", cycleMonths: [3, 4], betterSeason: "either", labelKey: "crop.soya" },
  { code: "groundnut", family: "legume", cycleMonths: [3, 4], betterSeason: "A", labelKey: "crop.groundnut" },
  { code: "bean", family: "legume", cycleMonths: [3, 3], betterSeason: "B", labelKey: "crop.bean" },
  { code: "cowpea", family: "legume", cycleMonths: [2, 3], betterSeason: "either", labelKey: "crop.cowpea" },
  { code: "simsim", family: "oilseed", cycleMonths: [3, 4], betterSeason: "B", labelKey: "crop.simsim" },
  { code: "sunflower", family: "oilseed", cycleMonths: [3, 4], betterSeason: "either", labelKey: "crop.sunflower" },
  { code: "cassava", family: "perennial", cycleMonths: [9, 18], betterSeason: "either", labelKey: "crop.cassava" },
] as const;

export const CROP_CODES = CROPS.map((crop) => crop.code);

export const SOILS: readonly SoilType[] = ["sandy", "loam", "clay", "unknown"];
export const GOALS: readonly Goal[] = [
  "restore_soil",
  "max_cash",
  "drought_survival",
];
export const FLAGS: readonly FlagCode[] = [
  "striga",
  "cassava_disease",
  "armyworm",
  "low_fertility",
  "groundnut_disease",
];
export const MOISTURE_CLASSES: readonly MoistureClass[] = [
  "dry",
  "normal",
  "wet",
];
export const SEASON_LETTERS: readonly SeasonLetter[] = ["A", "B"];

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface LocationInput {
  lat?: number;
  lon?: number;
  district_id?: string;
  subcounty_id?: string;
}

export interface RainfallPoint {
  date: string;
  actual_mm: number;
  normal_mm: number;
}

export interface SeasonalOutlook {
  source: string;
  label: string;
  text: string;
  issued_at: string;
  is_nasa: boolean;
}

export type OutlookNoticeCode =
  | "no_recent_data"
  | "stale_data"
  | "partial_data"
  | "regional_guidance";

export interface Outlook {
  grid_cell_id: string;
  district_id: string;
  subcounty_id: string;
  computed_at: string;
  season: SeasonLetter;
  moisture_class: MoistureClass;
  onset_status: OnsetStatus;
  onset_date: string | null;
  dry_spell_days: number;
  dry_spells_count: number;
  confidence: Confidence;
  data_age_hours: number;
  data_available: boolean;
  data_sources: string[];
  rainfall_30d: RainfallPoint[];
  rainfall_actual_total: number;
  rainfall_normal_total: number;
  seasonal_outlook: SeasonalOutlook | null;
  notice_code: OutlookNoticeCode | null;
  notice: string | null;
  attribution: string;
}

export interface RecommendationRequest extends LocationInput {
  previous_crops: CropCode[];
  soil_type: SoilType;
  goal: Goal;
  flags?: FlagCode[];
  seasons?: number;
  language: LanguageCode;
  channel: Channel;
  start_season?: SeasonLetter;
}

export interface PlanAlternative {
  crop: CropCode;
  rationale?: string;
  rationale_key?: string;
}

export interface PlanWarning {
  code: string;
  message: string;
  message_key?: string;
}

export interface IntercroppingNote {
  crop: CropCode;
  note: string;
  note_key?: string;
}

export interface SeasonPlan {
  season_index: number;
  season: SeasonLetter;
  year: number;
  crop: CropCode;
  window_start: string;
  window_end: string;
  rationale: string;
  rationale_key?: string;
  alternatives: PlanAlternative[];
  warnings: PlanWarning[];
  intercropping?: IntercroppingNote | null;
  rule_ids: string[];
  fallback: boolean;
  locked: boolean;
}

export interface Recommendation {
  id: string;
  pack_version: string;
  created_at: string;
  channel: Channel;
  language: LanguageCode;
  inputs: RecommendationRequest;
  outlook: Outlook;
  seasons: SeasonPlan[];
  disclaimer: string;
  disclaimer_key?: string;
}

export interface PlotInput {
  name: string;
  lat: number;
  lon: number;
  soil_type: SoilType;
  size_acres: number;
  previous_crops: CropCode[];
  district_id?: string;
  subcounty_id?: string;
}

export interface Plot extends PlotInput {
  id: string;
  user_id: string;
  grid_cell_id: string;
  created_at: string;
  updated_at: string;
}

export interface RecommendationSummary {
  id: string;
  created_at: string;
  pack_version: string;
  crops: CropCode[];
  season: SeasonLetter;
}

export interface FeedbackInput {
  recommendation_id: string;
  season: SeasonLetter;
  followed: boolean;
  crop_planted: CropCode;
  rating?: "better" | "same" | "worse";
  thumbs?: "up" | "down";
  reason_code?: string;
  comment?: string;
}

export interface Feedback extends FeedbackInput {
  id: string;
  created_at: string;
  rule_ids: string[];
}

export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  trace_id?: string;
  errors?: { field: string; message: string }[];
}

export interface Health {
  status: "ok" | "degraded";
  data_freshness_hours: number;
  version: string;
  time: string;
}

export interface OtpRequestInput {
  phone: string;
  purpose?: "signin" | "signup";
  role?: Role;
  display_name?: string;
  language?: LanguageCode;
  district_id?: string;
  subcounty_ids?: string[];
}

export interface OtpRequestResult {
  request_id: string;
  expires_in_seconds: number;
  channel: Channel;
  dev_code?: string | null;
}

export interface User {
  id: string;
  role: Role;
  display_name: string | null;
  language: LanguageCode;
  district_id: string | null;
  subcounty_ids: string[];
  consent_version: string | null;
  mfa_required: boolean;
}

export interface Session {
  token: string;
  refresh_token: string;
  user: User;
  expires_at: string;
  refresh_expires_at?: string;
}

export interface ConsentInput {
  version: string;
  channels: Channel[];
  data_sharing: boolean;
  language: LanguageCode;
}

export interface ConsentRecord extends ConsentInput {
  id: string;
  user_id: string | null;
  accepted_at: string;
  withdrawn_at: string | null;
}

export interface DataRightsSummary {
  user: User;
  plots: Plot[];
  recommendations: RecommendationSummary[];
  consents: ConsentRecord[];
}

export interface OfficerSummary {
  district_id: string;
  subcounty_id: string;
  subcounty_name: string;
  farmers_count: number;
  moisture_class: MoistureClass;
  onset_status: OnsetStatus;
  updated_at: string;
  recommended_crops: { crop: CropCode; count: number }[];
  suppressed: boolean;
}

export interface AssistedRegistrationInput {
  farmer_name: string;
  phone: string;
  language: LanguageCode;
  subcounty_id: string;
  consent: boolean;
  plot: {
    name: string;
    lat: number;
    lon: number;
    soil_type: SoilType;
    size_acres: number;
    previous_crops: CropCode[];
  };
}

export interface AssistedRegistrationResult {
  farmer_ref: string;
  plot_id: string;
  consent_version: string;
  message: string;
}

export interface FieldObservation {
  id: string;
  officer_id: string;
  plot_id: string | null;
  farmer_ref: string | null;
  crop_planted: CropCode;
  pest_sighting: string | null;
  disease_sighting: string | null;
  note: string | null;
  observed_at: string;
}

export interface FieldObservationInput {
  plot_id?: string;
  farmer_ref?: string;
  crop_planted: CropCode;
  pest_sighting?: string;
  disease_sighting?: string;
  note?: string;
}

export interface BulkSmsInput {
  subcounty_id: string;
  message: string;
  language: LanguageCode;
}

export interface BulkSmsResult {
  recipients: number;
  suppressed: number;
  encoding: "GSM-7" | "UCS-2";
  segments_per_message: number;
  total_segments: number;
}

export interface ReportSummary {
  generated_at: string;
  suppressed: boolean;
  usage_by_channel: { channel: Channel; count: number }[];
  adoption_funnel: { stage: string; count: number }[];
  follow_rate_by_rule: {
    rule_id: string;
    crop: CropCode;
    follow_rate: number;
    sample_size: number;
  }[];
}

export type RulePackStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "archived";

export interface GoldenTestResult {
  id: string;
  scenario: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export interface RulePack {
  id: string;
  version: string;
  status: RulePackStatus;
  yaml_document: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  published_at: string | null;
  pack_hash: string;
  golden_tests_passed: boolean;
  golden_tests: GoldenTestResult[];
  base_version: string | null;
}

export interface RulePackInput {
  version: string;
  yaml_document: string;
  base_version?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  trace_id: string;
}

export type RuleSimulationInput = RecommendationRequest;

export interface RuleSimulationResult {
  pack_version: string;
  seasons: SeasonPlan[];
  trace: { season_index: number; candidates: { crop: CropCode; score: number; excluded: boolean; reason_rule: string | null }[] }[];
}

export interface UssdCallbackRequest {
  session_id: string;
  service_code: string;
  phone_number: string;
  network_code: string;
  text: string;
}

export interface UssdCallbackResult {
  response: string;
  session_id: string;
}


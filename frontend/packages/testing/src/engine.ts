import {
  CROPS,
  CROP_CODES,
  type CropCode,
  type CropFamily,
  type Goal,
  type LanguageCode,
  type MoistureClass,
  type Outlook,
  type PlanWarning,
  type PlantableCropCode,
  type RecommendationRequest,
  type RuleSimulationResult,
  type SeasonLetter,
  type SeasonPlan,
} from "@nextcrop/api-client";
import { seasonForPlanning } from "./climate";

type Gate = "best" | "good" | "conditional" | "risky";

const GATE: Record<PlantableCropCode, Record<SeasonLetter, Gate>> = {
  maize: { A: "best", B: "conditional" },
  sorghum: { A: "good", B: "good" },
  finger_millet: { A: "good", B: "good" },
  soya: { A: "good", B: "good" },
  groundnut: { A: "best", B: "conditional" },
  bean: { A: "conditional", B: "best" },
  cowpea: { A: "good", B: "good" },
  simsim: { A: "risky", B: "best" },
  sunflower: { A: "good", B: "good" },
  cassava: { A: "good", B: "good" },
};

const DROUGHT_TOLERANT: PlantableCropCode[] = [
  "sorghum",
  "finger_millet",
  "simsim",
  "sunflower",
  "cowpea",
];

const familyOf = (crop: CropCode): CropFamily | null =>
  CROPS.find((entry) => entry.code === crop)?.family ?? null;

const isCereal = (crop: CropCode) => familyOf(crop) === "cereal";
const isOilseed = (crop: CropCode) => familyOf(crop) === "oilseed";

const isPlantable = (crop: CropCode): crop is PlantableCropCode =>
  crop !== "other" && CROP_CODES.includes(crop as PlantableCropCode);

const preference = (goal: Goal, lastCrop: CropCode | null): PlantableCropCode[] => {
  const lastFamily = lastCrop ? familyOf(lastCrop) : null;
  if (lastFamily === "cereal") {
    if (goal === "restore_soil") return ["soya", "groundnut", "cowpea"];
    if (goal === "max_cash") return ["simsim", "sunflower", "soya"];
    return ["sorghum", "finger_millet", "simsim"];
  }
  if (lastFamily === "legume") {
    if (goal === "restore_soil") return ["maize", "sorghum", "finger_millet"];
    if (goal === "max_cash") return ["maize", "soya", "simsim"];
    return ["sorghum", "finger_millet", "sunflower"];
  }
  if (lastFamily === "oilseed" || lastFamily === "perennial") {
    if (goal === "restore_soil") return ["cowpea", "soya", "groundnut"];
    if (goal === "max_cash") return ["maize", "soya", "groundnut"];
    return ["sorghum", "finger_millet", "cowpea"];
  }
  if (goal === "restore_soil") return ["cowpea", "soya", "groundnut"];
  if (goal === "max_cash") return ["maize", "simsim", "sunflower"];
  return ["sorghum", "finger_millet", "cowpea"];
};

const rationaleKey = (
  crop: CropCode,
  lastCrop: CropCode | null,
  goal: Goal,
  flags: Set<string>,
  locked: boolean,
  fallback: boolean,
): string => {
  if (locked) return "plan.rationaleCassavaBlock";
  if (fallback) return "plan.rationaleSafeFallback";
  const cropFamily = familyOf(crop);
  const lastFamily = lastCrop ? familyOf(lastCrop) : null;
  if (
    goal === "restore_soil" &&
    cropFamily === "legume" &&
    lastFamily === "cereal"
  ) {
    return "plan.rationaleLegumeAfterMaize";
  }
  if (
    goal === "restore_soil" &&
    cropFamily === "cereal" &&
    lastFamily === "legume"
  ) {
    return "plan.rationaleCerealAfterLegume";
  }
  if (flags.has("striga") && cropFamily === "legume") {
    return "plan.rationaleStriga";
  }
  if (goal === "max_cash" && (cropFamily === "oilseed" || crop === "soya" || crop === "maize")) {
    return "plan.rationaleCashCrop";
  }
  if (goal === "drought_survival") return "plan.rationaleDroughtCrop";
  if (lastFamily && cropFamily !== lastFamily) return "plan.rationaleRotateFamily";
  return "plan.rationaleSeasonFit";
};

const seasonWindow = (
  season: SeasonLetter,
  year: number,
): { start: string; end: string } =>
  season === "A"
    ? { start: `${year}-03-20`, end: `${year}-05-10` }
    : { start: `${year}-08-25`, end: `${year}-10-10` };

const nextSeason = (season: SeasonLetter, year: number) =>
  season === "A"
    ? { season: "B" as SeasonLetter, year }
    : { season: "A" as SeasonLetter, year: year + 1 };

const warning = (key: string) => ({ code: key, message: "", message_key: key });

export interface EngineOptions {
  now?: Date;
  moistureClass?: MoistureClass;
  dataAvailable?: boolean;
  outlook?: Outlook;
  startSeason?: SeasonLetter;
  startYear?: number;
  packVersion?: string;
}

export interface GeneratedPlan {
  seasons: SeasonPlan[];
  trace: RuleSimulationResult["trace"];
  pack_version: string;
}

interface Candidate {
  crop: PlantableCropCode;
  score: number;
  excluded: boolean;
  reason_rule: string | null;
}

export const generatePlan = (
  input: RecommendationRequest,
  options: EngineOptions = {},
): GeneratedPlan => {
  const now = options.now ?? new Date();
  const planning = seasonForPlanning(now);
  let season = options.startSeason ?? planning.season;
  let year = options.startYear ?? planning.year;
  const moisture =
    options.outlook?.moisture_class ?? options.moistureClass ?? "normal";
  const dataAvailable =
    options.outlook?.data_available ?? options.dataAvailable ?? true;
  const count = Math.min(6, Math.max(2, input.seasons ?? 4));
  const flags = new Set(input.flags ?? []);
  let lastCrop: CropCode | null = input.previous_crops[0] ?? null;
  const sunflowerPosition = input.previous_crops.indexOf("sunflower");
  let sunflowerCooldown = sunflowerPosition === 0 ? 2 : sunflowerPosition === 1 ? 1 : 0;
  let groundnutCooldown = flags.has("groundnut_disease") ? 2 : 0;
  let cerealBan = flags.has("striga") ? 2 : 0;
  let cassavaBlock = input.previous_crops[0] === "cassava" ? 2 : 0;

  const seasons: SeasonPlan[] = [];
  const trace: RuleSimulationResult["trace"] = [];

  for (let index = 0; index < count; index += 1) {
    const window = seasonWindow(season, year);
    const rules = new Set<string>([
      "HR-01",
      `GOAL-${input.goal.toUpperCase()}`,
      `MOISTURE-${moisture.toUpperCase()}`,
      `SEASON-${season}`,
    ]);
    if (flags.has("striga")) rules.add("HR-02");
    if (sunflowerCooldown > 0) rules.add("HR-03");
    if (flags.has("cassava_disease")) rules.add("HR-04");
    if (input.soil_type === "clay") rules.add("HR-05");
    if (moisture === "wet") rules.add("HR-06");
    if (moisture === "dry") rules.add("HR-07");
    if (groundnutCooldown > 0) rules.add("HR-08");

    if (cassavaBlock > 0 && lastCrop === "cassava") {
      rules.add("HR-09");
      const seasonPlan: SeasonPlan = {
        season_index: index,
        season,
        year,
        crop: "cassava",
        window_start: window.start,
        window_end: window.end,
        rationale: "",
        rationale_key: "plan.rationaleCassavaBlock",
        alternatives: [],
        warnings: [warning("plan.warningLocks")],
        intercropping: null,
        rule_ids: [...rules],
        fallback: false,
        locked: true,
      };
      if (index === 0) {
        if (flags.has("cassava_disease")) {
          seasonPlan.warnings.push(warning("plan.warningCassavaDisease"));
        }
        if (flags.has("striga")) seasonPlan.warnings.push(warning("plan.warningStriga"));
        if (flags.has("groundnut_disease")) {
          seasonPlan.warnings.push(warning("plan.warningGroundnutDisease"));
        }
        if (!dataAvailable) {
          seasonPlan.warnings.push(warning("plan.warningNoRecentData"));
        }
      }
      seasons.push(seasonPlan);
      trace.push({
        season_index: index,
        candidates: [
          { crop: "cassava", score: 100, excluded: false, reason_rule: "HR-09" },
        ],
      });
      lastCrop = "cassava";
      cassavaBlock -= 1;
      const advanced = nextSeason(season, year);
      season = advanced.season;
      year = advanced.year;
      continue;
    }

    const candidates: Candidate[] = [];
    for (const crop of CROP_CODES) {
      if (!isPlantable(crop)) continue;
      let reason: string | null = null;

      if (crop === lastCrop) reason = "HR-01";
      else if (crop === "sunflower" && sunflowerCooldown > 0) reason = "HR-03";
      else if (crop === "groundnut" && groundnutCooldown > 0) reason = "HR-08";
      else if (isCereal(crop) && cerealBan > 0) reason = "HR-02";
      else if (crop === "cassava" && flags.has("cassava_disease")) reason = "HR-04";
      else if (input.soil_type === "clay" && (crop === "simsim" || crop === "cassava")) {
        reason = "HR-05";
      } else if (moisture === "wet" && crop === "simsim") reason = "HR-06";
      else if (moisture === "dry" && crop === "maize") reason = "HR-07";
      else if (GATE[crop][season] === "risky") reason = "SEASON-GATE";

      let score = 50;
      const ranked = preference(input.goal, lastCrop);
      const rank = ranked.indexOf(crop);
      if (rank >= 0) score += 42 - rank * 7;
      const cropFamily = familyOf(crop);
      const lastFamily = lastCrop ? familyOf(lastCrop) : null;
      if (lastCrop && cropFamily === lastFamily) score -= 8;
      if (input.goal === "restore_soil" && cropFamily === "legume" && lastFamily === "cereal") {
        score += 12;
      }
      if (input.goal === "restore_soil" && cropFamily === "cereal" && lastFamily === "legume") {
        score += 8;
      }
      if (input.goal === "max_cash" && (isOilseed(crop) || crop === "maize")) score += 6;
      if (input.goal === "drought_survival" && DROUGHT_TOLERANT.includes(crop)) {
        score += 9;
      }
      if (flags.has("low_fertility") && cropFamily === "legume") score += 8;
      if (flags.has("striga") && crop === "cowpea") score += 6;
      if (flags.has("striga") && crop === "soya") score += 4;
      if (flags.has("armyworm") && crop === "maize") score -= 8;
      if (GATE[crop][season] === "best") score += 8;
      if (GATE[crop][season] === "good") score += 3;
      if (GATE[crop][season] === "conditional") score -= 12;
      if (moisture === "dry" && DROUGHT_TOLERANT.includes(crop)) score += 4;
      if (moisture === "wet" && (crop === "cassava" || crop === "soya")) score += 2;
      if (
        input.soil_type === "sandy" &&
        (crop === "cassava" || crop === "finger_millet" || crop === "groundnut")
      ) {
        score += 2;
      }
      score += CROP_CODES.indexOf(crop) * 0.01;
      candidates.push({
        crop,
        score: Math.round(score),
        excluded: reason !== null,
        reason_rule: reason,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const feasible = candidates.filter((candidate) => !candidate.excluded);
    let selected = feasible[0];
    let fallback = false;
    if (!selected) {
      fallback = true;
      const safeCrop: PlantableCropCode =
        lastCrop === "cowpea" ? "soya" : "cowpea";
      selected = {
        crop: safeCrop,
        score: 0,
        excluded: false,
        reason_rule: null,
      };
      candidates.push(selected);
    }

    const selectedCrop = selected.crop;
    let locked = false;
    if (selectedCrop === "cassava") {
      locked = true;
      cassavaBlock = Math.max(cassavaBlock, 1);
      rules.add("HR-09");
    }
    if (fallback) rules.add("FALLBACK");

    const warnings: PlanWarning[] = [];
    if (moisture === "wet" && selectedCrop === "groundnut") {
      warnings.push(warning("plan.warningWetGroundnut"));
    }
    if (moisture === "wet" && selectedCrop === "bean") {
      warnings.push(warning("plan.warningWetBean"));
    }
    if (flags.has("armyworm") && selectedCrop === "maize") {
      warnings.push(warning("plan.warningArmyworm"));
    }
    if (flags.has("low_fertility") && isCereal(selectedCrop)) {
      warnings.push(warning("plan.warningLowFertility"));
    }
    if (fallback) warnings.push(warning("plan.warningFallback"));
    if (index === 0) {
      if (flags.has("striga")) warnings.push(warning("plan.warningStriga"));
      if (flags.has("cassava_disease")) warnings.push(warning("plan.warningCassavaDisease"));
      if (flags.has("groundnut_disease")) {
        warnings.push(warning("plan.warningGroundnutDisease"));
      }
      if (!dataAvailable) warnings.push(warning("plan.warningNoRecentData"));
    }
    if (locked) warnings.push(warning("plan.warningLocks"));

    const alternatives = fallback
      ? []
      : feasible
          .filter((candidate) => candidate.crop !== selectedCrop)
          .slice(0, 2)
          .map((candidate) => ({
            crop: candidate.crop,
            rationale: "",
            rationale_key: rationaleKey(
              candidate.crop,
              lastCrop,
              input.goal,
              flags,
              false,
              false,
            ),
          }));

    const companion: PlantableCropCode | null =
      selectedCrop === "maize" ? "bean" : selectedCrop === "sorghum" ? "cowpea" : null;

    seasons.push({
      season_index: index,
      season,
      year,
      crop: selectedCrop,
      window_start: window.start,
      window_end: window.end,
      rationale: "",
      rationale_key: rationaleKey(
        selectedCrop,
        lastCrop,
        input.goal,
        flags,
        locked,
        fallback,
      ),
      alternatives,
      warnings,
      intercropping: companion
        ? { crop: companion, note: "", note_key: undefined }
        : null,
      rule_ids: [...rules],
      fallback,
      locked,
    });
    trace.push({
      season_index: index,
      candidates: candidates.map((candidate) => ({
        crop: candidate.crop,
        score: candidate.score,
        excluded: candidate.excluded,
        reason_rule: candidate.reason_rule,
      })),
    });

    lastCrop = selectedCrop;
    if (selectedCrop === "sunflower") sunflowerCooldown = 2;
    else if (sunflowerCooldown > 0) sunflowerCooldown -= 1;
    if (groundnutCooldown > 0) groundnutCooldown -= 1;
    if (cerealBan > 0) cerealBan -= 1;

    const advanced = nextSeason(season, year);
    season = advanced.season;
    year = advanced.year;
  }

  return {
    seasons,
    trace,
    pack_version: options.packVersion ?? "1.4.0",
  };
};

export const sampleRequest = (
  overrides: Partial<RecommendationRequest> = {},
): RecommendationRequest => ({
  previous_crops: ["maize"],
  soil_type: "loam",
  goal: "restore_soil",
  flags: [],
  seasons: 4,
  language: "en" as LanguageCode,
  channel: "web",
  district_id: "lira",
  subcounty_id: "lira.lira",
  ...overrides,
});



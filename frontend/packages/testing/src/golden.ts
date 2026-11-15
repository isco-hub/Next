import type {
  CropCode,
  GoldenTestResult,
  RecommendationRequest,
} from "@nextcrop/api-client";
import { CROPS } from "@nextcrop/api-client";
import { generatePlan, sampleRequest, type GeneratedPlan } from "./engine";

const familyOf = (crop: CropCode) =>
  CROPS.find((entry) => entry.code === crop)?.family ?? null;

const isLegume = (crop: CropCode) => familyOf(crop) === "legume";
const isCereal = (crop: CropCode) => familyOf(crop) === "cereal";

interface GoldenScenario {
  id: string;
  scenario: string;
  expected: string;
  input: Partial<RecommendationRequest>;
  options?: {
    startSeason?: "A" | "B";
    moistureClass?: "dry" | "normal" | "wet";
    dataAvailable?: boolean;
  };
  pass: (plan: GeneratedPlan, input: Partial<RecommendationRequest>) => boolean;
}

const scenarios: GoldenScenario[] = [
  {
    id: "GT-01",
    scenario: "Maize last season, restore soil",
    expected: "The first crop is a legume.",
    input: { previous_crops: ["maize"], goal: "restore_soil" },
    pass: (plan) => Boolean(plan.seasons[0] && isLegume(plan.seasons[0].crop)),
  },
  {
    id: "GT-02",
    scenario: "Legume last season, restore soil",
    expected: "The first crop is a cereal.",
    input: { previous_crops: ["soya"], goal: "restore_soil" },
    pass: (plan) => Boolean(plan.seasons[0] && isCereal(plan.seasons[0].crop)),
  },
  {
    id: "GT-03",
    scenario: "Striga present",
    expected: "No cereal is recommended for two seasons.",
    input: { previous_crops: ["maize"], flags: ["striga"] },
    pass: (plan) =>
      plan.seasons.slice(0, 2).every((season) => !isCereal(season.crop)),
  },
  {
    id: "GT-04",
    scenario: "Sunflower last season",
    expected: "Sunflower is excluded for two seasons.",
    input: { previous_crops: ["sunflower"] },
    pass: (plan) => plan.seasons.every((season) => season.crop !== "sunflower"),
  },
  {
    id: "GT-05",
    scenario: "Clay soil, cash goal in Season B",
    expected: "Simsim and cassava are excluded on clay.",
    input: {
      previous_crops: ["maize"],
      soil_type: "clay",
      goal: "max_cash",
    },
    options: { startSeason: "B" },
    pass: (plan) =>
      plan.seasons.every(
        (season) => season.crop !== "simsim" && season.crop !== "cassava",
      ),
  },
  {
    id: "GT-06",
    scenario: "Cassava already planted",
    expected: "Cassava is locked for two seasons with no rotation inside.",
    input: { previous_crops: ["cassava"], seasons: 2 },
    pass: (plan) =>
      plan.seasons.length === 2 &&
      plan.seasons.every((season) => season.crop === "cassava" && season.locked),
  },
  {
    id: "GT-07",
    scenario: "Dry season, Season A",
    expected: "Maize is excluded when the season is dry.",
    input: { previous_crops: ["maize"], goal: "drought_survival" },
    options: { moistureClass: "dry" },
    pass: (plan) => plan.seasons.every((season) => season.crop !== "maize"),
  },
  {
    id: "GT-08",
    scenario: "Wet season, cash goal in Season B",
    expected: "Simsim is excluded when the season is wet.",
    input: { previous_crops: ["maize"], goal: "max_cash" },
    options: { startSeason: "B", moistureClass: "wet" },
    pass: (plan) => plan.seasons.every((season) => season.crop !== "simsim"),
  },
  {
    id: "GT-09",
    scenario: "Loam soil, Season B, Normal moisture, maximise cash",
    expected: "Simsim is eligible and ranked first in Season B.",
    input: { previous_crops: ["maize"], soil_type: "loam", goal: "max_cash", seasons: 2 },
    options: { startSeason: "B", moistureClass: "normal" },
    pass: (plan) => plan.seasons[0]?.crop === "simsim",
  },
  {
    id: "GT-10",
    scenario: "Groundnut disease history",
    expected: "Groundnut is excluded for two seasons.",
    input: { previous_crops: ["maize"], flags: ["groundnut_disease"], seasons: 4 },
    pass: (plan) =>
      plan.seasons.slice(0, 2).every((season) => season.crop !== "groundnut"),
  },
  {
    id: "GT-11",
    scenario: "No data available",
    expected: "Normal gate assumed, notice shown, plan still produced.",
    input: { previous_crops: ["maize"], goal: "restore_soil", seasons: 2 },
    options: { dataAvailable: false },
    pass: (plan) =>
      plan.seasons.length >= 2 &&
      plan.seasons[0] !== undefined &&
      plan.seasons[0].warnings.some((w) => w.code === "plan.warningNoRecentData"),
  },
  {
    id: "GT-12",
    scenario: "Same inputs run twice",
    expected: "Identical output and identical pack version.",
    input: { previous_crops: ["maize"], goal: "restore_soil", seasons: 4 },
    pass: (_plan, input) => {
      const run1 = generatePlan(sampleRequest(input), {
        now: new Date("2026-11-14T08:00:00.000Z"),
        startSeason: "A",
        startYear: 2027,
        moistureClass: "normal",
      });
      const run2 = generatePlan(sampleRequest(input), {
        now: new Date("2026-11-14T08:00:00.000Z"),
        startSeason: "A",
        startYear: 2027,
        moistureClass: "normal",
      });
      return (
        run1.pack_version === run2.pack_version &&
        JSON.stringify(run1.seasons.map((s) => s.crop)) ===
          JSON.stringify(run2.seasons.map((s) => s.crop))
      );
    },
  },
];

export const runGoldenTests = (): GoldenTestResult[] =>
  scenarios.map((scenario) => {
    const plan = generatePlan(sampleRequest(scenario.input), {
      now: new Date("2026-11-14T08:00:00.000Z"),
      startSeason: scenario.options?.startSeason ?? "A",
      startYear: 2027,
      moistureClass: scenario.options?.moistureClass ?? "normal",
      dataAvailable: scenario.options?.dataAvailable,
    });
    const actual = plan.seasons.map((season) => season.crop).join(" → ");
    return {
      id: scenario.id,
      scenario: scenario.scenario,
      expected: scenario.expected,
      actual,
      pass: scenario.pass(plan, scenario.input),
    };
  });

export const goldenScenarios = scenarios.map(({ id, scenario, expected }) => ({
  id,
  scenario,
  expected,
}));

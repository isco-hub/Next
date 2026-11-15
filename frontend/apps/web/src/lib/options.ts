import {
  CROPS,
  type CropCode,
  type FlagCode,
  type Goal,
  type SoilType,
} from "@nextcrop/api-client";
import type { IconName } from "@nextcrop/ui";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
}

const CROP_ICONS: Record<CropCode, IconName> = {
  maize: "sprout",
  sorghum: "sprout",
  finger_millet: "sprout",
  soya: "leaf",
  groundnut: "leaf",
  bean: "leaf",
  cowpea: "leaf",
  simsim: "sprout",
  sunflower: "sun",
  cassava: "leaf",
  other: "leaf",
};

export const cropOptions = (t: Translate): Choice<CropCode>[] =>
  CROPS.map((crop) => ({
    value: crop.code,
    label: t(`common.crop.${crop.code}`),
  }));

export const cropIcon = (crop: CropCode): IconName => CROP_ICONS[crop] ?? "leaf";

export const soilOptions = (t: Translate): Choice<SoilType>[] => [
  { value: "sandy", label: t("wizard.soilSandy"), hint: t("wizard.soilSandyHint") },
  { value: "loam", label: t("wizard.soilLoam"), hint: t("wizard.soilLoamHint") },
  { value: "clay", label: t("wizard.soilClay"), hint: t("wizard.soilClayHint") },
  {
    value: "unknown",
    label: t("wizard.soilUnknown"),
    hint: t("wizard.soilUnknownHint"),
  },
];

export const goalOptions = (t: Translate): Choice<Goal>[] => [
  {
    value: "restore_soil",
    label: t("wizard.goalRestore"),
    hint: t("wizard.goalRestoreHint"),
  },
  { value: "max_cash", label: t("wizard.goalCash"), hint: t("wizard.goalCashHint") },
  {
    value: "drought_survival",
    label: t("wizard.goalDrought"),
    hint: t("wizard.goalDroughtHint"),
  },
];

export const flagOptions = (t: Translate): Choice<FlagCode>[] => [
  { value: "striga", label: t("wizard.flagStriga") },
  { value: "cassava_disease", label: t("wizard.flagCassava") },
  { value: "armyworm", label: t("wizard.flagArmyworm") },
  { value: "low_fertility", label: t("wizard.flagLowFertility") },
  { value: "groundnut_disease", label: t("wizard.flagGroundnut") },
];

export const seasonOptions = (t: Translate): Choice<number>[] =>
  [2, 3, 4, 5, 6].map((count) => ({
    value: count,
    label: t("wizard.seasonCount", { count }),
  }));

export const MOISTURE_KEY = {
  dry: "climate.moistureDry",
  normal: "climate.moistureNormal",
  wet: "climate.moistureWet",
} as const;

export const ONSET_KEY = {
  not_started: "climate.onsetNotStarted",
  onset_detected: "climate.onsetDetected",
  false_start_risk: "climate.onsetFalseStart",
  unknown: "climate.onsetUnknown",
} as const;

export const confidenceTone = (confidence: string): "success" | "warning" | "danger" =>
  confidence === "high" ? "success" : confidence === "medium" ? "warning" : "danger";


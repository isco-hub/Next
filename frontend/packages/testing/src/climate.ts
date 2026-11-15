import type {
  Confidence,
  MoistureClass,
  OnsetStatus,
  Outlook,
  OutlookNoticeCode,
  RainfallPoint,
  SeasonLetter,
} from "@nextcrop/api-client";
import { gridCellForPoint, type ResolvedLocation } from "@nextcrop/api-client";

export type DemoScenario = "normal" | "dry" | "wet" | "no_data" | "stale";

export interface ClimateOptions {
  now?: Date;
  scenario?: DemoScenario;
}

const DAY_MS = 86_400_000;

const round1 = (value: number) => Math.round(value * 10) / 10;

const hash = (value: string): number => {
  let hashValue = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hashValue ^= value.charCodeAt(index);
    hashValue = Math.imul(hashValue, 16_777_619);
  }
  return (hashValue >>> 0) / 4_294_967_295;
};

const startOfDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const isoDay = (value: Date): string => value.toISOString().slice(0, 10);

export const addDays = (value: Date, days: number): Date =>
  new Date(value.getTime() + days * DAY_MS);

export const dayOfYear = (value: Date): number => {
  const yearStart = Date.UTC(value.getUTCFullYear(), 0, 1);
  return Math.floor((value.getTime() - yearStart) / DAY_MS) + 1;
};

/** Lango has two rainy seasons; this curve gives a plausible daily normal. */
export const normalRainfall = (date: Date): number => {
  const day = dayOfYear(date);
  const peakA = Math.exp(-(((day - 112) / 24) ** 2));
  const peakB = Math.exp(-(((day - 266) / 24) ** 2));
  const shoulder = Math.exp(-(((day - 190) / 45) ** 2));
  return round1(0.7 + 10.4 * peakA + 8.2 * peakB + 0.9 * shoulder);
};

export type PlanningSeason = { season: SeasonLetter; year: number };

/**
 * Plans cover upcoming seasons. November-December looks ahead to Season A
 * of the following year because the B window has closed.
 */
export const seasonForPlanning = (now: Date): PlanningSeason => {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  if (month >= 11) return { season: "A", year: year + 1 };
  if (month <= 5) return { season: "A", year };
  return { season: "B", year };
};

const onset = (
  points: RainfallPoint[],
  scenario: DemoScenario,
): { status: OnsetStatus; date: string | null } => {
  if (scenario === "no_data") return { status: "unknown", date: null };
  if (scenario === "dry") return { status: "not_started", date: null };

  let eventDate: string | null = null;
  let eventIndex = -1;
  for (let index = 0; index <= points.length - 3; index += 1) {
    const window = points.slice(index, index + 3);
    const total = window.reduce((sum, point) => sum + point.actual_mm, 0);
    if (total >= 20) {
      eventDate = window[window.length - 1]?.date ?? null;
      eventIndex = index + 2;
      break;
    }
  }
  if (!eventDate || eventIndex < 0) return { status: "not_started", date: null };

  const after = points.slice(eventIndex + 1);
  const rainAfter = after.reduce((sum, point) => sum + point.actual_mm, 0);
  if (after.length >= 7 && rainAfter < 5) {
    return { status: "false_start_risk", date: eventDate };
  }
  return { status: "onset_detected", date: eventDate };
};

const drySpell = (points: RainfallPoint[]): { current: number; count: number } => {
  let current = 0;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if ((points[index]?.actual_mm ?? 0) >= 1) break;
    current += 1;
  }
  let count = 0;
  let run = 0;
  for (const point of points) {
    if (point.actual_mm < 1) {
      run += 1;
    } else {
      if (run >= 7) count += 1;
      run = 0;
    }
  }
  if (run >= 7) count += 1;
  return { current, count };
};

export const generateOutlook = (
  location: ResolvedLocation,
  options: ClimateOptions = {},
): Outlook => {
  const now = startOfDay(options.now ?? new Date());
  const scenario = options.scenario ?? "normal";
  const planning = seasonForPlanning(now);
  const points: RainfallPoint[] = [];

  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = addDays(now, -offset);
    const normal = normalRainfall(date);
    const noise = hash(
      `${location.grid_cell_id}:${isoDay(date)}:${location.district.id}`,
    );
    const shower = hash(`shower:${location.grid_cell_id}:${isoDay(date)}`);
    let factor = 0.35 + noise * 1.45;
    if (scenario === "dry") factor = 0.08 + noise * 0.15;
    if (scenario === "wet") factor = 1.35 + noise * 0.7;
    const rain = shower > 0.52 ? normal * factor : normal * factor * 0.12;
    points.push({
      date: isoDay(date),
      actual_mm: scenario === "no_data" ? 0 : round1(rain),
      normal_mm: normal,
    });
  }

  const actualTotal = round1(
    points.reduce((sum, point) => sum + point.actual_mm, 0),
  );
  const normalTotal = round1(points.reduce((sum, point) => sum + point.normal_mm, 0));
  const ratio = normalTotal > 0 ? actualTotal / normalTotal : 1;
  const moisture: MoistureClass =
    scenario === "no_data"
      ? "normal"
      : scenario === "dry" || ratio < 0.82
        ? "dry"
        : scenario === "wet" || ratio > 1.18
          ? "wet"
          : "normal";
  const onsetResult = onset(points, scenario);
  const spells = drySpell(points);
  const stale = scenario === "stale";
  const confidence: Confidence =
    scenario === "no_data"
      ? "low"
      : stale
        ? "medium"
        : onsetResult.status === "unknown"
          ? "medium"
          : "high";
  const noticeCode: OutlookNoticeCode | null =
    scenario === "no_data" ? "no_recent_data" : stale ? "stale_data" : null;
  const dataAge = scenario === "no_data" ? 0 : stale ? 72 : 6;

  return {
    grid_cell_id: location.grid_cell_id,
    district_id: location.district.id,
    subcounty_id: location.subcounty.id,
    computed_at: now.toISOString(),
    season: planning.season,
    moisture_class: moisture,
    onset_status: onsetResult.status,
    onset_date: onsetResult.date,
    dry_spell_days: scenario === "no_data" ? 0 : spells.current,
    dry_spells_count: scenario === "no_data" ? 0 : spells.count,
    confidence,
    data_age_hours: dataAge,
    data_available: scenario !== "no_data",
    data_sources:
      scenario === "no_data"
        ? []
        : ["NASA POWER (sample)", "NASA SMAP (sample)", "NASA IMERG (sample)"],
    rainfall_30d: scenario === "no_data" ? [] : points,
    rainfall_actual_total: scenario === "no_data" ? 0 : actualTotal,
    rainfall_normal_total: scenario === "no_data" ? 0 : normalTotal,
    seasonal_outlook: null,
    notice_code: noticeCode,
    notice: null,
    attribution:
      "Climate data: NASA POWER, NASA SMAP and NASA IMERG sample products. Regional guidance only.",
  };
};

export const sampleGridCell = (lat: number, lon: number): string =>
  gridCellForPoint({ lat, lon });

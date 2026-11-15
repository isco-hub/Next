import { describe, expect, it } from "vitest";
import { CROP_CODES, GOALS, SOILS } from "@nextcrop/api-client";
import { generatePlan, sampleRequest } from "./engine";
import { runGoldenTests } from "./golden";

describe("golden scenarios", () => {
  it("passes every agronomy scenario", () => {
    const results = runGoldenTests();
    expect(results).toHaveLength(12);
    expect(results.filter((result) => !result.pass)).toEqual([]);
    expect(results.map((result) => result.id)).toEqual([
      "GT-01",
      "GT-02",
      "GT-03",
      "GT-04",
      "GT-05",
      "GT-06",
      "GT-07",
      "GT-08",
      "GT-09",
      "GT-10",
      "GT-11",
      "GT-12",
    ]);
  });
});

describe("property tests", () => {
  const CROPS_SAMPLE = CROP_CODES;
  const NOW = new Date("2026-11-14T08:00:00.000Z");

  const runWith = (overrides: Parameters<typeof sampleRequest>[0]) =>
    generatePlan(sampleRequest(overrides), {
      now: NOW,
      startSeason: "A",
      startYear: 2027,
      moistureClass: "normal",
    });

  it("never produces an empty plan for any valid input combination", () => {
    for (const goal of GOALS) {
      for (const soil of SOILS) {
        for (const crop of CROPS_SAMPLE) {
          const plan = runWith({ previous_crops: [crop], goal, soil_type: soil, seasons: 2 });
          expect(plan.seasons.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("never recommends the same crop in two consecutive non-locked seasons", () => {
    for (const goal of GOALS) {
      for (const crop of CROPS_SAMPLE) {
        const plan = runWith({ previous_crops: [crop], goal, seasons: 6 });
        const nonLocked = plan.seasons.filter((s) => !s.locked);
        for (let i = 1; i < nonLocked.length; i += 1) {
          expect(nonLocked[i]?.crop).not.toBe(nonLocked[i - 1]?.crop);
        }
      }
    }
  });

  it("never violates hard rules: striga bans cereals for two seasons", () => {
    for (const crop of CROPS_SAMPLE) {
      const plan = runWith({ previous_crops: [crop], flags: ["striga"], seasons: 4 });
      const isCereal = (c: string) =>
        ["maize", "sorghum", "finger_millet"].includes(c);
      plan.seasons.slice(0, 2).forEach((s) => {
        expect(isCereal(s.crop)).toBe(false);
      });
    }
  });

  it("never violates hard rules: clay soil excludes simsim and cassava", () => {
    for (const goal of GOALS) {
      const plan = runWith({ previous_crops: ["maize"], soil_type: "clay", goal, seasons: 6 });
      plan.seasons.forEach((s) => {
        expect(s.crop).not.toBe("simsim");
        expect(s.crop).not.toBe("cassava");
      });
    }
  });

  it("never violates hard rules: dry moisture excludes maize", () => {
    for (const crop of CROPS_SAMPLE.filter((c) => c !== "cassava")) {
      const plan = generatePlan(sampleRequest({ previous_crops: [crop], seasons: 4 }), {
        now: NOW,
        startSeason: "A",
        startYear: 2027,
        moistureClass: "dry",
      });
      plan.seasons.forEach((s) => {
        expect(s.crop).not.toBe("maize");
      });
    }
  });

  it("never violates hard rules: wet moisture excludes simsim", () => {
    for (const crop of CROPS_SAMPLE.filter((c) => c !== "cassava")) {
      const plan = generatePlan(sampleRequest({ previous_crops: [crop], seasons: 4 }), {
        now: NOW,
        startSeason: "A",
        startYear: 2027,
        moistureClass: "wet",
      });
      plan.seasons.forEach((s) => {
        expect(s.crop).not.toBe("simsim");
      });
    }
  });
});

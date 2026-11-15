import { describe, expect, it } from "vitest";
import {
  MOISTURE_KEY,
  ONSET_KEY,
  confidenceTone,
  cropIcon,
  cropOptions,
  flagOptions,
  goalOptions,
  seasonOptions,
  soilOptions,
} from "./options";

const t = (key: string) => key;

describe("wizard option builders", () => {
  it("builds translated farmer choices", () => {
    expect(cropOptions(t)).toHaveLength(10);
    expect(cropOptions(t)[0]).toEqual({ value: "maize", label: "common.crop.maize" });
    expect(soilOptions(t).map((option) => option.value)).toEqual([
      "sandy",
      "loam",
      "clay",
      "unknown",
    ]);
    expect(goalOptions(t).map((option) => option.value)).toEqual([
      "restore_soil",
      "max_cash",
      "drought_survival",
    ]);
    expect(flagOptions(t).map((option) => option.value)).toEqual([
      "striga",
      "cassava_disease",
      "armyworm",
      "low_fertility",
      "groundnut_disease",
    ]);
    expect(seasonOptions(t).map((option) => option.value)).toEqual([2, 3, 4, 5, 6]);
  });

  it("maps crop icons and status tone", () => {
    expect(cropIcon("sunflower")).toBe("sun");
    expect(cropIcon("other")).toBe("leaf");
    expect(confidenceTone("high")).toBe("success");
    expect(confidenceTone("medium")).toBe("warning");
    expect(confidenceTone("low")).toBe("danger");
    expect(MOISTURE_KEY.wet).toBe("climate.moistureWet");
    expect(ONSET_KEY.unknown).toBe("climate.onsetUnknown");
  });
});

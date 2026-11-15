import { describe, expect, it } from "vitest";
import { countSmsSegments, isGsm7 } from "./sms";

describe("SMS segment counting", () => {
  it("accepts GSM-7 and counts extended characters twice", () => {
    expect(isGsm7("Plant maize?")).toBe(true);
    expect(isGsm7("Plant 🌽")).toBe(false);
    expect(countSmsSegments("")).toMatchObject({ encoding: "GSM-7", units: 0, segments: 0 });
    expect(countSmsSegments("€ and ^")).toMatchObject({
      encoding: "GSM-7",
      units: 9,
      segments: 1,
      extendedCharacters: 2,
    });
  });

  it("splits long GSM-7 messages at 153 characters", () => {
    const result = countSmsSegments("a".repeat(161));
    expect(result.segments).toBe(2);
    expect(result.perSegment).toBe(153);
    expect(result.remaining).toBe(145);
  });

  it("uses UCS-2 limits for non-GSM characters", () => {
    expect(countSmsSegments("🌽")).toMatchObject({
      encoding: "UCS-2",
      units: 2,
      segments: 1,
      perSegment: 70,
      remaining: 68,
    });
    expect(countSmsSegments("🌽".repeat(71)).segments).toBe(3);
  });
});

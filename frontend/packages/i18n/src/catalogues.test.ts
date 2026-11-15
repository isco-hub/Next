import { describe, expect, it } from "vitest";
import {
  englishKeys,
  englishMessages,
  flattenMessages,
  loadMessages,
} from "./catalogues";
import {
  DEFAULT_LOCALE,
  FORMAT_LOCALE,
  LANGUAGE_TAG,
  SUPPORTED_LOCALES,
  isLocale,
} from "./status";
import {
  isPseudoEnabled,
  pseudoLocalize,
  setPseudoEnabled,
} from "./pseudo";

describe("translation catalogues", () => {
  it("flattens nested strings while ignoring metadata and non-strings", () => {
    expect(
      flattenMessages({
        _meta: "ignore",
        a: { b: "hello", c: { d: "world" } },
        n: 4,
        list: ["not", "flat"],
      }),
    ).toEqual({ "a.b": "hello", "a.c.d": "world" });
  });

  it("merges all English domains", async () => {
    expect(englishMessages["nav.home"]).toBeTruthy();
    expect(englishKeys).toContain("common.count");
    await expect(loadMessages("en")).resolves.toBe(englishMessages);
  });
});

describe("locale metadata", () => {
  it("supports English only", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LANGUAGE_TAG.en).toBe("en-UG");
    expect(FORMAT_LOCALE.en).toBe("en-UG");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("laj")).toBe(false);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("pseudo-localisation", () => {
  it("accentuates vowels, pads and wraps text", () => {
    expect(pseudoLocalize("  ")).toBe("  ");
    expect(pseudoLocalize("Next crop")).toMatch(/^⟦Néxt cróp ·+⟧$/);
    expect(pseudoLocalize("Déjà")).toBe("⟦Déjà⟧");
  });

  it("reads the URL flag and persists the preference", () => {
    window.history.replaceState({}, "", "/?pseudo=1");
    expect(isPseudoEnabled()).toBe(true);
    window.history.replaceState({}, "", "/");
    expect(isPseudoEnabled()).toBe(false);
    setPseudoEnabled(true);
    expect(isPseudoEnabled()).toBe(true);
    setPseudoEnabled(false);
    expect(isPseudoEnabled()).toBe(false);
  });
});

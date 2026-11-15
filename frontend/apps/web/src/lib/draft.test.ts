import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDrafts,
  readLocationDraft,
  readWizardDraft,
  saveLocationDraft,
  saveWizardDraft,
} from "./draft";

beforeEach(() => {
  window.localStorage.clear();
});

describe("farmer drafts", () => {
  it("returns empty defaults before the farmer starts", () => {
    expect(readLocationDraft()).toBeNull();
    expect(readWizardDraft("en")).toEqual({
      previous_crops: [],
      soil_type: null,
      goal: null,
      flags: [],
      seasons: 4,
      language: "en",
    });
  });

  it("saves and restores location and wizard answers", () => {
    saveLocationDraft({ district_id: "dokolo", subcounty_id: "dokolo" });
    saveWizardDraft({
      previous_crops: ["maize"],
      soil_type: "clay",
      goal: "restore_soil",
      flags: ["striga"],
      seasons: 5,
      language: "en",
    });
    expect(readLocationDraft()).toEqual({ district_id: "dokolo", subcounty_id: "dokolo" });
    expect(readWizardDraft("en")).toMatchObject({
      previous_crops: ["maize"],
      soil_type: "clay",
      goal: "restore_soil",
      seasons: 5,
    });
  });

  it("ignores corrupted storage and can clear drafts", () => {
    window.localStorage.setItem("nextcrop.draft.location.v1", "{bad");
    expect(readLocationDraft()).toBeNull();
    saveLocationDraft({ lat: 1 });
    clearDrafts();
    expect(readLocationDraft()).toBeNull();
    expect(readWizardDraft("en").seasons).toBe(4);
  });
});

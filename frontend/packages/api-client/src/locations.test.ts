import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  REGION_CENTRE,
  containsPoint,
  findSubcounty,
  nearestSubcounty,
  resolveLocation,
} from "./locations";

describe("location helpers", () => {
  it("keeps the supported region centre inside the polygon", () => {
    expect(containsPoint(REGION_CENTRE)).toBe(true);
  });

  it("rejects a point far outside the Lango region", () => {
    expect(containsPoint({ lat: 0.3, lon: 32.6 })).toBe(false);
  });

  it("resolves a known sub-county and its district", () => {
    const first = DISTRICTS[0]?.subcounties[0];
    expect(first).toBeDefined();
    const resolved = resolveLocation({ subcounty_id: first?.id });
    expect(resolved.subcounty.id).toBe(first?.id);
    expect(resolved.district.id).toBe(first?.district_id);
    expect(resolved.point.lat).toBeCloseTo(first?.lat ?? 0);
  });

  it("finds the nearest sub-county to the region centre", () => {
    const nearest = nearestSubcounty(REGION_CENTRE);
    expect(findSubcounty(nearest.id)).toBeDefined();
    expect(nearest.district_id).toBeTruthy();
  });

  it("falls back safely when no location is supplied", () => {
    const resolved = resolveLocation({});
    expect(resolved.district.id).toBeTruthy();
    expect(resolved.subcounty.id).toBeTruthy();
    expect(resolved.grid_cell_id).toMatch(/^LC--?\d+\.\d+-\d+\.\d+$/);
  });
});

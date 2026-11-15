import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrefsProvider, usePrefs } from "./prefs";

const wrapper = ({ children }: { children: ReactNode }) => (
  <PrefsProvider>{children}</PrefsProvider>
);

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.lowData;
  delete document.documentElement.dataset.largerText;
});

describe("PrefsProvider", () => {
  it("starts with defaults and persists display preferences", async () => {
    const { result } = renderHook(() => usePrefs(), { wrapper });
    expect(result.current.lowData).toBe(false);
    expect(result.current.largerText).toBe(false);
    act(() => {
      result.current.setLowData(true);
      result.current.setLargerText(true);
    });
    await waitFor(() => {
      expect(document.documentElement.dataset.lowData).toBe("true");
      expect(document.documentElement.dataset.largerText).toBe("true");
    });
    expect(JSON.parse(window.localStorage.getItem("nextcrop.prefs.v1") ?? "{}")).toEqual({
      lowData: true,
      largerText: true,
      quietFrom: "21:00",
      quietTo: "06:00",
      smsAlerts: true,
    });
  });

  it("reads stored preferences and ignores corrupt data", () => {
    window.localStorage.setItem(
      "nextcrop.prefs.v1",
      JSON.stringify({ lowData: true }),
    );
    const { result, unmount } = renderHook(() => usePrefs(), { wrapper });
    expect(result.current.lowData).toBe(true);
    expect(result.current.largerText).toBe(false);
    unmount();
    window.localStorage.setItem("nextcrop.prefs.v1", "{bad");
    const next = renderHook(() => usePrefs(), { wrapper });
    expect(next.result.current.lowData).toBe(false);
  });

  it("requires the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => usePrefs())).toThrow(
      "usePrefs must be used inside PrefsProvider",
    );
    spy.mockRestore();
  });
});

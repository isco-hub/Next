import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "./index";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider markFallback={true}>
    {children}
  </I18nProvider>
);

beforeEach(() => {
  window.localStorage.clear();
});

describe("I18nProvider", () => {
  it("translates, interpolates and formats values", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("en");
    expect(result.current.t("welcome.title")).toBe("Know what to plant next");
    expect(result.current.t("wizard.seasonCount", { count: 4 })).toContain("4");
    expect(result.current.t("not.a.real.key")).toBe("⟦not.a.real.key⟧");
    expect(result.current.formatDate("2026-11-14")).toContain("2026");
    expect(result.current.formatDateTime("2026-11-14T08:30:00Z")).toContain("2026");
    expect(result.current.formatNumber(1234)).toBe("1,234");
    expect(document.documentElement.lang).toBe("en-UG");
  });

  it("applies pseudo-localisation at runtime", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setPseudo(true);
    });
    expect(result.current.pseudo).toBe(true);
    expect(result.current.t("welcome.title")).toMatch(/^⟦/);
  });

  it("requires the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useI18n())).toThrow(
      "useI18n must be used inside I18nProvider",
    );
    spy.mockRestore();
  });
});

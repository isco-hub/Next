import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "./install";

const installEvent = (outcome: "accepted" | "dismissed") => {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  return event;
};

describe("useInstallPrompt", () => {
  it("captures the browser prompt and reports the choice", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    act(() => {
      window.dispatchEvent(installEvent("accepted"));
    });
    expect(result.current.canInstall).toBe(true);
    await act(async () => {
      await expect(result.current.install()).resolves.toBe(true);
    });
    expect(result.current.canInstall).toBe(false);
  });

  it("returns false when the prompt has not fired or is dismissed", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    await expect(result.current.install()).resolves.toBe(false);
    act(() => {
      window.dispatchEvent(installEvent("dismissed"));
    });
    await act(async () => {
      await expect(result.current.install()).resolves.toBe(false);
    });
  });

  it("clears the prompt after installation", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(installEvent("accepted"));
    });
    expect(result.current.canInstall).toBe(true);
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.canInstall).toBe(false);
  });
});

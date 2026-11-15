import type { Session, User } from "@nextcrop/api-client";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";
import { api } from "./api";
import { readSession, writeSession } from "./session";

vi.mock("./api", () => ({
  demoMode: true,
  api: {
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
  },
}));

const user: User = {
  id: "u1",
  role: "farmer",
  display_name: null,
  language: "en",
  district_id: null,
  subcounty_ids: [],
  consent_version: null,
  mfa_required: false,
};

const session: Session = {
  token: "token-1",
  refresh_token: "refresh-1",
  user,
  expires_at: "2030-01-01T00:00:00.000Z",
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("signs in with OTP, persists the session and answers role checks", async () => {
    vi.mocked(api.requestOtp).mockResolvedValue({ request_id: "req-1", expires_in_seconds: 300, channel: "sms" });
    vi.mocked(api.verifyOtp).mockResolvedValue(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.session).toBeNull();
    let returned: Session | null = null;
    await act(async () => {
      returned = await result.current.signIn("+256770000003", "123456");
    });
    expect(returned).toEqual(session);
    expect(result.current.user?.id).toBe("u1");
    expect(result.current.can("farmer", "admin")).toBe(true);
    expect(result.current.can("admin")).toBe(false);
    expect(readSession()).toEqual(session);
    expect(result.current.busy).toBe(false);
  });

  it("restores, completes, updates and clears a session", async () => {
    writeSession(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user?.id).toBe("u1");

    act(() => {
      result.current.updateUser({ ...user, display_name: "Aciro" });
    });
    expect(result.current.user?.display_name).toBe("Aciro");

    act(() => {
      result.current.completeSignIn({ ...session, token: "token-2" });
    });
    expect(readSession()?.token).toBe("token-2");

    vi.mocked(api.signOut).mockRejectedValue(new Error("offline"));
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.session).toBeNull();
    expect(readSession()).toBeNull();
  });

  it("keeps the previous busy state after a failed sign-in", async () => {
    vi.mocked(api.requestOtp).mockRejectedValue(new Error("rate limited"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await expect(result.current.signIn("+256", "123456")).rejects.toThrow("rate limited");
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it("requires the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used inside AuthProvider",
    );
    spy.mockRestore();
  });
});

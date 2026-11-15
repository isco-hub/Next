import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, currentToken, readSession, writeSession } from "./session";

const session = {
  token: "token-1",
  refresh_token: "refresh-1",
  expires_at: "2030-01-01T00:00:00.000Z",
  user: {
    id: "u1",
    role: "farmer" as const,
    display_name: null,
    language: "en" as const,
    district_id: null,
    subcounty_ids: [],
    consent_version: null,
    mfa_required: false,
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("session storage", () => {
  it("persists and reads a valid session", () => {
    expect(readSession()).toBeNull();
    writeSession(session);
    expect(readSession()).toEqual(session);
    expect(currentToken()).toBe("token-1");
  });

  it("rejects malformed or partial sessions", () => {
    window.localStorage.setItem("nextcrop.session.v1", "not json");
    expect(readSession()).toBeNull();
    window.localStorage.setItem("nextcrop.session.v1", JSON.stringify({ token: "x" }));
    expect(readSession()).toBeNull();
    window.localStorage.setItem("nextcrop.session.v1", JSON.stringify({ user: session.user }));
    expect(readSession()).toBeNull();
  });

  it("clears the session", () => {
    writeSession(session);
    clearSession();
    expect(readSession()).toBeNull();
    expect(currentToken()).toBeNull();
  });
});

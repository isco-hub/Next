import type { Session } from "@nextcrop/api-client";

const STORAGE_KEY = "nextcrop.session.v1";

export const readSession = (): Session | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.token || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeSession = (session: Session): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A session that cannot be persisted still works for this tab.
  }
};

export const clearSession = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const currentToken = (): string | null => readSession()?.token ?? null;

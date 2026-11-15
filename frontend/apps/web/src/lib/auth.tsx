import type { OtpVerifyResult, Role, Session, User } from "@nextcrop/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, demoMode } from "./api";
import { clearSession, readSession, writeSession } from "./session";

export interface SignUpInput {
  phone: string;
  displayName: string;
  role?: Role;
  districtId?: string;
  constituencyId?: string;
  subcountyIds?: string[];
}

const isSession = (result: OtpVerifyResult): result is Session =>
  "token" in result;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  busy: boolean;
  signIn: (phone: string, code: string) => Promise<Session>;
  signUp: (input: SignUpInput, code: string) => Promise<Session>;
  completeSignIn: (session: Session) => void;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  can: (...roles: Role[]) => boolean;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async (phone: string, code: string) => {
    setBusy(true);
    try {
      const request = await api.requestOtp({ phone, purpose: "signin" });
      const next = await api.verifyOtp(request.request_id, code);
      if (!isSession(next)) throw new Error(next.message);
      writeSession(next);
      setSession(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, []);

  const signUp = useCallback(async (input: SignUpInput, code: string) => {
    setBusy(true);
    try {
      const request = await api.requestOtp({
        phone: input.phone,
        purpose: "signup",
        role: input.role,
        display_name: input.displayName,
        language: "en",
        district_id: input.districtId,
        constituency_id: input.constituencyId,
        subcounty_ids: input.subcountyIds ?? [],
      });
      const next = await api.verifyOtp(request.request_id, code);
      if (!isSession(next)) throw new Error(next.message);
      writeSession(next);
      setSession(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const current = readSession();
    if (!current?.refresh_token) return null;
    try {
      const next = await api.refreshSession(current.refresh_token);
      writeSession(next);
      setSession(next);
      return next;
    } catch {
      clearSession();
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (demoMode) return;
    const current = readSession();
    if (!current) return;
    let cancelled = false;
    void (async () => {
      try {
        const user = await api.getMe();
        if (!cancelled) {
          setSession((prev) => {
            if (!prev) return prev;
            const next = { ...prev, user };
            writeSession(next);
            return next;
          });
        }
      } catch {
        if (!cancelled) await refreshSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const completeSignIn = useCallback((next: Session) => {
    writeSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // Signing out locally matters more than the server acknowledgement.
    }
    clearSession();
    setSession(null);
  }, []);

  const updateUser = useCallback((user: User) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user };
      writeSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      busy,
      signIn,
      signUp,
      completeSignIn,
      signOut,
      refreshSession,
      can: (...roles: Role[]) => Boolean(session && roles.includes(session.user.role)),
      updateUser,
    }),
    [
      session,
      busy,
      signIn,
      signUp,
      completeSignIn,
      signOut,
      refreshSession,
      updateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};


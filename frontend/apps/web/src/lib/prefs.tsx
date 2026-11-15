import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "nextcrop.prefs.v1";

interface Prefs {
  lowData: boolean;
  largerText: boolean;
  smsAlerts: boolean;
  quietFrom: string;
  quietTo: string;
}

interface PrefsContextValue extends Prefs {
  setLowData: (enabled: boolean) => void;
  setLargerText: (enabled: boolean) => void;
  setSmsAlerts: (enabled: boolean) => void;
  setQuietHours: (from: string, to: string) => void;
}

const defaults: Prefs = { lowData: false, largerText: false, smsAlerts: true, quietFrom: "21:00", quietTo: "06:00" };

const readPrefs = (): Prefs => {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return defaults;
  }
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

export const PrefsProvider = ({ children }: { children: ReactNode }) => {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Preferences are a convenience only.
    }
    document.documentElement.dataset.lowData = prefs.lowData ? "true" : "false";
    document.documentElement.dataset.largerText = prefs.largerText ? "true" : "false";
  }, [prefs]);

  const setLowData = useCallback((lowData: boolean) => {
    setPrefs((current) => ({ ...current, lowData }));
  }, []);
  const setLargerText = useCallback((largerText: boolean) => {
    setPrefs((current) => ({ ...current, largerText }));
  }, []);
  const setSmsAlerts = useCallback((smsAlerts: boolean) => {
    setPrefs((current) => ({ ...current, smsAlerts }));
  }, []);
  const setQuietHours = useCallback((quietFrom: string, quietTo: string) => {
    setPrefs((current) => ({ ...current, quietFrom, quietTo }));
  }, []);

  const value = useMemo<PrefsContextValue>(
    () => ({ ...prefs, setLowData, setLargerText, setSmsAlerts, setQuietHours }),
    [prefs, setLowData, setLargerText, setSmsAlerts, setQuietHours],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
};

export const usePrefs = (): PrefsContextValue => {
  const context = useContext(PrefsContext);
  if (!context) throw new Error("usePrefs must be used inside PrefsProvider");
  return context;
};


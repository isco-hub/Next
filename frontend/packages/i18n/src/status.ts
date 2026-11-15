export type Locale = "en";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en"] as const;

export const DEFAULT_LOCALE: Locale = "en";

export const LANGUAGE_TAG: Record<Locale, string> = {
  en: "en-UG",
};

export const FORMAT_LOCALE: Record<Locale, string> = {
  en: "en-UG",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);


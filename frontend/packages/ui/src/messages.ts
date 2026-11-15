import { englishMessages } from "@nextcrop/i18n";

export type Translate = (
  key: string,
  values?: Record<string, string | number | Date | boolean>,
) => string;

/**
 * Server-provided keys are only used when the catalogue actually knows them.
 * Unknown keys fall back to the server-provided text instead of exposing a key.
 */
export const translatedOr = (
  t: Translate,
  key: string | undefined,
  fallback: string | undefined,
): string | undefined => {
  if (key && englishMessages[key] !== undefined) return t(key);
  return fallback;
};

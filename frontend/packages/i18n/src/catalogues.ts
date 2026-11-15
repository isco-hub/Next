import admin from "./catalogues/en/admin.json";
import common from "./catalogues/en/common.json";
import farmer from "./catalogues/en/farmer.json";
import officer from "./catalogues/en/officer.json";
import ussd from "./catalogues/en/ussd.json";
import type { Locale } from "./status";

export type Messages = Record<string, string>;

const merge = (...sources: Record<string, unknown>[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith("_")) continue;
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        result[key] &&
        typeof result[key] === "object"
      ) {
        result[key] = merge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result;
};

export const flattenMessages = (
  value: Record<string, unknown>,
  prefix = "",
  out: Messages = {},
): Messages => {
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith("_")) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      flattenMessages(entry as Record<string, unknown>, fullKey, out);
    } else if (typeof entry === "string") {
      out[fullKey] = entry;
    }
  }
  return out;
};

export const englishMessages: Messages = flattenMessages(
  merge(common, farmer, officer, admin, ussd),
);

export const loadMessages = async (_locale: Locale): Promise<Messages> => {
  return englishMessages;
};

export const englishKeys = Object.keys(englishMessages);

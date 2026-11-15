#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";

const root = join(process.cwd(), "packages/i18n/src/catalogues");
const enDir = join(root, "en");

const flatten = (value, prefix = "", out = {}) => {
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith("_")) continue;
    const full = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      flatten(entry, full, out);
    } else if (typeof entry === "string") {
      out[full] = entry;
    }
  }
  return out;
};

const enRaw = {};
for (const file of readdirSync(enDir).filter((name) => name.endsWith(".json"))) {
  const document = JSON.parse(readFileSync(join(enDir, file), "utf8"));
  for (const [key, value] of Object.entries(document)) {
    enRaw[key] = { ...(enRaw[key] ?? {}), ...(value ?? {}) };
  }
}

const en = flatten(enRaw);
const problems = [];
const placeholderPattern = /\b(TODO|TBD|FIXME|translate me|placeholder|lorem ipsum)\b/i;

for (const [key, value] of Object.entries(en)) {
  if (!value.trim()) problems.push(`en: ${key} is empty`);
  if (placeholderPattern.test(value)) problems.push(`en: ${key} contains placeholder text`);
  try {
    new IntlMessageFormat(value, "en");
  } catch (error) {
    problems.push(`en: ${key} has invalid ICU syntax (${error.message})`);
  }
}

console.log(`i18n check: ${Object.keys(en).length} English keys`);

if (problems.length) {
  console.error("\nProblems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const dist = join(process.cwd(), "apps/web/dist");
const manifestPath = join(dist, ".vite/manifest.json");

const KB = 1024;
const budgets = {
  initial: 200 * KB,
  targetInitial: 150 * KB,
  map: 70 * KB,
  plan: 45 * KB,
  catalog: 20 * KB,
  dashboard: 100 * KB,
  admin: 300 * KB,
};

const gzipSize = (file) => {
  const path = join(dist, file);
  if (!existsSync(path)) return 0;
  return gzipSync(readFileSync(path)).length;
};

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

if (!existsSync(manifestPath)) {
  console.error("Bundle budget: dist/.vite/manifest.json not found. Run the build first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entries = Object.entries(manifest);
const entry = entries.find(([, chunk]) => chunk.isEntry);
if (!entry) {
  console.error("Bundle budget: no entry chunk found in the build manifest.");
  process.exit(1);
}

const seen = new Set();
const initialFiles = new Set();
const collectStatic = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  if (chunk.file?.endsWith(".js") || chunk.file?.endsWith(".css")) {
    initialFiles.add(chunk.file);
  }
  for (const imported of chunk.imports ?? []) collectStatic(imported);
  for (const css of chunk.css ?? []) initialFiles.add(css);
};
collectStatic(entry[0]);

let initialBytes = 0;
for (const file of initialFiles) {
  if (file.endsWith(".js")) initialBytes += gzipSize(file);
}

const named = (matcher) =>
  entries
    .filter(([key, chunk]) => matcher(key, chunk.file ?? ""))
    .reduce((sum, [, chunk]) => sum + gzipSize(chunk.file ?? ""), 0);

const groups = [
  ["map", named((key, file) => /location|map|leaflet/i.test(`${key} ${file}`))],
  ["plan", named((key, file) => /plan|chart|climate/i.test(`${key} ${file}`))],
  ["catalog", named((key, file) => /catalogue|locale|i18n/i.test(`${key} ${file}`))],
  ["dashboard", named((key, file) => /officer|dashboard|ussd/i.test(`${key} ${file}`))],
  ["admin", named((key, file) => /admin|console|editor/i.test(`${key} ${file}`))],
];

console.log("Bundle budget (gzipped)");
console.log(`  initial:   ${kb(initialBytes)} / ${kb(budgets.initial)} hard limit (target ${kb(budgets.targetInitial)})`);
for (const [name, bytes] of groups) {
  if (bytes > 0) {
    console.log(`  ${name.padEnd(9)}  ${kb(bytes)} / ${kb(budgets[name])}`);
  }
}

let failed = false;
if (initialBytes > budgets.initial) {
  console.error(`FAIL initial bundle ${kb(initialBytes)} exceeds ${kb(budgets.initial)} (NFR-PERF-03)`);
  failed = true;
}
if (initialBytes > budgets.targetInitial) {
  console.warn(`WARN initial bundle is above the ${kb(budgets.targetInitial)} target (hard limit still met)`);
}
for (const [name, bytes] of groups) {
  if (bytes > budgets[name]) {
    console.error(`FAIL ${name} chunk ${kb(bytes)} exceeds ${kb(budgets[name])}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);

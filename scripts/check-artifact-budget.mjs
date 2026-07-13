import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const args = new Map(process.argv.slice(2).reduce((pairs, item, index, values) => {
  if (item.startsWith("--")) pairs.push([item, values[index + 1]]);
  return pairs;
}, []));
const distPath = resolve(process.cwd(), args.get("--dist") || "dist");
const baselinePath = resolve(process.cwd(), args.get("--baseline") || "tests/budgets/v2-artifact-baseline.json");
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const files = await collectFiles(distPath);
const totals = { raw: 0, gzip: 0 };

for (const file of files) {
  const contents = await readFile(file);
  totals.raw += contents.byteLength;
  totals.gzip += gzipSync(contents).byteLength;
}

if (totals.raw > baseline.maximum.raw || totals.gzip > baseline.maximum.gzip) {
  throw new Error(`V2 artifact budget exceeded: ${totals.raw} B raw / ${totals.gzip} B gzip; maximum ${baseline.maximum.raw} / ${baseline.maximum.gzip}.`);
}
console.log(`V2 artifact budget verified: ${totals.raw} B raw / ${totals.gzip} B gzip.`);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return files.flat();
}

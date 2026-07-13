import {readFile, readdir} from "node:fs/promises";
import {resolve} from "node:path";
import {gzipSync} from "node:zlib";

const appRoot = resolve(import.meta.dirname, "..");
const policy = JSON.parse(await readFile(resolve(appRoot, "tests/budgets/v3-artifact-budget.json"), "utf8"));
const files = await collectRuntimeFiles(resolve(appRoot, "dist"));
const totals = {raw: 0, gzip: 0};

for (const file of files) {
  const contents = await readFile(file);
  totals.raw += contents.byteLength;
  totals.gzip += gzipSync(contents).byteLength;
}

if (totals.raw > policy.maximum.raw || totals.gzip > policy.maximum.gzip) {
  throw new Error(
    `V3 artifact budget exceeded: ${totals.raw} B raw / ${totals.gzip} B gzip; maximum ${policy.maximum.raw} / ${policy.maximum.gzip}.`,
  );
}

console.log(`V3 artifact budget verified: ${totals.raw} B raw / ${totals.gzip} B gzip across ${files.length} runtime files.`);

async function collectRuntimeFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectRuntimeFiles(path);
    // Source maps are deliberately not deployed. If re-enabled later, they are
    // operational artifacts rather than initial browser runtime bytes.
    return entry.name.endsWith(".map") ? [] : [path];
  }));
  return nested.flat();
}

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const forbidden = ["@kepler.gl", "deck.gl", "maplibre-gl", "@loaders.gl", "duckdb", "parquet"];
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const rootLock = await readFile(resolve(root, "package-lock.json"), "utf8");
const manifestNames = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
const manifestHits = manifestNames.filter((name) => forbidden.some((item) => name.toLowerCase().includes(item)));
const lockHits = forbidden.filter((item) => rootLock.toLowerCase().includes(item));
const sourceHits = [];

for (const file of await collectFiles(resolve(root, "src"))) {
  const contents = await readFile(file, "utf8");
  const hits = forbidden.filter((item) => contents.toLowerCase().includes(item));
  if (hits.length) sourceHits.push(`${file.replace(`${root}/`, "")}: ${hits.join(", ")}`);
}

if (Array.isArray(packageJson.workspaces) || packageJson.workspaces) {
  throw new Error("Root npm workspaces are forbidden: V3 must retain its independent lockfile.");
}
if (manifestHits.length || lockHits.length || sourceHits.length) {
  throw new Error([
    manifestHits.length ? `Root manifest imports V3 packages: ${manifestHits.join(", ")}` : "",
    lockHits.length ? `Root lockfile contains V3 packages: ${lockHits.join(", ")}` : "",
    sourceHits.length ? `V2 source imports V3 packages: ${sourceHits.join("; ")}` : "",
  ].filter(Boolean).join("\n"));
}

console.log("V2 isolation verified: root manifest, lockfile, and src contain no Kepler/deck/MapLibre/loader packages.");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return files.flat();
}

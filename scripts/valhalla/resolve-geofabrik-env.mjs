import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const profiles = {
  "capital-region": {
    source: "capital-region.env",
    output: ".resolved-capital-region.env",
  },
  "ny-nj": {
    source: "ny-nj.env",
    output: ".resolved-ny-nj.env",
  },
  "jersey-city-nyc": {
    source: "jersey-city-nyc.env",
    output: ".resolved-jersey-city-nyc.env",
  },
};

const profileName = process.argv[2] || "capital-region";
const profile = profiles[profileName];

if (!profile) {
  console.error(
    `Unknown Valhalla profile '${profileName}'. Use one of: ${Object.keys(profiles).join(", ")}`,
  );
  process.exit(1);
}

async function resolveUrl(url) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Could not resolve ${url}: ${response.status} ${response.statusText}`);
  }

  return response.url;
}

const sourcePath = join(scriptDir, profile.source);
const outputPath = join(scriptDir, profile.output);
const source = await readFile(sourcePath, "utf8");
const lines = source.split(/\r?\n/);
const tileLine = lines.find((line) => line.startsWith("VALHALLA_TILE_URLS="));

if (!tileLine) {
  throw new Error(`${profile.source} is missing VALHALLA_TILE_URLS.`);
}

const urls = tileLine
  .replace("VALHALLA_TILE_URLS=", "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const resolvedUrls = await Promise.all(urls.map(resolveUrl));
const output = lines
  .map((line) =>
    line.startsWith("VALHALLA_TILE_URLS=")
      ? `VALHALLA_TILE_URLS=${resolvedUrls.join(",")}`
      : line,
  )
  .join("\n");

await mkdir(scriptDir, { recursive: true });
await writeFile(outputPath, output.endsWith("\n") ? output : `${output}\n`);

console.log(`Resolved ${profileName} Valhalla extract URLs:`);
for (const url of resolvedUrls) {
  console.log(`- ${url}`);
}
console.log(`Wrote ${outputPath}`);

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repositoryRoot = resolve(appRoot, "../..");
const [manifestText, v2Netlify, v3Netlify] = await Promise.all([
  readFile(resolve(appRoot, "package.json"), "utf8"),
  readFile(resolve(repositoryRoot, "netlify.toml"), "utf8"),
  readFile(resolve(appRoot, "netlify.toml"), "utf8"),
]);
const manifest = JSON.parse(manifestText);
for (const packageName of Object.keys(manifest.dependencies || {})) {
  if (packageName.startsWith("@kepler.gl/") || packageName.startsWith("@hubble.gl/") || ["redux", "react-redux", "styled-components"].includes(packageName)) {
    throw new Error(`${packageName} is prohibited from the purpose-built V3 runtime.`);
  }
}
if (manifest.dependencies?.["maplibre-gl"] !== "5.24.0") throw new Error("MapLibre must remain pinned to 5.24.0.");
for (const packageName of ["@deck.gl/core", "@deck.gl/layers", "@deck.gl/aggregation-layers", "@deck.gl/mapbox"]) {
  if (manifest.dependencies?.[packageName] !== "9.3.6") throw new Error(`${packageName} must remain pinned to 9.3.6.`);
}
if (/from\s*=\s*"\/v3(?:\/|"|\*)/i.test(v2Netlify)) {
  throw new Error("The V2 Netlify site must not route or publish the V3 alpha.");
}
if (!/Content-Security-Policy\s*=/.test(v3Netlify) || /unsafe-eval/i.test(v3Netlify)) {
  throw new Error("The V3 preview site must define a strict CSP without unsafe-eval.");
}
const csp = v3Netlify.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
if (!csp) throw new Error("The V3 CSP header value could not be parsed.");
for (const directive of ["connect-src", "img-src"]) {
  const value = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${directive} `));
  const remoteOrigins = [...new Set((value?.match(/https:\/\/[^\s;]+/g) ?? []).map((url) => new URL(url).origin))];
  if (JSON.stringify(remoteOrigins) !== JSON.stringify(["https://tiles.openfreemap.org"])) {
    throw new Error(`${directive} must allow exactly the approved OpenFreeMap remote origin.`);
  }
}
if (!/publish\s*=\s*"dist"/.test(v3Netlify)) {
  throw new Error("The V3 site must retain its own build output.");
}
const frameSrc = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("frame-src "));
if (frameSrc !== "frame-src https://mapgap-access.netlify.app") {
  throw new Error("frame-src must allow only the exact deployed V2 origin.");
}
const v2HeaderBlocks = v2Netlify.split(/(?=\[\[headers\]\])/g);
for (const route of ["/v2", "/v2/*"]) {
  const block = v2HeaderBlocks.find((candidate) => {
    const configuredPath = candidate.match(/\bfor\s*=\s*"([^"]+)"/)?.[1];
    return configuredPath === route;
  });
  const value = block?.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
  if (value !== "frame-ancestors 'self' https://mapgap-v3-preview.netlify.app") {
    throw new Error(`${route} must allow framing only by itself and the exact deployed V3 origin.`);
  }
}

console.log("V3 boundary policy verified: direct renderer pins, no generic-workbench runtime, separate site config, and exact two-sided CSP origins.");

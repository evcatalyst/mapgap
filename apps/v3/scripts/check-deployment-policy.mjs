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
const keplerPackages = [
  "@kepler.gl/actions",
  "@kepler.gl/components",
  "@kepler.gl/processors",
  "@kepler.gl/reducers",
];
const forkRelease =
  "https://github.com/evcatalyst/kepler.gl/releases/download/mapgap-v3.0.0-alpha.1/";

for (const packageName of keplerPackages) {
  if (!manifest.dependencies?.[packageName]?.startsWith(forkRelease)) {
    throw new Error(`${packageName} must pin the immutable public MapGap fork prerelease.`);
  }
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

console.log("V3 boundary policy verified: immutable fork release, separate site config, no V2 /v3 route, strict CSP with one approved basemap origin.");

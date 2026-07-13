import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const disposition = JSON.parse(
  await readFile(resolve(appRoot, "security/audit-disposition.json"), "utf8"),
);

if (disposition.status !== "internal-alpha") {
  throw new Error("The V3 audit policy expects the internal-alpha status.");
}
if (!disposition.owner || !disposition.reviewBy || !Array.isArray(disposition.constraints)) {
  throw new Error("The V3 audit disposition must name an owner, review date, and constraints.");
}
if (new Date(`${disposition.reviewBy}T23:59:59.999Z`) < new Date()) {
  throw new Error(`The V3 audit disposition expired on ${disposition.reviewBy}.`);
}

let rawAudit = "";
try {
  rawAudit = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
    cwd: appRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  rawAudit = String(error.stdout || "");
}

if (!rawAudit.trim()) {
  throw new Error("npm audit did not return JSON; the alpha disposition cannot be verified.");
}

let audit;
try {
  audit = JSON.parse(rawAudit);
} catch {
  throw new Error("npm audit did not return parseable JSON; the alpha disposition cannot be verified.");
}

const counts = audit.metadata?.vulnerabilities;
if (!counts) throw new Error("npm audit JSON has no vulnerability metadata.");
const actualHigh = Object.entries(audit.vulnerabilities || {})
  .filter(([, finding]) => finding.severity === "high")
  .map(([name]) => name)
  .sort();
const allowedHigh = new Set(disposition.highPackages);
const unfamiliarHigh = actualHigh.filter((name) => !allowedHigh.has(name));

if (counts.critical > disposition.maximumObserved.critical) {
  throw new Error(`V3 has ${counts.critical} critical findings; the alpha exception permits none.`);
}
if (counts.high > disposition.maximumObserved.high) {
  throw new Error(`V3 high findings increased from ${disposition.maximumObserved.high} to ${counts.high}.`);
}
if (counts.moderate > disposition.maximumObserved.moderate) {
  throw new Error(`V3 moderate findings increased from ${disposition.maximumObserved.moderate} to ${counts.moderate}.`);
}
if (unfamiliarHigh.length) {
  throw new Error(`V3 has undocumented high findings: ${unfamiliarHigh.join(", ")}.`);
}

console.log(
  `V3 internal-alpha audit verified: ${counts.high} high, ${counts.moderate} moderate, ${counts.critical} critical.`,
);

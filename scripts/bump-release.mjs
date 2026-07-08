import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageFile = path.join(rootDir, "package.json");
const swFile = path.join(rootDir, "public", "sw.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function nextBetaVersion(currentVersion) {
  const betaMatch = String(currentVersion).match(/^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/);
  if (betaMatch) {
    const [, major, minor, patch, beta] = betaMatch;
    return `${major}.${minor}.${patch}-beta.${Number(beta) + 1}`;
  }
  const stableMatch = String(currentVersion).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (stableMatch) {
    const [, major, minor, patch] = stableMatch;
    return `${major}.${minor}.${patch}-beta.1`;
  }
  throw new Error(`Versione non riconosciuta: ${currentVersion}`);
}

function bumpServiceWorkerCache() {
  if (!fs.existsSync(swFile)) return "";
  const current = fs.readFileSync(swFile, "utf8");
  const next = current.replace(/toilettatura-pwa-v(\d+)/, (_, value) => `toilettatura-pwa-v${Number(value) + 1}`);
  if (next !== current) fs.writeFileSync(swFile, next);
  const match = next.match(/toilettatura-pwa-v(\d+)/);
  return match ? match[0] : "";
}

const args = process.argv.slice(2);
const setIndex = args.indexOf("--set");
const pkg = readJson(packageFile);
const nextVersion = setIndex >= 0 ? args[setIndex + 1] : nextBetaVersion(pkg.version);

if (!nextVersion || !/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(nextVersion)) {
  throw new Error("Usa una versione tipo 0.0.1-beta.2 oppure 0.0.1");
}

pkg.version = nextVersion;
writeJson(packageFile, pkg);
const cacheName = bumpServiceWorkerCache();

console.log(`Release aggiornata a ${nextVersion}`);
if (cacheName) console.log(`Cache PWA aggiornata a ${cacheName}`);

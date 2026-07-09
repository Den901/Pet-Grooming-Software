import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

const APP_ID = "pet-grooming-software";
const UPDATE_MANIFEST_FORMAT = "PET_GROOMING_SOFTWARE_UPDATE_MANIFEST";
const UPDATE_MANIFEST_VERSION = 1;

function releaseLabel(version) {
  return String(version).replace("-beta.", " beta ").replace("-beta", " beta");
}

function parseArgs(argv) {
  const options = {
    version: packageInfo.version,
    repo: process.env.GITHUB_REPOSITORY || "Den901/Pet-Grooming-Software",
    tag: "",
    out: "",
    packageUrl: "",
    releaseUrl: "",
    notes: "",
    changelog: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") {
      options.version = argv[++index];
    } else if (arg === "--repo") {
      options.repo = argv[++index];
    } else if (arg === "--tag") {
      options.tag = argv[++index];
    } else if (arg === "--out") {
      options.out = argv[++index];
    } else if (arg === "--package-url") {
      options.packageUrl = argv[++index];
    } else if (arg === "--release-url") {
      options.releaseUrl = argv[++index];
    } else if (arg === "--notes") {
      options.notes = argv[++index];
    } else if (arg === "--changelog") {
      options.changelog = argv[++index];
    } else {
      throw new Error(`Argomento non riconosciuto: ${arg}`);
    }
  }
  return options;
}

function defaultOutput() {
  return path.join(rootDir, "dist", "pet-grooming-update.json");
}

function buildManifest(options) {
  const tag = options.tag || `v${options.version}`;
  const packageName = `Pet-Grooming-Software-${options.version}.pgs-update`;
  const repoBase = `https://github.com/${options.repo}`;
  const releaseNotes = options.notes || `Release ${releaseLabel(options.version)}`;
  const changelog = options.changelog || releaseNotes;
  return {
    format: UPDATE_MANIFEST_FORMAT,
    formatVersion: UPDATE_MANIFEST_VERSION,
    app: APP_ID,
    version: options.version,
    releaseLabel: releaseLabel(options.version),
    createdAt: new Date().toISOString(),
    packageName,
    packageUrl: options.packageUrl || `${repoBase}/releases/download/${tag}/${packageName}`,
    releaseUrl: options.releaseUrl || `${repoBase}/releases/tag/${tag}`,
    notes: releaseNotes,
    changelog
  };
}

const options = parseArgs(process.argv.slice(2));
const manifest = buildManifest(options);
const outFile = path.resolve(rootDir, options.out || defaultOutput());

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Creato ${outFile}`);

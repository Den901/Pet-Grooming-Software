import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageInfo = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

const APP_ID = "pet-grooming-software";
const UPDATE_FORMAT = "PET_GROOMING_SOFTWARE_UPDATE";
const UPDATE_FORMAT_VERSION = 1;
const UPDATE_EXTENSION = ".pgs-update";
const MAX_UPDATE_BYTES = 28 * 1024 * 1024;

const defaultEntries = [
  "server.js",
  "package.json",
  "README.md",
  ".gitignore",
  "start-windows.bat",
  "start-linux.sh",
  "public",
  "scripts",
  "docs"
];

const excludedNames = new Set([".git", "data", "node_modules", "dist", "backups"]);
const excludedExtensions = new Set([".log", ".backup", ".enc"]);

function releaseLabel(version) {
  return String(version).replace("-beta.", " beta ").replace("-beta", " beta");
}

function parseArgs(argv) {
  const options = {
    version: packageInfo.version,
    out: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--version") {
      options.version = argv[++index];
    } else if (arg === "--out") {
      options.out = argv[++index];
    } else if (arg === "--no-docs") {
      options.noDocs = true;
    } else {
      throw new Error(`Argomento non riconosciuto: ${arg}`);
    }
  }
  return options;
}

function toRelative(filePath) {
  const relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
  if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) throw new Error(`Percorso non valido: ${filePath}`);
  return relative;
}

function shouldSkip(filePath) {
  const name = path.basename(filePath);
  if (excludedNames.has(name)) return true;
  if (excludedExtensions.has(path.extname(name).toLowerCase())) return true;
  return false;
}

function collectFiles(entry, files = []) {
  if (!fs.existsSync(entry) || shouldSkip(entry)) return files;
  const stats = fs.statSync(entry);
  if (stats.isDirectory()) {
    const children = fs.readdirSync(entry).sort((a, b) => a.localeCompare(b));
    for (const child of children) collectFiles(path.join(entry, child), files);
    return files;
  }
  if (stats.isFile()) files.push(entry);
  return files;
}

function buildEnvelope(options) {
  const selectedEntries = options.noDocs ? defaultEntries.filter((entry) => entry !== "docs") : defaultEntries;
  const absoluteFiles = selectedEntries.flatMap((entry) => collectFiles(path.join(rootDir, entry)));
  const uniqueFiles = [...new Set(absoluteFiles)].sort((a, b) => toRelative(a).localeCompare(toRelative(b)));
  let totalBytes = 0;
  const files = uniqueFiles.map((filePath) => {
    const data = fs.readFileSync(filePath);
    totalBytes += data.length;
    return {
      path: toRelative(filePath),
      size: data.length,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
      data: data.toString("base64")
    };
  });
  if (totalBytes > MAX_UPDATE_BYTES) {
    throw new Error(`Pacchetto troppo grande: ${totalBytes} byte`);
  }
  return {
    format: UPDATE_FORMAT,
    formatVersion: UPDATE_FORMAT_VERSION,
    app: APP_ID,
    version: options.version,
    releaseLabel: releaseLabel(options.version),
    createdAt: new Date().toISOString(),
    files
  };
}

function defaultOutput(version) {
  return path.join(rootDir, "dist", `Pet-Grooming-Software-${version}${UPDATE_EXTENSION}`);
}

const options = parseArgs(process.argv.slice(2));
const envelope = buildEnvelope(options);
const outFile = path.resolve(rootDir, options.out || defaultOutput(options.version));

if (!outFile.toLowerCase().endsWith(UPDATE_EXTENSION)) {
  throw new Error(`Il file update deve finire con ${UPDATE_EXTENSION}`);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(envelope, null, 2)}\n`);

console.log(`Creato ${outFile}`);
console.log(`${envelope.files.length} file, ${envelope.files.reduce((sum, file) => sum + file.size, 0)} byte`);

const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const packageInfo = require("./package.json");

const PORT = Number(process.env.PORT || 3017);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const MAX_UPDATE_BYTES = 28 * 1024 * 1024;
const MAX_UPDATE_BODY_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_GALLERY_PHOTOS_PER_TYPE = 5;
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const SIDEBAR_ITEM_IDS = ["calendar", "dashboard", "dogs", "serviceHistory", "users"];
const APP_ID = "pet-grooming-software";
const APP_VERSION = packageInfo.version || "0.0.1-beta.14";
const UPDATE_FORMAT = "PET_GROOMING_SOFTWARE_UPDATE";
const UPDATE_FORMAT_VERSION = 1;
const UPDATE_EXTENSION = ".pgs-update";
const UPDATE_MANIFEST_FORMAT = "PET_GROOMING_SOFTWARE_UPDATE_MANIFEST";
const UPDATE_MANIFEST_VERSION = 1;
const UPDATE_MANIFEST_URL =
  process.env.UPDATE_MANIFEST_URL || "https://github.com/Den901/Pet-Grooming-Software/releases/latest/download/pet-grooming-update.json";
const MAX_UPDATE_MANIFEST_BYTES = 256 * 1024;

const sessions = new Map();
const eventClients = new Set();
let restartScheduled = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function defaultSettings() {
  return {
    branding: {
      theme: "light",
      portalName: "Groomly",
      businessName: "Groomly",
      tagline: "Agenda e schede clienti",
      companyInfo: "",
      phone: "",
      email: "",
      address: "",
      logoUrl: "",
      loginBackground: {
        mode: "pattern",
        solidColor: "#f6f3ed",
        patternColor: "#f6f3ed",
        patternAccentColor: "#ded9cf",
        gradientTop: "#f6f3ed",
        gradientBottom: "#dfe9e4",
        imageUrl: ""
      },
      colors: {
        brand: "#234344",
        brandStrong: "#183233",
        accent: "#cf6155",
        background: "#f6f3ed",
        panel: "#ffffff",
        text: "#162625"
      }
    },
    duckdns: {
      domain: "",
      token: "",
      publicProtocol: "https",
      publicPort: ""
    },
    whatsapp: {
      enabled: false,
      mode: "manual",
      countryPrefix: "+39",
      reminderHoursBefore: 24,
      template:
        "Ciao {ownerName}, ti ricordiamo l'appuntamento di {dogName} presso {businessName} il {date} alle {time}.",
      cloudPhoneNumberId: "",
      cloudAccessToken: "",
      lastResult: "",
      lastUpdateAt: ""
    },
    animal: {
      breeds: ["Meticcio"],
      services: ["Bagno", "Taglio", "Snodatura", "Stripping"],
      colors: ["Nero", "Bianco", "Marrone", "Fulvo", "Grigio", "Beige", "Crema", "Rosso", "Dorato", "Tricolore", "Pezzato", "Tigrato", "Merle"],
      loyaltyTopVisitsPerYear: 8
    },
    navigation: {
      sidebarOrder: SIDEBAR_ITEM_IDS
    }
  };
}

function ensureSettingsShape(settings = {}) {
  const defaults = defaultSettings();
  const colors = {
    ...defaults.branding.colors,
    ...(settings.branding?.colors || {})
  };
  const loginBackground = {
    ...defaults.branding.loginBackground,
    ...(settings.branding?.loginBackground || {})
  };
  const animal = {
    ...defaults.animal,
    ...(settings.animal || {}),
    breeds: cleanStringList(settings.animal?.breeds, defaults.animal.breeds),
    services: cleanStringList(settings.animal?.services, defaults.animal.services),
    colors: cleanStringList(settings.animal?.colors, defaults.animal.colors),
    loyaltyTopVisitsPerYear: cleanNumber(settings.animal?.loyaltyTopVisitsPerYear, defaults.animal.loyaltyTopVisitsPerYear)
  };
  const navigation = {
    ...defaults.navigation,
    ...(settings.navigation || {}),
    sidebarOrder: cleanSidebarOrder(settings.navigation?.sidebarOrder, defaults.navigation.sidebarOrder)
  };
  return {
    branding: {
      ...defaults.branding,
      ...(settings.branding || {}),
      theme: ["light", "dark", "custom"].includes(settings.branding?.theme) ? settings.branding.theme : defaults.branding.theme,
      loginBackground,
      colors
    },
    duckdns: {
      ...defaults.duckdns,
      ...(settings.duckdns || {})
    },
    whatsapp: {
      ...defaults.whatsapp,
      ...(settings.whatsapp || {})
    },
    animal,
    navigation
  };
}

function ensureStorage() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const adminPassword = makePassword(DEFAULT_ADMIN_PASSWORD);
    const userPassword = makePassword("operatore123");
    const now = new Date().toISOString();
    const db = {
      users: [
        {
          id: crypto.randomUUID(),
          username: DEFAULT_ADMIN_USERNAME,
          displayName: "Amministratore",
          role: "admin",
          active: true,
          createdAt: now,
          mustChangePassword: true,
          defaultPassword: true,
          passwordHash: adminPassword.hash,
          passwordSalt: adminPassword.salt
        },
        {
          id: crypto.randomUUID(),
          username: "operatore",
          displayName: "Operatore",
          role: "user",
          active: true,
          createdAt: now,
          passwordHash: userPassword.hash,
          passwordSalt: userPassword.salt
        }
      ],
      dogs: [],
      appointments: [],
      settings: defaultSettings()
    };
    writeDb(db);
  }
}

function readDb() {
  ensureStorage();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.users ||= [];
  db.dogs ||= [];
  db.appointments ||= [];
  db.settings = ensureSettingsShape(db.settings);
  if (ensureUserSecurityFlags(db)) writeDb(db);
  return db;
}

function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function makePassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user?.passwordSalt || !user?.passwordHash) return false;
  const test = makePassword(password, user.passwordSalt).hash;
  const storedBuffer = Buffer.from(user.passwordHash, "hex");
  const testBuffer = Buffer.from(test, "hex");
  return storedBuffer.length === testBuffer.length && crypto.timingSafeEqual(storedBuffer, testBuffer);
}

function isDefaultAdminUser(user) {
  return user?.username === DEFAULT_ADMIN_USERNAME && user.role === "admin" && verifyPassword(DEFAULT_ADMIN_PASSWORD, user);
}

function acceptsDefaultAdminPassword(user, password) {
  const compactPassword = cleanString(password).replace(/\s+/g, "");
  return isDefaultAdminUser(user) && compactPassword === DEFAULT_ADMIN_PASSWORD;
}

function ensureUserSecurityFlags(db) {
  let changed = false;
  for (const user of db.users) {
    if (!user || user.username !== DEFAULT_ADMIN_USERNAME || user.role !== "admin") continue;
    if (isDefaultAdminUser(user)) {
      if (user.mustChangePassword !== true || user.defaultPassword !== true) {
        user.mustChangePassword = true;
        user.defaultPassword = true;
        changed = true;
      }
    } else if (user.defaultPassword || user.mustChangePassword) {
      user.defaultPassword = false;
      user.mustChangePassword = false;
      changed = true;
    }
  }
  return changed;
}

function onlineUserIds() {
  return new Set(Array.from(eventClients, (client) => client.userId).filter(Boolean));
}

function publicUser(user, onlineIds = onlineUserIds()) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: Boolean(user.active),
    mustChangePassword: Boolean(user.mustChangePassword),
    defaultPassword: Boolean(user.defaultPassword),
    online: onlineIds.has(user.id),
    avatarUrl: cleanString(user.avatarUrl),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function publicLoginUser(user) {
  return {
    username: user.username,
    displayName: cleanString(user.displayName) || user.username,
    role: user.role,
    avatarUrl: cleanString(user.avatarUrl)
  };
}

function publicLoginUsers(db) {
  return db.users
    .filter((user) => user?.active)
    .map(publicLoginUser)
    .sort((a, b) => (a.role === "admin" ? -1 : 1) - (b.role === "admin" ? -1 : 1) || a.displayName.localeCompare(b.displayName, "it"));
}

function broadcastDataChange(type, detail = {}) {
  const payload = `data: ${JSON.stringify({ type, detail, at: new Date().toISOString() })}\n\n`;
  for (const client of eventClients) {
    client.res.write(payload);
  }
}

function broadcastPresenceChange() {
  broadcastDataChange("presence", { onlineUserIds: Array.from(onlineUserIds()) });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function releaseLabel(version = APP_VERSION) {
  return String(version).replace("-beta.", " beta ").replace("-beta", " beta");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function getCurrentUser(req, db) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId && item.active);
  if (!user) {
    sessions.delete(token);
    return null;
  }
  return user;
}

function setSession(res, user) {
  const token = crypto.randomUUID();
  sessions.set(token, { userId: user.id, createdAt: Date.now() });
  res.setHeader("Set-Cookie", `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function clearSession(req, res) {
  const token = parseCookies(req).session;
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Richiesta troppo grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON non valido"));
      }
    });
    req.on("error", reject);
  });
}

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanStringList(value, fallback = []) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|,/) : fallback;
  return [...new Set(source.map((item) => cleanString(item)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
}

function cleanSidebarOrder(value, fallback = SIDEBAR_ITEM_IDS) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|,/) : fallback;
  const seen = new Set();
  const result = [];
  for (const item of source) {
    const id = cleanString(item);
    if (!SIDEBAR_ITEM_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  for (const id of fallback) {
    if (!SIDEBAR_ITEM_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function cleanNumber(value, fallback = 0) {
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function hasField(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key);
}

function stringField(payload, key, existing = "") {
  return hasField(payload, key) ? cleanString(payload[key]) : cleanString(existing);
}

function numberField(payload, key, existing = 0) {
  return hasField(payload, key) ? cleanNumber(payload[key], 0) : cleanNumber(existing, 0);
}

function firstStringField(payload, keys, existing = "") {
  for (const key of keys) {
    if (hasField(payload, key)) return cleanString(payload[key]);
  }
  return cleanString(existing);
}

function firstNumberField(payload, keys, existing = 0) {
  for (const key of keys) {
    if (hasField(payload, key)) return cleanNumber(payload[key], 0);
  }
  return cleanNumber(existing, 0);
}

function booleanField(payload, key, existing = false) {
  return hasField(payload, key) ? payload[key] === true || payload[key] === "true" || payload[key] === "on" : Boolean(existing);
}

function cleanHexColor(value, fallback) {
  const color = cleanString(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function savePhoto(dataUri, id) {
  if (!dataUri || typeof dataUri !== "string") return null;
  const match = dataUri.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Immagine troppo grande: massimo 4 MB dopo la riduzione");
  const extension = match[1].toLowerCase().replace("jpeg", "jpg");
  const fileName = `${id}-${Date.now()}.${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
  return `/uploads/${fileName}`;
}

function savePhotoList(dataUris, id, existing = [], limit = MAX_GALLERY_PHOTOS_PER_TYPE) {
  const kept = Array.isArray(existing) ? existing.filter(Boolean).slice(0, limit) : [];
  const incoming = Array.isArray(dataUris) ? dataUris : [];
  for (const dataUri of incoming) {
    if (kept.length >= limit) break;
    const saved = savePhoto(dataUri, id);
    if (saved) kept.push(saved);
  }
  return kept.slice(0, limit);
}

function publicBrandingSettings(db) {
  const branding = ensureSettingsShape(db.settings).branding;
  return {
    theme: ["light", "dark", "custom"].includes(branding.theme) ? branding.theme : "light",
    portalName: cleanString(branding.portalName) || "Groomly",
    businessName: cleanString(branding.businessName) || "Groomly",
    tagline: cleanString(branding.tagline) || "Agenda e schede clienti",
    companyInfo: cleanString(branding.companyInfo),
    phone: cleanString(branding.phone),
    email: cleanString(branding.email),
    address: cleanString(branding.address),
    logoUrl: cleanString(branding.logoUrl),
    loginBackground: {
      mode: ["pattern", "solid", "gradient", "image"].includes(branding.loginBackground?.mode) ? branding.loginBackground.mode : "pattern",
      solidColor: cleanHexColor(branding.loginBackground?.solidColor, "#f6f3ed"),
      patternColor: cleanHexColor(branding.loginBackground?.patternColor, "#f6f3ed"),
      patternAccentColor: cleanHexColor(branding.loginBackground?.patternAccentColor, "#ded9cf"),
      gradientTop: cleanHexColor(branding.loginBackground?.gradientTop, "#f6f3ed"),
      gradientBottom: cleanHexColor(branding.loginBackground?.gradientBottom, "#dfe9e4"),
      imageUrl: cleanString(branding.loginBackground?.imageUrl)
    },
    colors: {
      brand: cleanHexColor(branding.colors?.brand, "#234344"),
      brandStrong: cleanHexColor(branding.colors?.brandStrong, "#183233"),
      accent: cleanHexColor(branding.colors?.accent, "#cf6155"),
      background: cleanHexColor(branding.colors?.background, "#f6f3ed"),
      panel: cleanHexColor(branding.colors?.panel, "#ffffff"),
      text: cleanHexColor(branding.colors?.text, "#162625")
    }
  };
}

function publicAnimalSettings(db) {
  const animal = ensureSettingsShape(db.settings).animal;
  return {
    breeds: cleanStringList(animal.breeds, defaultSettings().animal.breeds),
    services: cleanStringList(animal.services, defaultSettings().animal.services),
    colors: cleanStringList(animal.colors, defaultSettings().animal.colors),
    loyaltyTopVisitsPerYear: cleanNumber(animal.loyaltyTopVisitsPerYear, defaultSettings().animal.loyaltyTopVisitsPerYear)
  };
}

function publicNavigationSettings(db) {
  const navigation = ensureSettingsShape(db.settings).navigation;
  return {
    sidebarOrder: cleanSidebarOrder(navigation.sidebarOrder)
  };
}

function showInitialAccessHint(db) {
  return db.users.some(
    (item) =>
      item?.active &&
      item.username === DEFAULT_ADMIN_USERNAME &&
      item.role === "admin" &&
      item.defaultPassword === true &&
      isDefaultAdminUser(item)
  );
}

function publicWhatsappSettings(db) {
  const whatsapp = ensureSettingsShape(db.settings).whatsapp;
  return {
    enabled: Boolean(whatsapp.enabled),
    mode: whatsapp.mode === "cloud-api" ? "cloud-api" : "manual",
    countryPrefix: cleanString(whatsapp.countryPrefix) || "+39",
    reminderHoursBefore: cleanNumber(whatsapp.reminderHoursBefore, 24),
    template: cleanString(whatsapp.template) || defaultSettings().whatsapp.template,
    cloudPhoneNumberId: cleanString(whatsapp.cloudPhoneNumberId),
    hasCloudAccessToken: Boolean(whatsapp.cloudAccessToken),
    lastResult: cleanString(whatsapp.lastResult),
    lastUpdateAt: cleanString(whatsapp.lastUpdateAt)
  };
}

function sortAppointments(appointments) {
  return [...appointments].sort((a, b) => `${a.date || ""} ${a.startTime || ""}`.localeCompare(`${b.date || ""} ${b.startTime || ""}`));
}

function normalizeDuckDnsDomain(value) {
  return cleanString(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:.*$/, "")
    .toLowerCase();
}

function duckDnsUpdateName(domain) {
  return normalizeDuckDnsDomain(domain).replace(/\.duckdns\.org$/i, "");
}

function buildPublicUrl(duckdns = {}) {
  const domain = normalizeDuckDnsDomain(duckdns.domain);
  if (!domain) return "";
  const protocol = duckdns.publicProtocol === "http" ? "http" : "https";
  const port = cleanString(duckdns.publicPort);
  const defaultPort = protocol === "https" ? "443" : "80";
  return `${protocol}://${domain}${port && port !== defaultPort ? `:${port}` : ""}`;
}

function localAccessInfo(req) {
  const host = (req.headers.host || `localhost:${PORT}`).replace(/^.*@/, "");
  const port = host.includes(":") ? host.split(":").pop() : String(PORT);
  const addresses = new Set(["localhost", "127.0.0.1"]);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === "IPv4" && !item.internal) addresses.add(item.address);
    }
  }
  return [...addresses].map((address) => ({
    label: address === "localhost" || address === "127.0.0.1" ? "Questo computer" : "Rete locale",
    url: `http://${address}:${port}`
  }));
}

function publicDuckDnsSettings(db, req) {
  const duckdns = db.settings?.duckdns || {};
  return {
    domain: normalizeDuckDnsDomain(duckdns.domain),
    hasToken: Boolean(duckdns.token),
    publicProtocol: duckdns.publicProtocol === "http" ? "http" : "https",
    publicPort: cleanString(duckdns.publicPort),
    publicUrl: buildPublicUrl(duckdns),
    localUrls: localAccessInfo(req),
    lastUpdateAt: duckdns.lastUpdateAt || "",
    lastResult: duckdns.lastResult || ""
  };
}

function updateDuckDns(duckdns = {}) {
  return new Promise((resolve, reject) => {
    const domain = duckDnsUpdateName(duckdns.domain);
    const token = cleanString(duckdns.token);
    if (!domain || !token) {
      reject(new Error("Dominio DuckDNS e token sono obbligatori"));
      return;
    }
    const requestPath = `/update?domains=${encodeURIComponent(domain)}&token=${encodeURIComponent(token)}&ip=`;
    const req = https.get(
      {
        hostname: "www.duckdns.org",
        path: requestPath,
        timeout: 10000
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          const text = body.trim();
          if (response.statusCode === 200 && text === "OK") {
            resolve("OK");
            return;
          }
          reject(new Error(text || `DuckDNS ha risposto ${response.statusCode}`));
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout aggiornamento DuckDNS")));
    req.on("error", reject);
  });
}

function readUploadsForBackup() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return fs
    .readdirSync(UPLOAD_DIR)
    .filter((fileName) => /^[a-z0-9_.-]+$/i.test(fileName))
    .filter((fileName) => [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(fileName).toLowerCase()))
    .map((fileName) => ({
      fileName,
      data: fs.readFileSync(path.join(UPLOAD_DIR, fileName)).toString("base64")
    }));
}

function encryptBackup(payload, password) {
  const cleanPassword = cleanString(password);
  if (cleanPassword.length < 8) throw new Error("La password backup deve avere almeno 8 caratteri");
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(cleanPassword, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    format: "toilettatura-portal-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    algorithm: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  };
}

function decryptBackup(envelope, password) {
  const cleanPassword = cleanString(password);
  if (!envelope || envelope.format !== "toilettatura-portal-backup" || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("Formato backup non valido");
  }
  const key = crypto.scryptSync(cleanPassword, Buffer.from(envelope.salt, "base64"), 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

function restoreBackup(payload) {
  const nextDb = payload?.db;
  if (!nextDb || !Array.isArray(nextDb.users) || !Array.isArray(nextDb.dogs) || !Array.isArray(nextDb.appointments)) {
    throw new Error("Il backup non contiene dati validi");
  }
  if (!nextDb.users.some((item) => item.role === "admin" && item.active)) {
    throw new Error("Il backup deve contenere almeno un amministratore attivo");
  }

  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const upload of payload.uploads || []) {
    if (!upload?.fileName || !/^[a-z0-9_.-]+$/i.test(upload.fileName)) continue;
    const destination = path.join(UPLOAD_DIR, path.basename(upload.fileName));
    fs.writeFileSync(destination, Buffer.from(String(upload.data || ""), "base64"));
  }

  writeDb({
    users: nextDb.users,
    dogs: nextDb.dogs,
    appointments: nextDb.appointments,
    settings: nextDb.settings || {}
  });
}

function isUpdateFileName(fileName) {
  return cleanString(fileName).toLowerCase().endsWith(UPDATE_EXTENSION);
}

function normalizeUpdatePath(filePath) {
  const normalized = cleanString(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0") || normalized.split("/").includes("..")) return "";
  if (normalized.startsWith(".git/") || normalized.startsWith("data/") || normalized.startsWith("node_modules/") || normalized.startsWith("dist/")) return "";
  if (normalized.startsWith("public/") || normalized.startsWith("scripts/") || normalized.startsWith("docs/")) return normalized;
  if (["server.js", "package.json", "README.md", "start-windows.bat", "start-linux.sh", ".gitignore"].includes(normalized)) return normalized;
  return "";
}

function decodeUpdateFile(entry) {
  const filePath = normalizeUpdatePath(entry?.path);
  if (!filePath) throw new Error(`Percorso update non consentito: ${entry?.path || "-"}`);
  const data = Buffer.from(String(entry.data || ""), "base64");
  if (!data.length) throw new Error(`File update vuoto: ${filePath}`);
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  if (cleanString(entry.sha256) && cleanString(entry.sha256).toLowerCase() !== sha256) {
    throw new Error(`Hash non valido per ${filePath}`);
  }
  return { path: filePath, data, sha256 };
}

function validateUpdatePackage(envelope, fileName) {
  if (!isUpdateFileName(fileName)) throw new Error(`Formato update non valido: usa un file ${UPDATE_EXTENSION}`);
  if (!envelope || envelope.format !== UPDATE_FORMAT || envelope.formatVersion !== UPDATE_FORMAT_VERSION || envelope.app !== APP_ID) {
    throw new Error("Pacchetto update non riconosciuto");
  }
  if (!Array.isArray(envelope.files) || envelope.files.length === 0) throw new Error("Pacchetto update senza file");
  const files = envelope.files.map(decodeUpdateFile);
  const totalBytes = files.reduce((sum, file) => sum + file.data.length, 0);
  if (totalBytes > MAX_UPDATE_BYTES) throw new Error("Pacchetto update troppo grande");
  return {
    version: cleanString(envelope.version) || "senza-versione",
    createdAt: cleanString(envelope.createdAt),
    files,
    totalBytes
  };
}

function applyUpdatePackage(envelope, fileName) {
  const update = validateUpdatePackage(envelope, fileName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(DATA_DIR, "update-backups", stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const file of update.files) {
    const target = path.normalize(path.join(ROOT_DIR, file.path));
    const relativeTarget = path.relative(ROOT_DIR, target);
    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) throw new Error(`Percorso update non valido: ${file.path}`);
    const backupTarget = path.join(backupDir, file.path);
    fs.mkdirSync(path.dirname(backupTarget), { recursive: true });
    if (fs.existsSync(target)) fs.copyFileSync(target, backupTarget);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.data);
  }
  const summary = {
    format: UPDATE_FORMAT,
    installedAt: new Date().toISOString(),
    previousVersion: APP_VERSION,
    installedVersion: update.version,
    source: fileName,
    files: update.files.map((file) => ({ path: file.path, sha256: file.sha256 })),
    restartRequired: true
  };
  fs.writeFileSync(path.join(DATA_DIR, "last-update.json"), JSON.stringify(summary, null, 2));
  return summary;
}

function downloadUpdatePackage(updateUrl, sourceFileName = "", redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(cleanString(updateUrl));
    } catch {
      reject(new Error("URL update non valido"));
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      reject(new Error("URL update non valido"));
      return;
    }
    const packageFileName = sourceFileName || path.basename(parsed.pathname);
    if (!sourceFileName && !isUpdateFileName(packageFileName)) {
      reject(new Error(`L'URL deve puntare a un file ${UPDATE_EXTENSION}`));
      return;
    }
    if (redirectCount > 5) {
      reject(new Error("Troppi redirect durante il download update"));
      return;
    }
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(parsed, { timeout: 15000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadUpdatePackage(new URL(response.headers.location, parsed).toString(), packageFileName, redirectCount + 1).then(resolve, reject);
        response.resume();
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download update fallito: ${response.statusCode}`));
        response.resume();
        return;
      }
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_UPDATE_BYTES) {
          req.destroy(new Error("Pacchetto update troppo grande"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        try {
          resolve({ fileName: packageFileName, envelope: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch {
          reject(new Error("Pacchetto update web non valido"));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Timeout download update")));
    req.on("error", reject);
  });
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) return left.numbers[index] > right.numbers[index] ? 1 : -1;
  }
  if (left.beta === right.beta) return 0;
  if (left.beta === null) return 1;
  if (right.beta === null) return -1;
  return left.beta > right.beta ? 1 : -1;
}

function parseVersion(version) {
  const match = String(version || "").match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
  if (!match) return { numbers: [0, 0, 0], beta: 0 };
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    beta: match[4] ? Number(match[4]) : null
  };
}

function downloadJson(updateUrl, maxBytes = MAX_UPDATE_MANIFEST_BYTES) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(cleanString(updateUrl));
    } catch {
      reject(new Error("URL manifest update non valido"));
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      reject(new Error("URL manifest update non valido"));
      return;
    }
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(parsed, { timeout: 10000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadJson(new URL(response.headers.location, parsed).toString(), maxBytes).then(resolve, reject);
        response.resume();
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Controllo update fallito: ${response.statusCode}`));
        response.resume();
        return;
      }
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy(new Error("Manifest update troppo grande"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new Error("Manifest update non valido"));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Timeout controllo update")));
    req.on("error", reject);
  });
}

function validateUpdateManifest(manifest, manifestUrl = UPDATE_MANIFEST_URL) {
  if (!manifest || manifest.format !== UPDATE_MANIFEST_FORMAT || manifest.formatVersion !== UPDATE_MANIFEST_VERSION || manifest.app !== APP_ID) {
    throw new Error("Manifest update non riconosciuto");
  }
  const latestVersion = cleanString(manifest.version);
  const packageUrl = cleanString(manifest.packageUrl);
  if (!latestVersion) throw new Error("Manifest update senza versione");
  let parsedPackageUrl;
  try {
    parsedPackageUrl = new URL(packageUrl);
  } catch {
    throw new Error("URL pacchetto update non valido");
  }
  if (!["http:", "https:"].includes(parsedPackageUrl.protocol) || !isUpdateFileName(parsedPackageUrl.pathname)) {
    throw new Error(`Manifest senza pacchetto ${UPDATE_EXTENSION}`);
  }
  return {
    manifestUrl,
    app: APP_ID,
    currentVersion: APP_VERSION,
    currentReleaseLabel: releaseLabel(APP_VERSION),
    latestVersion,
    latestReleaseLabel: cleanString(manifest.releaseLabel) || releaseLabel(latestVersion),
    packageUrl,
    releaseUrl: cleanString(manifest.releaseUrl),
    notes: cleanString(manifest.notes),
    changelog: cleanString(manifest.changelog) || cleanString(manifest.notes),
    createdAt: cleanString(manifest.createdAt),
    updateAvailable: compareVersions(latestVersion, APP_VERSION) > 0
  };
}

async function checkWebUpdate(manifestUrl = UPDATE_MANIFEST_URL) {
  const url = cleanString(manifestUrl) || UPDATE_MANIFEST_URL;
  const manifest = await downloadJson(url);
  return validateUpdateManifest(manifest, url);
}

function schedulePortalRestart() {
  if (restartScheduled) return false;
  restartScheduled = true;
  const restartTimer = setTimeout(() => {
    console.log("Riavvio portale richiesto dal pannello amministratore");
    server.close(() => process.exit(0));
    const forceExitTimer = setTimeout(() => process.exit(0), 3000);
    forceExitTimer.unref?.();
  }, 700);
  restartTimer.unref?.();
  return true;
}

function addEventClient(req, res, user) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  const wasOnline = onlineUserIds().has(user.id);
  const client = { res, userId: user.id };
  eventClients.add(client);
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      detail: { onlineUserIds: Array.from(onlineUserIds()) },
      at: new Date().toISOString()
    })}\n\n`
  );
  if (!wasOnline) broadcastPresenceChange();
  req.on("close", () => {
    const wasConnected = onlineUserIds().has(user.id);
    eventClients.delete(client);
    if (wasConnected && !onlineUserIds().has(user.id)) broadcastPresenceChange();
  });
}

function validateDogForSave(dog) {
  if (!dog.dogName) return "Inserisci il nome del cane";
  if (!dog.contactMissing && !dog.contact) return "Inserisci il numero di telefono o spunta non presente";
  if (!dog.color) return "Inserisci il colore del cane";
  if (!["M", "F"].includes(dog.sex)) return "Seleziona il sesso del cane";
  if (!["yes", "no"].includes(dog.imageConsent)) return "Seleziona il consenso immagini";
  return "";
}

function lowerMatch(value) {
  return cleanString(value).toLowerCase();
}

function findMatchingDogFromAppointment(payload, db) {
  const dogName = lowerMatch(payload.dogName);
  const ownerName = lowerMatch(payload.ownerName);
  const contact = lowerMatch(payload.contact);
  if (!dogName) return null;
  return db.dogs.find((dog) => {
    if (lowerMatch(dog.dogName) !== dogName) return false;
    if (ownerName && lowerMatch(dog.ownerName) !== ownerName) return false;
    if (contact && lowerMatch(dog.contact) !== contact) return false;
    return true;
  });
}

function maybeCreateDogFromAppointment(payload, db) {
  if (payload.createDogProfile !== true || cleanString(payload.dogId)) return { payload, dog: null };
  const dogName = cleanString(payload.dogName);
  if (!dogName) return { payload, dog: null };
  const matchingDog = findMatchingDogFromAppointment(payload, db);
  if (matchingDog) {
    return { payload: { ...payload, dogId: matchingDog.id }, dog: matchingDog };
  }
  const contact = cleanString(payload.contact);
  const dog = normalizeDog({
    dogName,
    ownerName: cleanString(payload.ownerName),
    contact,
    estimatedMinutes: 0,
    contactMissing: booleanField(payload, "contactMissing", !contact),
    color: cleanString(payload.color),
    sex: cleanString(payload.sex),
    imageConsent: cleanString(payload.imageConsent),
    services: selectedServices(payload, []),
    notes: `Scheda creata da appuntamento del ${cleanString(payload.date) || "giorno non indicato"}.`
  });
  const validationError = validateDogForSave(dog);
  if (validationError) return { payload, dog: null, error: validationError };
  updateAnimalOptionsFromDog(db, dog);
  db.dogs.push(dog);
  return { payload: { ...payload, dogId: dog.id }, dog };
}

function selectedServices(payload, existing = []) {
  const value = hasField(payload, "services") ? payload.services : hasField(payload, "service") ? payload.service : existing;
  const list = Array.isArray(value) ? value : cleanString(value) ? String(value).split(",") : [];
  return cleanStringList(list, []);
}

function selectedServiceAmounts(payload, services = [], existing = [], paidAmount = 0) {
  const source = hasField(payload, "serviceAmounts") ? payload.serviceAmounts : existing;
  const map = new Map();
  if (Array.isArray(source)) {
    for (const item of source) {
      const service = cleanString(item?.service || item?.name);
      if (!service) continue;
      map.set(service.toLowerCase(), cleanNumber(item?.amount, 0));
    }
  } else if (source && typeof source === "object") {
    for (const [serviceName, amount] of Object.entries(source)) {
      const service = cleanString(serviceName);
      if (!service) continue;
      map.set(service.toLowerCase(), cleanNumber(amount, 0));
    }
  }
  const result = services.map((service) => ({
    service,
    amount: map.get(service.toLowerCase()) || 0
  }));
  const total = result.reduce((sum, item) => sum + item.amount, 0);
  if (!total && cleanNumber(paidAmount, 0) > 0 && result.length) {
    const share = cleanNumber(paidAmount, 0) / result.length;
    return result.map((item) => ({ ...item, amount: Number(share.toFixed(2)) }));
  }
  return result;
}

function totalServiceAmounts(serviceAmounts = []) {
  return (serviceAmounts || []).reduce((sum, item) => sum + cleanNumber(item?.amount, 0), 0);
}

function updateAnimalOptionsFromDog(db, dog) {
  const current = publicAnimalSettings(db);
  const breeds = cleanStringList([...current.breeds, dog.breed], current.breeds);
  const services = cleanStringList([...current.services, ...(dog.services || [])], current.services);
  const colors = cleanStringList([...current.colors, dog.color], current.colors);
  db.settings.animal = {
    ...current,
    ...(db.settings.animal || {}),
    breeds,
    services,
    colors,
    loyaltyTopVisitsPerYear: cleanNumber(db.settings.animal?.loyaltyTopVisitsPerYear, current.loyaltyTopVisitsPerYear)
  };
}

function updateAnimalOptionsFromAppointment(db, appointment) {
  const current = publicAnimalSettings(db);
  db.settings.animal = {
    ...current,
    ...(db.settings.animal || {}),
    services: cleanStringList([...current.services, ...(appointment.services || [])], current.services)
  };
}

function normalizeAppointment(payload, db, existing = {}) {
  const now = new Date().toISOString();
  const id = existing.id || crypto.randomUUID();
  const dogId = stringField(payload, "dogId", existing.dogId);
  const dog = dogId ? db.dogs.find((item) => item.id === dogId) : null;
  const services = selectedServices(payload, existing.services || (existing.service ? [existing.service] : []));
  const service = services.join(", ") || stringField(payload, "service", existing.service);
  const status = ["programmato", "confermato", "completato", "annullato"].includes(payload.status) ? payload.status : existing.status || "programmato";
  let treatmentDone = firstStringField(payload, ["treatmentDone", "treatment", "performedTreatment"], existing.treatmentDone);
  if (status === "completato" && !treatmentDone) treatmentDone = service;
  const rawPaidAmount = status === "completato" ? firstNumberField(payload, ["paidAmount", "amountPaid", "amount", "price"], existing.paidAmount) : 0;
  const serviceAmounts = status === "completato" ? selectedServiceAmounts(payload, services, existing.serviceAmounts, rawPaidAmount) : [];
  const serviceTotal = totalServiceAmounts(serviceAmounts);
  const beforePhotos = hasField(payload, "clearBeforePhotos") && payload.clearBeforePhotos === true
    ? []
    : savePhotoList(payload.beforePhotoData, `${id}-before`, existing.beforePhotos, MAX_GALLERY_PHOTOS_PER_TYPE);
  const afterPhotos = hasField(payload, "clearAfterPhotos") && payload.clearAfterPhotos === true
    ? []
    : savePhotoList(payload.afterPhotoData, `${id}-after`, existing.afterPhotos, MAX_GALLERY_PHOTOS_PER_TYPE);
  return {
    id,
    dogId,
    dogName: cleanString(dog?.dogName || stringField(payload, "dogName", existing.dogName)),
    ownerName: cleanString(dog?.ownerName || stringField(payload, "ownerName", existing.ownerName)),
    contact: cleanString(dog?.contact || stringField(payload, "contact", existing.contact)),
    date: stringField(payload, "date", existing.date),
    startTime: stringField(payload, "startTime", existing.startTime),
    endTime: stringField(payload, "endTime", existing.endTime),
    service,
    services,
    treatmentDone,
    serviceAmounts,
    paidAmount: serviceTotal > 0 ? Number(serviceTotal.toFixed(2)) : rawPaidAmount,
    beforePhotos,
    afterPhotos,
    status,
    notes: stringField(payload, "notes", existing.notes),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function normalizeDog(payload, existing = {}) {
  const now = new Date().toISOString();
  const id = existing.id || crypto.randomUUID();
  const photoUrl = savePhoto(payload.photoData, id) || existing.photoUrl || "";
  const contactMissing = booleanField(payload, "contactMissing", existing.contactMissing);
  const services = selectedServices(payload, existing.services);
  return {
    id,
    dogName: stringField(payload, "dogName", existing.dogName),
    ownerName: stringField(payload, "ownerName", existing.ownerName),
    contact: contactMissing ? "" : stringField(payload, "contact", existing.contact),
    contactMissing,
    alternateContact: stringField(payload, "alternateContact", existing.alternateContact),
    breed: stringField(payload, "breed", existing.breed),
    birthYear: numberField(payload, "birthYear", existing.birthYear),
    color: stringField(payload, "color", existing.color),
    sex: ["M", "F"].includes(payload.sex) ? payload.sex : existing.sex || "",
    imageConsent: ["yes", "no"].includes(payload.imageConsent) ? payload.imageConsent : existing.imageConsent || "",
    manualTopClient: booleanField(payload, "manualTopClient", existing.manualTopClient),
    pathologies: stringField(payload, "pathologies", existing.pathologies),
    estimatedMinutes: numberField(payload, "estimatedMinutes", existing.estimatedMinutes),
    reminderDaysBefore: numberField(payload, "reminderDaysBefore", existing.reminderDaysBefore ?? 1),
    services,
    notes: stringField(payload, "notes", existing.notes),
    photoUrl,
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

async function handleApi(req, res, url) {
  const db = readDb();
  const user = getCurrentUser(req, db);
  const parts = url.pathname.split("/").filter(Boolean);
  const method = req.method.toUpperCase();

  try {
    if (url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/version" && method === "GET") {
      return sendJson(res, 200, {
        app: APP_ID,
        version: APP_VERSION,
        releaseLabel: releaseLabel(APP_VERSION),
        updateExtension: UPDATE_EXTENSION,
        updateManifestUrl: UPDATE_MANIFEST_URL
      });
    }

    if (url.pathname === "/api/public-settings" && method === "GET") {
      return sendJson(res, 200, {
        branding: publicBrandingSettings(db),
        navigation: publicNavigationSettings(db),
        loginUsers: publicLoginUsers(db),
        setup: {
          showInitialAccessHint: showInitialAccessHint(db)
        }
      });
    }

    if (url.pathname === "/api/login" && method === "POST") {
      const body = await readBody(req);
      const foundUser = db.users.find((item) => item.username.toLowerCase() === cleanString(body.username).toLowerCase());
      const passwordMatches = foundUser && (verifyPassword(body.password || "", foundUser) || acceptsDefaultAdminPassword(foundUser, body.password || ""));
      if (!foundUser || !foundUser.active || !passwordMatches) {
        return sendError(res, 401, "Credenziali non valide");
      }
      setSession(res, foundUser);
      return sendJson(res, 200, { user: publicUser(foundUser) });
    }

    if (url.pathname === "/api/logout" && method === "POST") {
      clearSession(req, res);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/me" && method === "GET") {
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (!user) return sendError(res, 401, "Accesso richiesto");

    if (url.pathname === "/api/events" && method === "GET") {
      return addEventClient(req, res, user);
    }

    if (parts[1] === "system" && parts[2] === "update-check" && ["GET", "POST"].includes(method)) {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      const body = method === "POST" ? await readBody(req) : {};
      const update = await checkWebUpdate(body.manifestUrl);
      return sendJson(res, 200, { update });
    }

    if (parts[1] === "system" && parts[2] === "restart" && method === "POST") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      const scheduled = schedulePortalRestart();
      return sendJson(res, 200, {
        ok: true,
        restartScheduled: scheduled,
        message: scheduled ? "Riavvio servizio avviato" : "Riavvio gia in corso"
      });
    }

    if (parts[1] === "system" && parts[2] === "update" && method === "POST") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      const body = await readBody(req, MAX_UPDATE_BODY_BYTES);
      let fileName = cleanString(body.fileName);
      let envelope = body.package;
      if (cleanString(body.url)) {
        const downloaded = await downloadUpdatePackage(body.url);
        fileName = downloaded.fileName;
        envelope = downloaded.envelope;
      }
      const result = applyUpdatePackage(envelope, fileName);
      return sendJson(res, 200, { update: result });
    }

    if (url.pathname === "/api/me/password" && method === "POST") {
      const body = await readBody(req);
      const target = db.users.find((item) => item.id === user.id && item.active);
      if (!target) return sendError(res, 401, "Accesso richiesto");
      const newPassword = cleanString(body.newPassword);
      const confirmPassword = cleanString(body.confirmPassword);
      if (!target.mustChangePassword && !verifyPassword(body.currentPassword || "", target)) {
        return sendError(res, 401, "Password attuale non corretta");
      }
      if (newPassword.length < 8) return sendError(res, 400, "La nuova password deve avere almeno 8 caratteri");
      if (confirmPassword && confirmPassword !== newPassword) return sendError(res, 400, "Le password non coincidono");
      if (newPassword.replace(/\s+/g, "") === DEFAULT_ADMIN_PASSWORD) {
        return sendError(res, 400, "Scegli una password diversa da quella di default");
      }
      const passwordInfo = makePassword(newPassword);
      target.passwordHash = passwordInfo.hash;
      target.passwordSalt = passwordInfo.salt;
      target.mustChangePassword = false;
      target.defaultPassword = false;
      target.updatedAt = new Date().toISOString();
      writeDb(db);
      return sendJson(res, 200, { user: publicUser(target) });
    }

    if (parts[1] === "settings" && parts[2] === "branding") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (method === "GET") {
        return sendJson(res, 200, { branding: publicBrandingSettings(db) });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        const current = db.settings.branding || {};
        const currentColors = current.colors || {};
        const currentLoginBackground = current.loginBackground || {};
        const logoUrl = savePhoto(body.logoData, "branding-logo") || (body.clearLogo === true ? "" : current.logoUrl || "");
        const loginBackgroundImageUrl =
          savePhoto(body.loginBackgroundImageData, "login-background") ||
          (body.clearLoginBackgroundImage === true ? "" : currentLoginBackground.imageUrl || "");
        const requestedLoginBackground = body.loginBackground || {};
        db.settings.branding = {
          ...current,
          theme: ["light", "dark", "custom"].includes(body.theme) ? body.theme : current.theme || "light",
          portalName: cleanString(body.portalName) || "Groomly",
          businessName: cleanString(body.businessName) || "Groomly",
          tagline: cleanString(body.tagline),
          companyInfo: cleanString(body.companyInfo),
          phone: cleanString(body.phone),
          email: cleanString(body.email),
          address: cleanString(body.address),
          logoUrl,
          loginBackground: {
            mode: ["pattern", "solid", "gradient", "image"].includes(requestedLoginBackground.mode)
              ? requestedLoginBackground.mode
              : currentLoginBackground.mode || "pattern",
            solidColor: cleanHexColor(requestedLoginBackground.solidColor, currentLoginBackground.solidColor || "#f6f3ed"),
            patternColor: cleanHexColor(requestedLoginBackground.patternColor, currentLoginBackground.patternColor || "#f6f3ed"),
            patternAccentColor: cleanHexColor(requestedLoginBackground.patternAccentColor, currentLoginBackground.patternAccentColor || "#ded9cf"),
            gradientTop: cleanHexColor(requestedLoginBackground.gradientTop, currentLoginBackground.gradientTop || "#f6f3ed"),
            gradientBottom: cleanHexColor(requestedLoginBackground.gradientBottom, currentLoginBackground.gradientBottom || "#dfe9e4"),
            imageUrl: loginBackgroundImageUrl
          },
          colors: {
            brand: cleanHexColor(body.colors?.brand, currentColors.brand || "#234344"),
            brandStrong: cleanHexColor(body.colors?.brandStrong, currentColors.brandStrong || "#183233"),
            accent: cleanHexColor(body.colors?.accent, currentColors.accent || "#cf6155"),
            background: cleanHexColor(body.colors?.background, currentColors.background || "#f6f3ed"),
            panel: cleanHexColor(body.colors?.panel, currentColors.panel || "#ffffff"),
            text: cleanHexColor(body.colors?.text, currentColors.text || "#162625")
          },
          updatedAt: new Date().toISOString()
        };
        writeDb(db);
        broadcastDataChange("settings", { section: "branding" });
        return sendJson(res, 200, { branding: publicBrandingSettings(db) });
      }
    }

    if (parts[1] === "settings" && parts[2] === "whatsapp") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (method === "GET") {
        return sendJson(res, 200, { whatsapp: publicWhatsappSettings(db) });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        const current = db.settings.whatsapp || {};
        const next = {
          ...current,
          enabled: body.enabled === true,
          mode: body.mode === "cloud-api" ? "cloud-api" : "manual",
          countryPrefix: cleanString(body.countryPrefix) || "+39",
          reminderHoursBefore: cleanNumber(body.reminderHoursBefore, 24),
          template: cleanString(body.template) || defaultSettings().whatsapp.template,
          cloudPhoneNumberId: cleanString(body.cloudPhoneNumberId),
          updatedAt: new Date().toISOString()
        };
        const token = cleanString(body.cloudAccessToken);
        if (token) next.cloudAccessToken = token;
        if (body.clearCloudAccessToken === true) next.cloudAccessToken = "";
        db.settings.whatsapp = next;
        writeDb(db);
        broadcastDataChange("settings", { section: "whatsapp" });
        return sendJson(res, 200, { whatsapp: publicWhatsappSettings(db) });
      }
    }

    if (parts[1] === "settings" && parts[2] === "animal") {
      if (method === "GET") {
        return sendJson(res, 200, { animal: publicAnimalSettings(db) });
      }
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (method === "PUT") {
        const body = await readBody(req);
        db.settings.animal = {
          breeds: cleanStringList(body.breeds, defaultSettings().animal.breeds),
          services: cleanStringList(body.services, defaultSettings().animal.services),
          colors: cleanStringList(body.colors, defaultSettings().animal.colors),
          loyaltyTopVisitsPerYear: Math.max(1, cleanNumber(body.loyaltyTopVisitsPerYear, 8)),
          updatedAt: new Date().toISOString()
        };
        writeDb(db);
        broadcastDataChange("settings", { section: "animal" });
        return sendJson(res, 200, { animal: publicAnimalSettings(db) });
      }
    }

    if (parts[1] === "settings" && parts[2] === "navigation") {
      if (method === "GET") {
        return sendJson(res, 200, { navigation: publicNavigationSettings(db) });
      }
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (method === "PUT") {
        const body = await readBody(req);
        db.settings.navigation = {
          sidebarOrder: cleanSidebarOrder(body.sidebarOrder),
          updatedAt: new Date().toISOString()
        };
        writeDb(db);
        broadcastDataChange("settings", { section: "navigation" });
        return sendJson(res, 200, { navigation: publicNavigationSettings(db) });
      }
    }

    if (parts[1] === "backup") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (parts[2] === "export" && method === "POST") {
        const body = await readBody(req);
        const backup = encryptBackup(
          {
            exportedAt: new Date().toISOString(),
            db,
            uploads: readUploadsForBackup()
          },
          body.password
        );
        return sendJson(res, 200, {
          fileName: `toelettatura-backup-${new Date().toISOString().slice(0, 10)}.json`,
          backup
        });
      }
      if (parts[2] === "import" && method === "POST") {
        const body = await readBody(req);
        const backupPayload = decryptBackup(body.backup, body.password);
        restoreBackup(backupPayload);
        broadcastDataChange("backup", { action: "import" });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[1] === "settings" && parts[2] === "duckdns") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (method === "GET") {
        return sendJson(res, 200, { duckdns: publicDuckDnsSettings(db, req) });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        const current = db.settings.duckdns || {};
        const next = {
          ...current,
          domain: normalizeDuckDnsDomain(body.domain),
          publicProtocol: body.publicProtocol === "http" ? "http" : "https",
          publicPort: cleanString(body.publicPort).replace(/[^\d]/g, "").slice(0, 5),
          updatedAt: new Date().toISOString()
        };
        const token = cleanString(body.token);
        if (token) next.token = token;
        if (body.clearToken === true) next.token = "";
        db.settings.duckdns = next;
        writeDb(db);
        broadcastDataChange("settings", { section: "duckdns" });
        return sendJson(res, 200, { duckdns: publicDuckDnsSettings(db, req) });
      }
    }

    if (parts[1] === "duckdns" && parts[2] === "update" && method === "POST") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      try {
        const result = await updateDuckDns(db.settings.duckdns);
        db.settings.duckdns.lastUpdateAt = new Date().toISOString();
        db.settings.duckdns.lastResult = result;
        writeDb(db);
        broadcastDataChange("settings", { section: "duckdns" });
        return sendJson(res, 200, { result, duckdns: publicDuckDnsSettings(db, req) });
      } catch (error) {
        db.settings.duckdns.lastUpdateAt = new Date().toISOString();
        db.settings.duckdns.lastResult = error.message || "Errore DuckDNS";
        writeDb(db);
        broadcastDataChange("settings", { section: "duckdns" });
        return sendError(res, 502, db.settings.duckdns.lastResult);
      }
    }

    if (parts[1] === "dogs") {
      const id = parts[2];
      if (method === "GET") {
        return sendJson(res, 200, { dogs: db.dogs });
      }
      if (method === "POST") {
        const body = await readBody(req);
        const dog = normalizeDog(body);
        const validationError = validateDogForSave(dog);
        if (validationError) return sendError(res, 400, validationError);
        updateAnimalOptionsFromDog(db, dog);
        db.dogs.push(dog);
        writeDb(db);
        broadcastDataChange("dogs", { action: "create", id: dog.id });
        return sendJson(res, 201, { dog });
      }
      const index = db.dogs.findIndex((item) => item.id === id);
      if (index === -1) return sendError(res, 404, "Scheda non trovata");
      if (method === "PUT") {
        const body = await readBody(req);
        const dog = normalizeDog(body, db.dogs[index]);
        const validationError = validateDogForSave(dog);
        if (validationError) return sendError(res, 400, validationError);
        updateAnimalOptionsFromDog(db, dog);
        db.dogs[index] = dog;
        db.appointments = db.appointments.map((appointment) =>
          appointment.dogId === dog.id
            ? { ...appointment, dogName: dog.dogName, ownerName: dog.ownerName, contact: dog.contact, updatedAt: new Date().toISOString() }
            : appointment
        );
        writeDb(db);
        broadcastDataChange("dogs", { action: "update", id: dog.id });
        return sendJson(res, 200, { dog });
      }
      if (method === "DELETE") {
        db.dogs.splice(index, 1);
        writeDb(db);
        broadcastDataChange("dogs", { action: "delete", id });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[1] === "appointments") {
      const id = parts[2];
      if (method === "GET") {
        return sendJson(res, 200, { appointments: sortAppointments(db.appointments) });
      }
      if (method === "POST") {
        const body = await readBody(req);
        const prepared = maybeCreateDogFromAppointment(body, db);
        if (prepared.error) return sendError(res, 400, prepared.error);
        const appointment = normalizeAppointment(prepared.payload, db);
        if (!appointment.date || !appointment.startTime || !appointment.dogName) {
          return sendError(res, 400, "Data, orario e cane sono obbligatori");
        }
        updateAnimalOptionsFromAppointment(db, appointment);
        db.appointments.push(appointment);
        writeDb(db);
        broadcastDataChange("appointments", { action: "create", id: appointment.id });
        return sendJson(res, 201, { appointment, dog: prepared.dog });
      }
      const index = db.appointments.findIndex((item) => item.id === id);
      if (index === -1) return sendError(res, 404, "Appuntamento non trovato");
      if (method === "PUT") {
        const body = await readBody(req);
        const prepared = maybeCreateDogFromAppointment(body, db);
        if (prepared.error) return sendError(res, 400, prepared.error);
        const appointment = normalizeAppointment(prepared.payload, db, db.appointments[index]);
        if (!appointment.date || !appointment.startTime || !appointment.dogName) {
          return sendError(res, 400, "Data, orario e cane sono obbligatori");
        }
        updateAnimalOptionsFromAppointment(db, appointment);
        db.appointments[index] = appointment;
        writeDb(db);
        broadcastDataChange("appointments", { action: "update", id: appointment.id });
        return sendJson(res, 200, { appointment, dog: prepared.dog });
      }
      if (method === "DELETE") {
        db.appointments.splice(index, 1);
        writeDb(db);
        broadcastDataChange("appointments", { action: "delete", id });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[1] === "users") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      const id = parts[2];
      if (method === "GET") {
        const onlineIds = onlineUserIds();
        return sendJson(res, 200, { users: db.users.map((item) => publicUser(item, onlineIds)) });
      }
      if (method === "POST") {
        const body = await readBody(req);
        const username = cleanString(body.username);
        const password = cleanString(body.password);
        if (!username || !password) return sendError(res, 400, "Username e password sono obbligatori");
        if (db.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
          return sendError(res, 409, "Username gia esistente");
        }
        const passwordInfo = makePassword(password);
        const newUser = {
          id: crypto.randomUUID(),
          username,
          displayName: cleanString(body.displayName || username),
          role: body.role === "admin" ? "admin" : "user",
          active: body.active !== false,
          avatarUrl: savePhoto(body.avatarData, `user-${crypto.randomUUID()}`) || "",
          createdAt: new Date().toISOString(),
          passwordHash: passwordInfo.hash,
          passwordSalt: passwordInfo.salt
        };
        db.users.push(newUser);
        writeDb(db);
        broadcastDataChange("users", { action: "create", id: newUser.id });
        return sendJson(res, 201, { user: publicUser(newUser) });
      }
      const index = db.users.findIndex((item) => item.id === id);
      if (index === -1) return sendError(res, 404, "Utente non trovato");
      if (method === "PUT") {
        const body = await readBody(req);
        const nextUser = { ...db.users[index] };
        const nextUsername = cleanString(body.username || nextUser.username);
        if (db.users.some((item) => item.id !== id && item.username.toLowerCase() === nextUsername.toLowerCase())) {
          return sendError(res, 409, "Username gia esistente");
        }
        nextUser.username = nextUsername;
        nextUser.displayName = cleanString(body.displayName || nextUser.displayName || nextUsername);
        nextUser.role = body.role === "admin" ? "admin" : "user";
        nextUser.active = body.active !== false;
        nextUser.avatarUrl = savePhoto(body.avatarData, `user-${id}`) || (body.clearAvatar === true ? "" : nextUser.avatarUrl || "");
        nextUser.updatedAt = new Date().toISOString();
        if (cleanString(body.password)) {
          const passwordInfo = makePassword(body.password);
          nextUser.passwordHash = passwordInfo.hash;
          nextUser.passwordSalt = passwordInfo.salt;
        }
        const activeAdmins = db.users.filter((item) => item.id !== id && item.role === "admin" && item.active).length;
        if ((nextUser.role !== "admin" || !nextUser.active) && db.users[index].role === "admin" && db.users[index].active && activeAdmins === 0) {
          return sendError(res, 400, "Deve restare almeno un amministratore attivo");
        }
        db.users[index] = nextUser;
        writeDb(db);
        broadcastDataChange("users", { action: "update", id });
        return sendJson(res, 200, { user: publicUser(nextUser) });
      }
      if (method === "DELETE") {
        if (id === user.id) return sendError(res, 400, "Non puoi eliminare il tuo utente");
        const target = db.users[index];
        const activeAdmins = db.users.filter((item) => item.id !== id && item.role === "admin" && item.active).length;
        if (target.role === "admin" && target.active && activeAdmins === 0) {
          return sendError(res, 400, "Deve restare almeno un amministratore attivo");
        }
        db.users.splice(index, 1);
        writeDb(db);
        broadcastDataChange("users", { action: "delete", id });
        return sendJson(res, 200, { ok: true });
      }
    }

    sendError(res, 404, "Risorsa non trovata");
  } catch (error) {
    sendError(res, error.message === "Richiesta troppo grande" ? 413 : 500, error.message || "Errore server");
  }
}

function serveStatic(req, res, url) {
  let requestedPath = decodeURIComponent(url.pathname);
  let baseDir = PUBLIC_DIR;

  if (requestedPath.startsWith("/uploads/")) {
    baseDir = UPLOAD_DIR;
    requestedPath = requestedPath.replace(/^\/uploads\//, "/");
  } else if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const filePath = path.normalize(path.join(baseDir, requestedPath));
  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (!url.pathname.startsWith("/api/") && !path.extname(requestedPath) && baseDir === PUBLIC_DIR) {
        return fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallbackData) => {
          if (fallbackError) {
            res.writeHead(404);
            return res.end("Not found");
          }
          res.writeHead(200, { "Content-Type": mimeTypes[".html"], "Cache-Control": staticCacheControl("/index.html", PUBLIC_DIR) });
          res.end(fallbackData);
        });
      }
      res.writeHead(404);
      return res.end("Not found");
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": staticCacheControl(requestedPath, baseDir)
    });
    res.end(data);
  });
}

function staticCacheControl(requestedPath, baseDir) {
  if (baseDir !== PUBLIC_DIR) return "public, max-age=3600";
  const noCacheFiles = new Set([
    "/index.html",
    "/app.js",
    "/styles.css",
    "/manifest.json",
    "/sw.js",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/favicon.png"
  ]);
  return noCacheFiles.has(requestedPath) ? "no-cache, no-transform" : "public, max-age=3600";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

ensureStorage();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Groomly attivo su http://localhost:${PORT}`);
});

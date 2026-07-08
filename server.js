const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3017);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_BODY_BYTES = 16 * 1024 * 1024;

const sessions = new Map();

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
      portalName: "Toilettatura Manager",
      businessName: "Toilettatura",
      tagline: "Agenda e schede clienti",
      companyInfo: "",
      phone: "",
      email: "",
      address: "",
      logoUrl: "",
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
    }
  };
}

function ensureSettingsShape(settings = {}) {
  const defaults = defaultSettings();
  const colors = {
    ...defaults.branding.colors,
    ...(settings.branding?.colors || {})
  };
  return {
    branding: {
      ...defaults.branding,
      ...(settings.branding || {}),
      colors
    },
    duckdns: {
      ...defaults.duckdns,
      ...(settings.duckdns || {})
    },
    whatsapp: {
      ...defaults.whatsapp,
      ...(settings.whatsapp || {})
    }
  };
}

function ensureStorage() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const adminPassword = makePassword("admin123");
    const userPassword = makePassword("operatore123");
    const now = new Date().toISOString();
    const db = {
      users: [
        {
          id: crypto.randomUUID(),
          username: "admin",
          displayName: "Amministratore",
          role: "admin",
          active: true,
          createdAt: now,
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

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: Boolean(user.active),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
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

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
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

function cleanHexColor(value, fallback) {
  const color = cleanString(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function savePhoto(dataUri, id) {
  if (!dataUri || typeof dataUri !== "string") return null;
  const match = dataUri.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;
  const extension = match[1].toLowerCase().replace("jpeg", "jpg");
  const fileName = `${id}-${Date.now()}.${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), Buffer.from(match[2], "base64"));
  return `/uploads/${fileName}`;
}

function publicBrandingSettings(db) {
  const branding = ensureSettingsShape(db.settings).branding;
  return {
    portalName: cleanString(branding.portalName) || "Toilettatura Manager",
    businessName: cleanString(branding.businessName) || "Toilettatura",
    tagline: cleanString(branding.tagline) || "Agenda e schede clienti",
    companyInfo: cleanString(branding.companyInfo),
    phone: cleanString(branding.phone),
    email: cleanString(branding.email),
    address: cleanString(branding.address),
    logoUrl: cleanString(branding.logoUrl),
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

function normalizeDog(payload, existing = {}) {
  const now = new Date().toISOString();
  const id = existing.id || crypto.randomUUID();
  const photoUrl = savePhoto(payload.photoData, id) || existing.photoUrl || "";
  return {
    id,
    dogName: stringField(payload, "dogName", existing.dogName),
    ownerName: stringField(payload, "ownerName", existing.ownerName),
    contact: stringField(payload, "contact", existing.contact),
    pathologies: stringField(payload, "pathologies", existing.pathologies),
    estimatedMinutes: numberField(payload, "estimatedMinutes", existing.estimatedMinutes),
    notes: stringField(payload, "notes", existing.notes),
    photoUrl,
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function normalizeAppointment(payload, db, existing = {}) {
  const now = new Date().toISOString();
  const id = existing.id || crypto.randomUUID();
  const dogId = stringField(payload, "dogId", existing.dogId);
  const dog = dogId ? db.dogs.find((item) => item.id === dogId) : null;
  return {
    id,
    dogId,
    dogName: cleanString(dog?.dogName || stringField(payload, "dogName", existing.dogName)),
    ownerName: cleanString(dog?.ownerName || stringField(payload, "ownerName", existing.ownerName)),
    contact: cleanString(dog?.contact || stringField(payload, "contact", existing.contact)),
    date: stringField(payload, "date", existing.date),
    startTime: stringField(payload, "startTime", existing.startTime),
    endTime: stringField(payload, "endTime", existing.endTime),
    service: stringField(payload, "service", existing.service),
    treatmentDone: stringField(payload, "treatmentDone", existing.treatmentDone),
    paidAmount: numberField(payload, "paidAmount", existing.paidAmount),
    status: ["programmato", "confermato", "completato", "annullato"].includes(payload.status) ? payload.status : existing.status || "programmato",
    notes: stringField(payload, "notes", existing.notes),
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

    if (url.pathname === "/api/public-settings" && method === "GET") {
      return sendJson(res, 200, { branding: publicBrandingSettings(db) });
    }

    if (url.pathname === "/api/login" && method === "POST") {
      const body = await readBody(req);
      const foundUser = db.users.find((item) => item.username.toLowerCase() === cleanString(body.username).toLowerCase());
      if (!foundUser || !foundUser.active || !verifyPassword(body.password || "", foundUser)) {
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

    if (parts[1] === "settings" && parts[2] === "branding") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      if (method === "GET") {
        return sendJson(res, 200, { branding: publicBrandingSettings(db) });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        const current = db.settings.branding || {};
        const currentColors = current.colors || {};
        const logoUrl = savePhoto(body.logoData, "branding-logo") || (body.clearLogo === true ? "" : current.logoUrl || "");
        db.settings.branding = {
          ...current,
          portalName: cleanString(body.portalName) || "Toilettatura Manager",
          businessName: cleanString(body.businessName) || "Toilettatura",
          tagline: cleanString(body.tagline),
          companyInfo: cleanString(body.companyInfo),
          phone: cleanString(body.phone),
          email: cleanString(body.email),
          address: cleanString(body.address),
          logoUrl,
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
        return sendJson(res, 200, { whatsapp: publicWhatsappSettings(db) });
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
          fileName: `toilettatura-backup-${new Date().toISOString().slice(0, 10)}.json`,
          backup
        });
      }
      if (parts[2] === "import" && method === "POST") {
        const body = await readBody(req);
        const backupPayload = decryptBackup(body.backup, body.password);
        restoreBackup(backupPayload);
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
        return sendJson(res, 200, { result, duckdns: publicDuckDnsSettings(db, req) });
      } catch (error) {
        db.settings.duckdns.lastUpdateAt = new Date().toISOString();
        db.settings.duckdns.lastResult = error.message || "Errore DuckDNS";
        writeDb(db);
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
        if (!dog.dogName) return sendError(res, 400, "Inserisci il nome del cane");
        db.dogs.push(dog);
        writeDb(db);
        return sendJson(res, 201, { dog });
      }
      const index = db.dogs.findIndex((item) => item.id === id);
      if (index === -1) return sendError(res, 404, "Scheda non trovata");
      if (method === "PUT") {
        const body = await readBody(req);
        const dog = normalizeDog(body, db.dogs[index]);
        if (!dog.dogName) return sendError(res, 400, "Inserisci il nome del cane");
        db.dogs[index] = dog;
        db.appointments = db.appointments.map((appointment) =>
          appointment.dogId === dog.id
            ? { ...appointment, dogName: dog.dogName, ownerName: dog.ownerName, contact: dog.contact, updatedAt: new Date().toISOString() }
            : appointment
        );
        writeDb(db);
        return sendJson(res, 200, { dog });
      }
      if (method === "DELETE") {
        db.dogs.splice(index, 1);
        writeDb(db);
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
        const appointment = normalizeAppointment(body, db);
        if (!appointment.date || !appointment.startTime || !appointment.dogName) {
          return sendError(res, 400, "Data, orario e cane sono obbligatori");
        }
        db.appointments.push(appointment);
        writeDb(db);
        return sendJson(res, 201, { appointment });
      }
      const index = db.appointments.findIndex((item) => item.id === id);
      if (index === -1) return sendError(res, 404, "Appuntamento non trovato");
      if (method === "PUT") {
        const body = await readBody(req);
        const appointment = normalizeAppointment(body, db, db.appointments[index]);
        if (!appointment.date || !appointment.startTime || !appointment.dogName) {
          return sendError(res, 400, "Data, orario e cane sono obbligatori");
        }
        db.appointments[index] = appointment;
        writeDb(db);
        return sendJson(res, 200, { appointment });
      }
      if (method === "DELETE") {
        db.appointments.splice(index, 1);
        writeDb(db);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (parts[1] === "users") {
      if (user.role !== "admin") return sendError(res, 403, "Solo amministratore");
      const id = parts[2];
      if (method === "GET") {
        return sendJson(res, 200, { users: db.users.map(publicUser) });
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
          createdAt: new Date().toISOString(),
          passwordHash: passwordInfo.hash,
          passwordSalt: passwordInfo.salt
        };
        db.users.push(newUser);
        writeDb(db);
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
          res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
          res.end(fallbackData);
        });
      }
      res.writeHead(404);
      return res.end("Not found");
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": requestedPath.includes("sw.js") ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
  });
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
  console.log(`Portale toilettatura attivo su http://localhost:${PORT}`);
});

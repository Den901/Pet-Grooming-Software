const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const toast = document.getElementById("toast");

const state = {
  me: null,
  dogs: [],
  appointments: [],
  users: [],
  onlineUserIds: [],
  duckdns: null,
  branding: null,
  whatsapp: null,
  animalSettings: null,
  navigation: null,
  loginUsers: [],
  version: null,
  initialAccessHint: false,
  updateCheck: null,
  updateCheckLoading: false,
  eventSource: null,
  liveRefreshTimer: null,
  serviceWorkerRegistration: null,
  appUpdateReady: false,
  appUpdatePromptDismissed: false,
  appUpdateReloading: false,
  revenueRange: "month",
  revenueSelectedPoint: null,
  deferredInstallPrompt: null,
  pwaPromptHidden: false,
  view: new URLSearchParams(window.location.search).get("view") || "calendar",
  calendarDate: new Date(),
  calendarMode: "month",
  dogSearch: "",
  serviceHistoryDogId: "",
  serviceHistoryDogQuery: ""
};

const weekdayShort = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const formatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "short" });
const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const CUSTOM_OPTION_VALUE = "__add_new__";
const NAV_ICONS = {
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16"></path><path d="M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2"></path></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13a8 8 0 0 1 16 0"></path><path d="M12 13l4-5"></path><path d="M7 17h10"></path><path d="M6 13h2M16 13h2"></path></svg>`,
  dogs: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"></path><path d="M9.4 14.2c.7-1.6 4.5-1.6 5.2 0 .6 1.4-.8 2.4-2.6 2.4s-3.2-1-2.6-2.4Z"></path><circle cx="8.7" cy="10" r="1.3"></circle><circle cx="15.3" cy="10" r="1.3"></circle><circle cx="11" cy="8.2" r="1.2"></circle><circle cx="13" cy="8.2" r="1.2"></circle></svg>`,
  serviceHistory: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"></path><path d="M8 9h8M8 13h5M8 17h8"></path><path d="M17 3v4M7 3v4"></path></svg>`,
  users: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><path d="M3.8 18c.8-3 3-4.5 5.2-4.5s4.4 1.5 5.2 4.5"></path><circle cx="16.8" cy="9" r="2.3"></circle><path d="M14.8 14.1c2.5.2 4.2 1.5 5 3.9"></path></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5"></path></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H5v16h4"></path><path d="M14 8l4 4-4 4"></path><path d="M18 12H9"></path></svg>`
};
const SIDEBAR_DEFINITIONS = {
  calendar: { id: "calendar", label: "Calendario", icon: "calendar" },
  dashboard: { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  dogs: { id: "dogs", label: "Schede", icon: "dogs" },
  serviceHistory: { id: "serviceHistory", label: "Storico servizi", icon: "serviceHistory" },
  users: { id: "users", label: "Utenti", icon: "users", adminOnly: true }
};
const DEFAULT_SIDEBAR_ORDER = ["calendar", "dashboard", "dogs", "serviceHistory", "users"];
let lastNewDogActionAt = 0;
const THEME_PRESETS = {
  light: {
    brand: "#234344",
    brandStrong: "#183233",
    accent: "#cf6155",
    background: "#f6f3ed",
    panel: "#ffffff",
    text: "#162625"
  },
  dark: {
    brand: "#68b7ad",
    brandStrong: "#0b1518",
    accent: "#e58a7d",
    background: "#081012",
    panel: "#121d20",
    text: "#eef7f3"
  }
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  renderPwaInstallPrompt();
});

window.addEventListener("appinstalled", () => {
  state.pwaPromptHidden = true;
  state.deferredInstallPrompt = null;
  renderPwaInstallPrompt();
  notify("App installata");
});

document.addEventListener("click", handlePhotoZoomClick);
document.addEventListener("click", handleNewDogAction);
document.addEventListener("pointerup", handleNewDogAction);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePhotoLightbox();
});

boot();

async function boot() {
  setupServiceWorkerUpdates();

  await loadPublicSettings();

  try {
    const response = await api("/api/me");
    state.me = response.user;
    if (!state.me) {
      renderLogin();
      renderPwaInstallPrompt();
      return;
    }
    await loadData();
    renderShell();
    checkUpdatesInBackground();
    promptDefaultPasswordChange();
  } catch {
    renderLogin();
    renderPwaInstallPrompt();
  }
}

function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;
  let hasController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (state.appUpdateReloading) {
      window.location.reload();
      return;
    }
    showAppUpdatePopup();
  });
  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      state.serviceWorkerRegistration = registration;
      watchServiceWorkerRegistration(registration);
      registration.update().catch(() => {});
      setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);
    })
    .catch(() => {});
  window.addEventListener("focus", checkServiceWorkerUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkServiceWorkerUpdate();
  });
}

function watchServiceWorkerRegistration(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) showAppUpdatePopup();
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) showAppUpdatePopup();
    });
  });
}

function checkServiceWorkerUpdate() {
  state.serviceWorkerRegistration?.update().catch(() => {});
}

function showAppUpdatePopup() {
  state.appUpdateReady = true;
  state.appUpdatePromptDismissed = false;
  renderAppUpdatePopup();
}

function renderAppUpdatePopup() {
  let popup = document.getElementById("appUpdatePopup");
  if (!state.appUpdateReady || state.appUpdatePromptDismissed) {
    popup?.remove();
    return;
  }
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "appUpdatePopup";
    document.body.appendChild(popup);
  }
  popup.className = "app-update-popup";
  popup.innerHTML = `
    <div class="app-update-card" role="dialog" aria-live="polite" aria-label="Nuova versione pronta">
      <div class="app-update-copy">
        <strong>Nuova versione pronta</strong>
        <span>Aggiorna il portale senza reinstallare la PWA.</span>
      </div>
      <div class="app-update-actions">
        <button class="btn small" type="button" data-app-update-reload>Aggiorna ora</button>
        <button class="btn ghost small" type="button" data-app-update-dismiss>Piu tardi</button>
      </div>
    </div>
  `;
  popup.querySelector("[data-app-update-reload]").addEventListener("click", applyAppShellUpdate);
  popup.querySelector("[data-app-update-dismiss]").addEventListener("click", () => {
    state.appUpdatePromptDismissed = true;
    renderAppUpdatePopup();
  });
}

async function applyAppShellUpdate() {
  state.appUpdateReloading = true;
  const registration = state.serviceWorkerRegistration || (await navigator.serviceWorker.getRegistration().catch(() => null));
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    setTimeout(() => window.location.reload(), 900);
    return;
  }
  window.location.reload();
}

async function loadPublicSettings() {
  try {
    const response = await api("/api/public-settings");
    state.branding = response.branding || state.branding;
    state.navigation = response.navigation || state.navigation;
    state.loginUsers = Array.isArray(response.loginUsers) ? response.loginUsers : state.loginUsers;
    state.initialAccessHint = Boolean(response.setup?.showInitialAccessHint);
    applyBranding();
  } catch {
    applyBranding();
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Errore di comunicazione");
  return payload;
}

function getBranding() {
  return {
    theme: "light",
    portalName: "Groomly",
    businessName: "Groomly",
    tagline: "Agenda e schede clienti",
    companyInfo: "",
    phone: "",
    email: "",
    address: "",
    logoUrl: "",
    uiScale: 100,
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
    },
    ...(state.branding || {}),
    theme: ["light", "dark", "custom"].includes(state.branding?.theme) ? state.branding.theme : "light",
    uiScale: normalizeUiScale(state.branding?.uiScale ?? 100),
    loginBackground: {
      mode: "pattern",
      solidColor: "#f6f3ed",
      patternColor: "#f6f3ed",
      patternAccentColor: "#ded9cf",
      gradientTop: "#f6f3ed",
      gradientBottom: "#dfe9e4",
      imageUrl: "",
      ...(state.branding?.loginBackground || {})
    },
    colors: {
      brand: "#234344",
      brandStrong: "#183233",
      accent: "#cf6155",
      background: "#f6f3ed",
      panel: "#ffffff",
      text: "#162625",
      ...(state.branding?.colors || {})
    }
  };
}

function getAnimalSettings() {
  return {
    breeds: ["Meticcio"],
    services: ["Bagno", "Taglio", "Snodatura", "Stripping"],
    colors: ["Nero", "Bianco", "Marrone", "Fulvo", "Grigio", "Beige", "Crema", "Rosso", "Dorato", "Tricolore", "Pezzato", "Tigrato", "Merle"],
    loyaltyTopVisitsPerYear: 8,
    ...(state.animalSettings || {})
  };
}

function sidebarOrder(order = state.navigation?.sidebarOrder) {
  const seen = new Set();
  const result = [];
  const source = Array.isArray(order) ? order : DEFAULT_SIDEBAR_ORDER;
  for (const id of source) {
    if (!SIDEBAR_DEFINITIONS[id] || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  for (const id of DEFAULT_SIDEBAR_ORDER) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function renderNavSymbol(iconName) {
  return `<span class="nav-symbol" aria-hidden="true">${NAV_ICONS[iconName] || NAV_ICONS.calendar}</span>`;
}

function normalizeUiScale(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(105, Math.max(85, Math.round(number / 5) * 5));
}

function renderNavLabel(item) {
  const hasUpdate = item.id === "settings" && state.updateCheck?.updateAvailable;
  return `<span class="nav-label"><span class="nav-label-text">${escapeHtml(item.label)}</span>${hasUpdate ? `<i class="nav-update-badge" title="Update disponibile" aria-label="Update disponibile"></i>` : ""}</span>`;
}

function loginUserFromUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    avatarUrl: user.avatarUrl || ""
  };
}

function applyBranding() {
  const branding = getBranding();
  const colors = branding.colors;
  const theme = branding.theme === "dark" || (branding.theme === "custom" && isDarkHex(colors.background)) ? "dark" : "light";
  const loginBackground = loginBackgroundCss(branding.loginBackground, colors);
  document.documentElement.dataset.theme = theme;
  document.title = branding.portalName || "Groomly";
  const variables = {
    "--brand": colors.brand,
    "--brand-strong": colors.brandStrong,
    "--accent": colors.accent,
    "--bg": colors.background,
    "--panel": colors.panel,
    "--ink": colors.text,
    "--green": theme === "dark" ? colors.brand : "#2f7a65",
    "--panel-soft": theme === "dark" ? "#182629" : "#fbfaf7",
    "--muted": theme === "dark" ? "#a5b6b1" : "#63716f",
    "--line": theme === "dark" ? "#2b3d42" : "#ded9cf",
    "--shadow": theme === "dark" ? "0 18px 40px rgba(0, 0, 0, 0.34)" : "0 18px 40px rgba(22, 38, 37, 0.1)",
    "--ui-scale": String(normalizeUiScale(branding.uiScale) / 100),
    "--login-background": loginBackground.background,
    "--login-background-size": loginBackground.size,
    "--login-background-position": loginBackground.position
  };
  for (const [key, value] of Object.entries(variables)) {
    if (key === "--ui-scale" || key.startsWith("--login-") || key === "--shadow" || /^#[0-9a-f]{6}$/i.test(value)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
}

function isDarkHex(hex) {
  const clean = safeHex(hex, "#ffffff").slice(1);
  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
}

function loginBackgroundCss(loginBackground = {}, colors = {}) {
  const mode = ["pattern", "solid", "gradient", "image"].includes(loginBackground.mode) ? loginBackground.mode : "pattern";
  const solid = safeHex(loginBackground.solidColor, colors.background || "#f6f3ed");
  const patternBase = safeHex(loginBackground.patternColor, solid);
  const patternAccent = safeHex(loginBackground.patternAccentColor, colors.accent || "#cf6155");
  const top = safeHex(loginBackground.gradientTop, solid);
  const bottom = safeHex(loginBackground.gradientBottom, colors.brand || "#234344");
  const imageUrl = safeCssUrl(loginBackground.imageUrl);
  if (mode === "solid") {
    return { background: solid, size: "cover", position: "center" };
  }
  if (mode === "gradient") {
    return { background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`, size: "cover", position: "center" };
  }
  if (mode === "image" && imageUrl) {
    return {
      background: `linear-gradient(rgba(246, 243, 237, 0.16), rgba(246, 243, 237, 0.16)), url("${imageUrl}")`,
      size: "cover",
      position: "center"
    };
  }
  return {
    background: `radial-gradient(circle at 16px 16px, ${hexToRgba(patternAccent, 0.32)} 2px, transparent 2.5px), ${patternBase}`,
    size: "32px 32px, cover",
    position: "center"
  };
}

function safeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function hexToRgba(hex, alpha) {
  const clean = safeHex(hex, "#000000").slice(1);
  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function safeCssUrl(value) {
  const url = String(value || "");
  if (!url.startsWith("/uploads/")) return "";
  return url.replace(/["\\\n\r]/g, "");
}

function renderBrandMark(className) {
  const branding = getBranding();
  if (branding.logoUrl) {
    return `<div class="${className} has-logo"><img src="${escapeAttr(branding.logoUrl)}" alt="${escapeAttr(branding.businessName)}" /></div>`;
  }
  return `<div class="${className}">${escapeHtml(initials(branding.businessName || branding.portalName))}</div>`;
}

async function loadData() {
  const [meResponse, dogsResponse, appointmentsResponse, animalResponse, navigationResponse, brandingResponse] = await Promise.all([
    api("/api/me"),
    api("/api/dogs"),
    api("/api/appointments"),
    api("/api/settings/animal"),
    api("/api/settings/navigation"),
    api("/api/settings/branding")
  ]);
  state.me = meResponse.user || state.me;
  state.dogs = dogsResponse.dogs || [];
  state.appointments = appointmentsResponse.appointments || [];
  state.animalSettings = animalResponse.animal || state.animalSettings;
  state.navigation = navigationResponse.navigation || state.navigation;
  state.branding = brandingResponse.branding || state.branding;
  applyBranding();
  if (state.me?.role === "admin") {
    const [usersResponse, duckdnsResponse, whatsappResponse, versionResponse] = await Promise.all([
      api("/api/users"),
      api("/api/settings/duckdns"),
      api("/api/settings/whatsapp"),
      api("/api/version")
    ]);
    state.users = usersResponse.users || [];
    state.onlineUserIds = state.users.filter((user) => user.online).map((user) => user.id);
    state.loginUsers = state.users.filter((user) => user.active).map(loginUserFromUser);
    state.duckdns = duckdnsResponse.duckdns || null;
    state.whatsapp = whatsappResponse.whatsapp || null;
    state.version = versionResponse || null;
  } else {
    state.users = [];
    state.onlineUserIds = [];
    state.duckdns = null;
    state.whatsapp = null;
    state.version = null;
  }
}

function connectLiveUpdates() {
  if (state.eventSource || !state.me || typeof EventSource !== "function") return;
  const source = new EventSource("/api/events");
  state.eventSource = source;
  source.onmessage = (event) => {
    const payload = JSON.parse(event.data || "{}");
    if (payload.type === "connected" || payload.type === "presence") {
      applyOnlineUsers(payload.detail?.onlineUserIds || []);
      return;
    }
    if (!payload.type) return;
    clearTimeout(state.liveRefreshTimer);
    state.liveRefreshTimer = setTimeout(async () => {
      await loadData();
      if (state.me) renderShell();
      notify("Portale aggiornato");
    }, 350);
  };
  source.onerror = () => {
    source.close();
    state.eventSource = null;
    setTimeout(connectLiveUpdates, 4000);
  };
}

function applyOnlineUsers(onlineUserIds = []) {
  state.onlineUserIds = onlineUserIds;
  const online = new Set(onlineUserIds);
  state.users = state.users.map((user) => ({ ...user, online: online.has(user.id) }));
  if (state.view === "users") renderView();
}

function renderLogin(error = "") {
  const branding = getBranding();
  const initialAccessHint = state.initialAccessHint;
  const loginUsers = state.loginUsers || [];
  const selectedLoginUser = loginUsers[0] || null;
  app.className = "login-screen";
  app.innerHTML = `
    <section class="login-panel">
      ${renderBrandMark("brand-mark")}
      <h1>${escapeHtml(branding.portalName)}</h1>
      <p>${escapeHtml(branding.businessName)}${branding.tagline ? ` - ${escapeHtml(branding.tagline)}` : ""}</p>
      ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ""}
      <form class="login-form" id="loginForm">
        ${
          loginUsers.length
            ? `<label>Utente
                <select name="username" autocomplete="username" required>
                  ${loginUsers
                    .map((user) => `<option value="${escapeAttr(user.username)}">${escapeHtml(user.displayName || user.username)} - ${escapeHtml(user.role === "admin" ? "Admin" : "Operatore")}</option>`)
                    .join("")}
                </select>
              </label>
              <div class="login-user-preview" id="loginUserPreview">
                ${renderLoginUserPreview(selectedLoginUser)}
              </div>`
            : `<label>Username
                <input name="username" autocomplete="username" required />
              </label>`
        }
        <label>Password
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="btn" type="submit">Entra</button>
      </form>
      ${
        initialAccessHint
          ? `<div class="hint-box">
              Accesso iniziale admin: <strong>admin</strong> / <strong>admin123</strong><br />
              Operatore demo: <strong>operatore</strong> / <strong>operatore123</strong>
            </div>`
          : ""
      }
    </section>
  `;
  bindLoginUserPreview();
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const response = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password")
        })
      });
      state.me = response.user;
      state.initialAccessHint = false;
      await loadData();
      renderShell();
      checkUpdatesInBackground();
      connectLiveUpdates();
      notify("Accesso effettuato");
      promptDefaultPasswordChange();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function renderLoginUserPreview(user) {
  if (!user) return `<span class="muted">Seleziona un utente</span>`;
  const name = user.displayName || user.username;
  const avatar = user.avatarUrl
    ? `<img src="${escapeAttr(user.avatarUrl)}" alt="Foto profilo ${escapeAttr(name)}" />`
    : `<span>${escapeHtml(initials(name))}</span>`;
  return `
    <span class="login-user-avatar">${avatar}</span>
    <div>
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(user.role === "admin" ? "Amministratore" : "Operatore")}</span>
    </div>
  `;
}

function bindLoginUserPreview() {
  const select = document.querySelector('#loginForm select[name="username"]');
  const preview = document.getElementById("loginUserPreview");
  if (!select || !preview) return;
  const sync = () => {
    const user = state.loginUsers.find((item) => item.username === select.value);
    preview.innerHTML = renderLoginUserPreview(user);
  };
  select.addEventListener("change", sync);
  sync();
}

function promptDefaultPasswordChange() {
  if (!state.me?.mustChangePassword) return;
  openDefaultPasswordDialog();
}

function openDefaultPasswordDialog() {
  openModal({
    title: "Cambio password admin",
    submitLabel: "Aggiorna password",
    preventClose: true,
    content: `
      <div class="warning-box">
        La password dell'amministratore e ancora quella di default: <strong>admin123</strong>.
        Per sicurezza cambiala adesso prima di usare il portale.
      </div>
      <div class="form-grid">
        <label class="full">Nuova password
          <input name="newPassword" type="password" minlength="8" autocomplete="new-password" required />
        </label>
        <label class="full">Ripeti nuova password
          <input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required />
        </label>
      </div>
    `,
    onSubmit: async (formData) => {
      const response = await api("/api/me/password", {
        method: "POST",
        body: JSON.stringify({
          newPassword: formData.get("newPassword"),
          confirmPassword: formData.get("confirmPassword")
        })
      });
      state.me = response.user;
      await loadData();
      renderShell();
      checkUpdatesInBackground();
      connectLiveUpdates();
      notify("Password admin aggiornata");
    }
  });
}

function renderShell() {
  if (!state.me) {
    renderLogin();
    return;
  }
  if (!canAccessView(state.view)) state.view = "calendar";
  app.className = "";
  const items = navItems();
  const branding = getBranding();
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-head">
          ${renderBrandMark("sidebar-logo")}
          <div class="sidebar-title">
            <strong>${escapeHtml(branding.businessName)}</strong>
            <span>${escapeHtml(branding.tagline)}</span>
          </div>
        </div>
        <nav class="nav" aria-label="Sezioni">
          ${items
            .map(
              (item) => `
                <button class="nav-item ${state.view === item.id ? "active" : ""}" data-nav="${item.id}" type="button">
                  ${renderNavSymbol(item.icon)}
                  ${renderNavLabel(item)}
                </button>
              `
            )
            .join("")}
        </nav>
        <div class="sidebar-bottom">
          <div class="user-card">
            ${renderUserAvatar(state.me, "sidebar-user-avatar")}
            <div>
              <strong>${escapeHtml(state.me.displayName || state.me.username)}</strong>
              <span>${state.me.role === "admin" ? "Amministratore" : "Operatore"}</span>
            </div>
          </div>
          ${
            state.me.role === "admin"
              ? `<button class="nav-item nav-item-bottom ${state.view === "settings" ? "active" : ""}" data-nav="settings" type="button">
                  ${renderNavSymbol("settings")}
                  ${renderNavLabel({ id: "settings", label: "Impostazioni" })}
                </button>`
              : ""
          }
          <button class="nav-item nav-item-bottom logout-item" type="button" id="logoutBtn">
            ${renderNavSymbol("logout")}
            <span>Esci</span>
          </button>
        </div>
      </aside>
      <main class="main" id="mainContent"></main>
    </div>
  `;
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.nav;
      window.history.replaceState(null, "", `?view=${state.view}`);
      renderShell();
    });
  });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  renderView();
  renderPwaInstallPrompt();
  connectLiveUpdates();
}

function navItems() {
  return sidebarOrder()
    .map((id) => SIDEBAR_DEFINITIONS[id])
    .filter((item) => item && (!item.adminOnly || state.me?.role === "admin"));
}

function canAccessView(view) {
  return navItems().some((item) => item.id === view) || (view === "settings" && state.me?.role === "admin");
}

async function logout() {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  state.me = null;
  state.dogs = [];
  state.appointments = [];
  state.users = [];
  state.onlineUserIds = [];
  state.duckdns = null;
  state.whatsapp = null;
  state.animalSettings = null;
  state.navigation = null;
  state.version = null;
  state.updateCheck = null;
  state.updateCheckLoading = false;
  state.serviceHistoryDogId = "";
  state.serviceHistoryDogQuery = "";
  state.eventSource?.close();
  state.eventSource = null;
  await loadPublicSettings();
  renderLogin();
  renderPwaInstallPrompt();
}

function renderView() {
  const main = document.getElementById("mainContent");
  if (state.view === "calendar") main.innerHTML = renderCalendar();
  if (state.view === "dashboard") main.innerHTML = renderDashboard();
  if (state.view === "dogs") main.innerHTML = renderDogs();
  if (state.view === "serviceHistory") main.innerHTML = renderServiceHistory();
  if (state.view === "users") main.innerHTML = renderUsers();
  if (state.view === "settings") main.innerHTML = renderSettings();

  if (state.view === "calendar") bindCalendar();
  if (state.view === "dashboard") bindDashboard();
  if (state.view === "dogs") bindDogs();
  if (state.view === "serviceHistory") bindServiceHistory();
  if (state.view === "users") bindUsers();
  if (state.view === "settings") bindSettings();
  renderPwaInstallPrompt();
}

function shouldShowPwaInstallPrompt() {
  const standalone = mediaMatches("(display-mode: standalone)") || window.navigator.standalone === true;
  const mobileSurface = mediaMatches("(max-width: 1024px)") && (mediaMatches("(pointer: coarse)") || isAppleMobile());
  return !standalone && !state.pwaPromptHidden && mobileSurface;
}

function renderPwaInstallPrompt() {
  let prompt = document.getElementById("pwaInstallPrompt");
  if (!shouldShowPwaInstallPrompt()) {
    prompt?.remove();
    return;
  }
  const isNativeInstall = Boolean(state.deferredInstallPrompt);
  if (!prompt) {
    prompt = document.createElement("div");
    prompt.id = "pwaInstallPrompt";
    document.body.appendChild(prompt);
  }
  prompt.className = "pwa-install-prompt";
  prompt.innerHTML = `
    <div class="pwa-install-copy">
      <strong>Installa il portale</strong>
      <span>${isNativeInstall ? "Aprilo come app dalla schermata Home." : "Su iPhone usa Condividi e poi Aggiungi alla schermata Home."}</span>
    </div>
    <div class="pwa-install-actions">
      <button class="btn small" type="button" data-pwa-install>${isNativeInstall ? "Installa app" : "Mostra passaggi"}</button>
      <button class="btn ghost small" type="button" data-pwa-dismiss>Piu tardi</button>
    </div>
  `;
  prompt.querySelector("[data-pwa-install]").addEventListener("click", handlePwaInstallClick);
  prompt.querySelector("[data-pwa-dismiss]").addEventListener("click", () => {
    state.pwaPromptHidden = true;
    renderPwaInstallPrompt();
  });
}

async function handlePwaInstallClick() {
  if (!state.deferredInstallPrompt) {
    openPwaInstallHelp();
    return;
  }
  const installPrompt = state.deferredInstallPrompt;
  state.deferredInstallPrompt = null;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice.catch(() => ({}));
  if (choice.outcome === "accepted") state.pwaPromptHidden = true;
  renderPwaInstallPrompt();
}

function openPwaInstallHelp() {
  openModal({
    title: "Installa app",
    submitLabel: "Ho capito",
    content: `
      <div class="install-help">
        <p>Su iPhone o iPad apri il menu Condividi di Safari e scegli Aggiungi alla schermata Home.</p>
        <p>Quando apri il portale dall'icona salvata, si comporta come una app.</p>
      </div>
    `,
    onSubmit: async () => {}
  });
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function mediaMatches(query) {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function renderCalendar() {
  const today = todayISO();
  const todayAppointments = appointmentsForDate(today);
  const future = state.appointments.filter((item) => item.date >= today && item.status !== "annullato");
  const completed = state.appointments.filter((item) => item.status === "completato");
  return `
    <div class="calendar-page">
      <div class="topbar">
        <div class="page-title">
          <h1>Calendario</h1>
          <p>${calendarTitle()}</p>
        </div>
        <button class="btn" type="button" id="newAppointmentBtn">Nuovo appuntamento</button>
      </div>
      <section class="metric-grid" aria-label="Riepilogo agenda">
        <div class="metric"><span>Oggi</span><strong>${todayAppointments.length}</strong></div>
        <div class="metric"><span>Prossimi</span><strong>${future.length}</strong></div>
        <div class="metric"><span>Completati</span><strong>${completed.length}</strong></div>
      </section>
      <div class="toolbar">
        <div class="toolbar-left">
          <button class="btn secondary" type="button" id="prevPeriod">Indietro</button>
          <button class="btn secondary" type="button" id="todayBtn">Oggi</button>
          <button class="btn secondary" type="button" id="nextPeriod">Avanti</button>
        </div>
        <div class="segmented" role="group" aria-label="Vista calendario">
          <button type="button" data-calendar-mode="day" class="${state.calendarMode === "day" ? "active" : ""}">Giorno</button>
          <button type="button" data-calendar-mode="week" class="${state.calendarMode === "week" ? "active" : ""}">Settimana</button>
          <button type="button" data-calendar-mode="month" class="${state.calendarMode === "month" ? "active" : ""}">Mese</button>
        </div>
      </div>
      ${renderCalendarView()}
    </div>
  `;
}

function calendarTitle() {
  if (state.calendarMode === "month") return capitalize(monthFormatter.format(state.calendarDate));
  if (state.calendarMode === "week") return weekTitle(state.calendarDate);
  return capitalize(formatter.format(state.calendarDate));
}

function renderCalendarView() {
  if (state.calendarMode === "month") return renderMonthCalendar();
  if (state.calendarMode === "week") return renderWeekCalendar();
  return renderDayCalendar();
}

function renderMonthCalendar() {
  const first = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
  let cursor = startOfWeek(first);
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const iso = toISODate(cursor);
    const outside = cursor.getMonth() !== state.calendarDate.getMonth();
    const dayAppointments = appointmentsForDate(iso);
    cells.push(`
      <div class="day-cell ${outside ? "outside" : ""} ${iso === todayISO() ? "today" : ""}">
        <div class="day-head">
          <button class="day-open-button" type="button" data-open-day="${iso}" title="Apri giornata ${escapeAttr(formatter.format(cursor))}">
            <span class="day-number">${cursor.getDate()}</span>
            <span class="day-open-icon" aria-hidden="true">${NAV_ICONS.calendar}</span>
          </button>
        </div>
        <div class="appointment-list">
          ${dayAppointments.map(renderAppointmentPill).join("")}
        </div>
      </div>
    `);
    cursor = addDays(cursor, 1);
  }
  return `
    <section class="calendar month-calendar calendar-desktop">
      <div class="calendar-weekdays">${weekdayShort.map((day) => `<div>${day}</div>`).join("")}</div>
      <div class="calendar-grid">${cells.join("")}</div>
    </section>
    ${renderMobileCalendarList()}
  `;
}

function renderWeekCalendar() {
  const start = startOfWeek(state.calendarDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return `
    <section class="week-grid calendar-desktop">
      ${days
        .map((day) => {
          const iso = toISODate(day);
          const dayAppointments = appointmentsForDate(iso);
          return `
            <div class="week-day ${iso === todayISO() ? "today" : ""}">
              <div class="day-head">
                <button class="day-open-button week-day-open" type="button" data-open-day="${iso}" title="Apri giornata ${escapeAttr(formatter.format(day))}">
                  <span class="week-day-title">${capitalize(formatter.format(day))}</span>
                  <span class="day-open-icon" aria-hidden="true">${NAV_ICONS.calendar}</span>
                </button>
              </div>
              <div class="appointment-list">
                ${dayAppointments.length ? dayAppointments.map(renderAppointmentPill).join("") : `<span class="muted">Nessun appuntamento</span>`}
              </div>
            </div>
          `;
        })
        .join("")}
    </section>
    ${renderMobileCalendarList()}
  `;
}

function renderDayCalendar() {
  const day = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), state.calendarDate.getDate());
  const iso = toISODate(day);
  const dayAppointments = appointmentsForDate(iso);
  const planner = dayPlannerBounds(dayAppointments, iso);
  return `
    <section class="day-view calendar-desktop">
      <div class="week-day day-view-card ${iso === todayISO() ? "today" : ""}">
        <div class="day-head">
          <h3>${capitalize(formatter.format(day))}</h3>
          <button class="add-day" type="button" title="Aggiungi appuntamento" data-day-add="${iso}">+</button>
        </div>
        ${renderDayPlanner(iso, dayAppointments, planner)}
      </div>
    </section>
    ${renderMobileCalendarList()}
  `;
}

function renderDayPlanner(iso, appointments, planner) {
  const hours = Array.from({ length: Math.ceil((planner.end - planner.start) / 60) + 1 }, (_, index) => planner.start + index * 60);
  const hourSlots = hours.slice(0, -1);
  const current = iso === todayISO() ? currentMinutesOfDay() : null;
  const currentBar =
    current !== null && current >= planner.start && current <= planner.end
      ? `<div class="current-time-bar" style="top: ${escapeAttr(percentWithin(current, planner))}%"><span>${escapeHtml(formatPlannerTime(current))}</span></div>`
      : "";
  return `
    <div class="day-planner" style="--planner-hours: ${escapeAttr((planner.end - planner.start) / 60)}">
      <div class="day-planner-scale" aria-hidden="true">
        ${hours.map((minutes) => `<span style="top: ${escapeAttr(percentWithin(minutes, planner))}%">${escapeHtml(formatPlannerTime(minutes))}</span>`).join("")}
      </div>
      <div class="day-planner-body">
        ${hourSlots
          .map(
            (minutes) => `
              <div class="day-planner-hour" style="top: ${escapeAttr(percentWithin(minutes, planner))}%"></div>
            `
          )
          .join("")}
        ${currentBar}
        ${appointments.length ? appointments.map((appointment) => renderDayPlannerAppointment(appointment, planner)).join("") : `<div class="day-planner-empty">Nessun appuntamento</div>`}
      </div>
    </div>
  `;
}

function renderDayPlannerAppointment(appointment, planner) {
  const start = clampNumber(timeToMinutes(appointment.startTime) ?? planner.start, planner.start, Math.max(planner.start, planner.end - 15));
  const rawEnd = timeToMinutes(appointment.endTime);
  const end = clampNumber(rawEnd ?? start + 60, start + 30, planner.end);
  const top = percentWithin(start, planner);
  const height = Math.max(6, ((end - start) / (planner.end - planner.start)) * 100);
  const dogName = appointment.dogName || "Senza nome";
  const timeRange = `${formatPlannerTime(start)}${rawEnd ? ` - ${formatPlannerTime(end)}` : ""}`;
  const services = appointment.services?.length ? appointment.services.join(", ") : appointment.service || statusLabel(appointment.status);
  const expectedTime = appointmentPlannerDurationLabel(appointment, start, end, rawEnd !== null);
  const details = [services, `Tempo ${expectedTime}`].filter(Boolean).join(" · ");
  return `
    <button class="day-planner-appointment status-${escapeAttr(appointment.status)}" type="button" data-appointment-id="${escapeAttr(appointment.id)}" title="${escapeAttr(`${timeRange} ${dogName} ${details}`)}" style="top: ${escapeAttr(top)}%; height: ${escapeAttr(height)}%;">
      <span class="planner-time">${escapeHtml(timeRange)}</span>
      <span class="planner-copy">
        <strong>${escapeHtml(dogName)}</strong>
        <small>${escapeHtml(details)}</small>
      </span>
    </button>
  `;
}

function appointmentPlannerDurationLabel(appointment, start, end, hasEndTime) {
  const dog = appointment.dogId ? state.dogs.find((item) => item.id === appointment.dogId) : null;
  const estimatedMinutes = Number(dog?.estimatedMinutes || 0);
  const scheduledMinutes = hasEndTime ? Math.max(0, end - start) : 0;
  return durationLabel(scheduledMinutes || estimatedMinutes || 60);
}

function dayPlannerBounds(appointments, iso) {
  const defaultStart = 7 * 60;
  const defaultEnd = 20 * 60;
  const points = [];
  appointments.forEach((appointment) => {
    const start = timeToMinutes(appointment.startTime);
    const end = timeToMinutes(appointment.endTime);
    if (start !== null) points.push(start);
    if (end !== null) points.push(end);
  });
  if (iso === todayISO()) points.push(currentMinutesOfDay());
  const start = Math.max(0, Math.floor(Math.min(defaultStart, ...points) / 60) * 60);
  const end = Math.min(24 * 60, Math.ceil(Math.max(defaultEnd, ...points) / 60) * 60);
  return { start, end: Math.max(end, start + 8 * 60) };
}

function openDayPlannerDialog(iso) {
  const day = parseISODate(iso);
  const appointments = appointmentsForDate(iso);
  const planner = dayPlannerBounds(appointments, iso);
  openModal({
    title: capitalize(formatter.format(day)),
    hideActions: true,
    headerAction: `<button class="add-day day-dialog-add" type="button" data-day-add="${escapeAttr(iso)}" title="Aggiungi appuntamento" aria-label="Aggiungi appuntamento">+</button>`,
    content: `
      <section class="day-dialog">
        <div class="day-dialog-summary">
          <strong>${escapeHtml(appointments.length ? `${appointments.length} appuntamenti` : "Giornata libera")}</strong>
          <span>Usa il + per creare un appuntamento, poi scegli data e ora.</span>
        </div>
        ${renderDayPlanner(iso, appointments, planner)}
      </section>
    `,
    onOpen: (form) => bindCalendarDayActions(form)
  });
}

function renderMobileCalendarList() {
  let days = [new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), state.calendarDate.getDate())];
  if (state.calendarMode === "month") {
    days = Array.from(
      { length: new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 0).getDate() },
      (_, index) => new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), index + 1)
    );
  }
  if (state.calendarMode === "week") {
    days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(state.calendarDate), index));
  }
  return `
    <section class="mobile-agenda" aria-label="Agenda mobile">
      ${days.map(renderMobileAgendaDay).join("")}
    </section>
  `;
}

function renderMobileAgendaDay(day) {
  const iso = toISODate(day);
  const dayAppointments = appointmentsForDate(iso);
  const title = capitalize(formatter.format(day));
  const showDayAdd = state.calendarMode === "day";
  return `
    <article class="mobile-agenda-day ${iso === todayISO() ? "today" : ""}">
      <div class="mobile-day-head">
        <button class="mobile-day-open" type="button" data-open-day="${escapeAttr(iso)}" title="Apri giornata ${escapeAttr(title)}">
          <strong>${escapeHtml(title)}</strong>
          <span>${dayAppointments.length ? `${dayAppointments.length} appuntamenti` : "Libero"}</span>
        </button>
        ${showDayAdd ? `<button class="add-day mobile-day-add" type="button" title="Nuovo appuntamento" data-day-add="${escapeAttr(iso)}">+</button>` : ""}
      </div>
      <div class="mobile-appointment-list">
        ${dayAppointments.length ? dayAppointments.map(renderMobileAppointmentCard).join("") : `<span class="mobile-empty">Nessun appuntamento</span>`}
      </div>
    </article>
  `;
}

function renderMobileAppointmentCard(appointment) {
  const isCompleted = appointment.status === "completato";
  const timeRange = [appointment.startTime, appointment.endTime].filter(Boolean).join(" - ") || "--";
  const subtitle = [appointment.service, appointment.ownerName].filter(Boolean).join(" - ");
  return `
    <div class="mobile-appt-row status-${escapeAttr(appointment.status)}">
      <button class="mobile-appt-card" type="button" data-appointment-id="${appointment.id}">
        <span>${escapeHtml(timeRange)}</span>
        <strong>${escapeHtml(appointment.dogName || "Senza nome")}</strong>
        <small>${escapeHtml(subtitle || statusLabel(appointment.status))}</small>
      </button>
      ${
        isCompleted
          ? `<span class="appt-complete done" title="Prestazione completata" aria-label="Prestazione completata">&#10003;</span>`
          : `<button class="appt-complete" type="button" data-complete-appointment-id="${appointment.id}" title="Concludi prestazione" aria-label="Concludi prestazione">&#10003;</button>`
      }
    </div>
  `;
}

function renderAppointmentPill(appointment) {
  const isCompleted = appointment.status === "completato";
  return `
    <div class="appt-row status-${escapeHtml(appointment.status)}">
      <button class="appt-pill" type="button" data-appointment-id="${appointment.id}">
        <span>${escapeHtml(appointment.startTime || "--")}</span>
        <small>${escapeHtml(appointment.dogName || "Senza nome")}</small>
      </button>
      ${
        isCompleted
          ? `<span class="appt-complete done" title="Prestazione completata" aria-label="Prestazione completata">&#10003;</span>`
          : `<button class="appt-complete" type="button" data-complete-appointment-id="${appointment.id}" title="Concludi prestazione" aria-label="Concludi prestazione">&#10003;</button>`
      }
    </div>
  `;
}

function bindCalendar() {
  document.getElementById("newAppointmentBtn").addEventListener("click", () => openAppointmentDialog({ date: todayISO() }));
  document.getElementById("prevPeriod").addEventListener("click", () => {
    state.calendarDate = moveCalendarDate(-1);
    renderView();
  });
  document.getElementById("nextPeriod").addEventListener("click", () => {
    state.calendarDate = moveCalendarDate(1);
    renderView();
  });
  document.getElementById("todayBtn").addEventListener("click", () => {
    state.calendarDate = new Date();
    renderView();
  });
  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.calendarMode = button.dataset.calendarMode;
      renderView();
    });
  });
  bindCalendarDayActions(document);
  document.querySelectorAll("[data-complete-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointment = state.appointments.find((item) => item.id === button.dataset.completeAppointmentId);
      if (!appointment) return;
      openAppointmentDialog(appointment, { completionMode: true });
    });
  });
}

function bindCalendarDayActions(root) {
  root.querySelectorAll("[data-open-day]").forEach((button) => {
    button.addEventListener("click", () => openDayPlannerDialog(button.dataset.openDay));
  });
  root.querySelectorAll("[data-day-add]").forEach((button) => {
    button.addEventListener("click", () => openAppointmentDialog({ date: button.dataset.dayAdd, startTime: button.dataset.dayAddTime || undefined }));
  });
  root.querySelectorAll("[data-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointment = state.appointments.find((item) => item.id === button.dataset.appointmentId);
      openAppointmentDialog(appointment);
    });
  });
}

function moveCalendarDate(direction) {
  if (state.calendarMode === "month") {
    return new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + direction, 1);
  }
  if (state.calendarMode === "week") return addDays(state.calendarDate, direction * 7);
  return addDays(state.calendarDate, direction);
}

function renderDashboard() {
  const today = todayISO();
  const completed = state.appointments.filter((item) => item.status === "completato");
  const planned = state.appointments.filter((item) => ["programmato", "confermato"].includes(item.status) && item.date >= today);
  const breedStats = countBy(completed, (appointment) => {
    const dog = state.dogs.find((item) => item.id === appointment.dogId);
    return dog?.breed || "Non indicata";
  });
  const serviceStats = countBy(completed.flatMap((appointment) => appointment.services?.length ? appointment.services : [appointment.service || "Servizio"]));
  const dogStats = countBy(completed, (appointment) => appointment.dogName || "Senza nome");
  const serviceRevenueStats = revenueByService(completed);
  const revenueSeries = revenueTrendSeries(completed, state.revenueRange);
  const topClient = topDashboardClient(completed);
  const topRevenue = topRevenueClient(completed);
  const avgMinutes = average(state.dogs.map((dog) => Number(dog.estimatedMinutes || 0)).filter(Boolean));
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Dashboard</h1>
        <p>Servizi, incassi, clienti e andamento economico.</p>
      </div>
    </div>
    <section class="metric-grid" aria-label="Riepilogo dashboard">
      <div class="metric"><span>Da fare</span><strong>${planned.length}</strong></div>
      <div class="metric"><span>Fatti</span><strong>${completed.length}</strong></div>
      <div class="metric top-client-metric"><span>Cliente piu presente</span>${renderTopClientMetric(topClient)}</div>
      <div class="metric top-client-metric"><span>Cane piu redditizio</span>${renderRevenueClientMetric(topRevenue)}</div>
      <div class="metric"><span>Tempo medio scheda</span><strong>${escapeHtml(durationLabel(avgMinutes))}</strong></div>
    </section>
    <section class="dashboard-grid revenue-dashboard-grid">
      <div class="panel">
        <h2>Tipi di servizi</h2>
        ${renderPieChart(serviceStats)}
      </div>
      <div class="panel">
        <h2>Incasso per servizio</h2>
        ${renderRevenueBars(serviceRevenueStats)}
      </div>
    </section>
    <section class="panel revenue-line-panel">
      <div class="panel-heading-row">
        <h2>Andamento incassi</h2>
        <div class="segmented compact" role="group" aria-label="Periodo incassi">
          ${["day", "week", "month", "year"]
            .map((range) => `<button type="button" data-revenue-range="${range}" class="${state.revenueRange === range ? "active" : ""}">${escapeHtml(revenueRangeLabel(range))}</button>`)
            .join("")}
        </div>
      </div>
      ${renderRevenueLineChart(revenueSeries)}
    </section>
    <section class="dashboard-grid secondary-dashboard-grid">
      <div class="panel">
        <h2>Razze piu trattate</h2>
        ${renderPieChart(breedStats)}
      </div>
      <div class="panel">
        <h2>Altre classifiche</h2>
        <div class="stat-lists">
          ${renderStatList("Animali", dogStats)}
          ${renderStatList("Razze", breedStats)}
        </div>
      </div>
    </section>
  `;
}

function bindDashboard() {
  document.querySelectorAll("[data-revenue-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.revenueRange = button.dataset.revenueRange;
      state.revenueSelectedPoint = null;
      renderView();
    });
  });
  document.querySelectorAll("[data-revenue-point]").forEach((point) => {
    point.addEventListener("click", () => {
      state.revenueSelectedPoint = { range: state.revenueRange, key: point.dataset.revenuePoint };
      renderView();
    });
    point.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      state.revenueSelectedPoint = { range: state.revenueRange, key: point.dataset.revenuePoint };
      renderView();
    });
  });
}

function renderDogs() {
  const filteredDogs = filteredDogList();
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Schede animali</h1>
        <p>${state.dogs.length} schede salvate</p>
      </div>
      <button class="btn" type="button" id="newDogBtn" data-new-dog>Nuova scheda</button>
    </div>
    <div class="searchbar">
      <input id="dogSearch" type="search" value="${escapeAttr(state.dogSearch)}" placeholder="Cerca per cane, proprietario, telefono o note" />
      <button class="btn secondary" type="button" id="clearDogSearch">Pulisci</button>
    </div>
    <div class="toolbar">
      <div class="muted">${filteredDogs.length} risultati</div>
    </div>
    ${
      filteredDogs.length
        ? `<section class="dog-mini-grid">${filteredDogs.map(renderDogCard).join("")}</section>`
        : `<section class="empty-state"><div><h2>Nessuna scheda trovata</h2><p>Crea una scheda o cambia la ricerca.</p></div></section>`
    }
  `;
}

function renderDogCard(dog) {
  const topDog = isTopDog(dog);
  const photo = dog.photoUrl
    ? `<img src="${escapeAttr(dog.photoUrl)}" alt="Foto di ${escapeAttr(dog.dogName)}" />`
    : `<span>${escapeHtml(initials(dog.dogName))}</span>`;
  return `
    <button class="dog-tile ${topDog ? "top-client" : ""}" type="button" data-dog-open="${dog.id}" aria-label="Apri scheda di ${escapeAttr(dog.dogName || "cane")}">
      <div class="dog-thumb">${photo}${topDog ? `<img class="top-paw" src="/icons/top-client-paw.png" alt="Cliente top" />` : ""}</div>
      <div class="dog-tile-main">
        <h3>${escapeHtml(dog.dogName || "Senza nome")}</h3>
      </div>
    </button>
  `;
}

function bindDogs() {
  const searchInput = document.getElementById("dogSearch");
  searchInput.addEventListener("input", () => {
    state.dogSearch = searchInput.value;
    renderView();
    document.getElementById("dogSearch")?.focus();
  });
  document.getElementById("clearDogSearch").addEventListener("click", () => {
    state.dogSearch = "";
    renderView();
  });
  document.querySelectorAll("[data-dog-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const dog = state.dogs.find((item) => item.id === button.dataset.dogOpen);
      if (dog) openDogDetailsDialog(dog);
    });
  });
}

function renderServiceHistory() {
  const selectedDog = selectedServiceHistoryDog();
  if (!state.dogs.length) {
    return `
      <div class="topbar">
        <div class="page-title">
          <h1>Storico servizi</h1>
          <p>Consulta servizi conclusi e foto prima/dopo.</p>
        </div>
      </div>
      <section class="empty-state"><div><h2>Nessuna scheda animale</h2><p>Crea una scheda per iniziare a registrare lo storico servizi.</p></div></section>
    `;
  }
  const history = selectedDog ? dogAppointmentHistory(selectedDog).filter((appointment) => appointment.status === "completato") : [];
  const photoCount = history.reduce((sum, appointment) => sum + appointmentPhotoCount(appointment), 0);
  const totalRevenue = history.reduce((sum, appointment) => sum + appointmentRevenue(appointment), 0);
  const photo = selectedDog?.photoUrl
    ? `<img src="${escapeAttr(selectedDog.photoUrl)}" alt="Foto di ${escapeAttr(selectedDog.dogName)}" />`
    : `<span>${escapeHtml(initials(selectedDog?.dogName))}</span>`;
  const searchValue = state.serviceHistoryDogQuery || serviceHistoryDogLabel(selectedDog);
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Storico servizi</h1>
        <p>Seleziona un animale e rivedi tutti i servizi conclusi con foto zoomabili.</p>
      </div>
    </div>
    <section class="panel service-history-filter">
      <label>Animale
        <input id="serviceHistoryDogSearch" type="search" list="serviceHistoryDogOptions" value="${escapeAttr(searchValue)}" placeholder="Cerca animale" autocomplete="off" />
        <datalist id="serviceHistoryDogOptions">
          ${state.dogs
            .map((dog) => `<option value="${escapeAttr(serviceHistoryDogLabel(dog))}"></option>`)
            .join("")}
        </datalist>
      </label>
      <button class="btn secondary" type="button" data-service-history-open-dog="${escapeAttr(selectedDog?.id || "")}">Apri scheda</button>
    </section>
    <section class="service-history-layout">
      <aside class="panel service-history-profile">
        <div class="service-history-photo ${selectedDog && isTopDog(selectedDog) ? "top-client" : ""}">
          ${photo}${selectedDog && isTopDog(selectedDog) ? `<img class="top-paw" src="/icons/top-client-paw.png" alt="Cliente top" />` : ""}
        </div>
        <div>
          <h2>${escapeHtml(selectedDog?.dogName || "Animale")}</h2>
          <p>${escapeHtml([selectedDog?.breed, selectedDog?.ownerName].filter(Boolean).join(" - ") || "Scheda animale")}</p>
        </div>
        <div class="service-history-metrics">
          <div><span>Servizi conclusi</span><strong>${history.length}</strong></div>
          <div><span>Incasso totale</span><strong>${escapeHtml(moneyLabel(totalRevenue))}</strong></div>
          <div><span>Foto lavoro</span><strong>${photoCount}</strong></div>
        </div>
      </aside>
      <div class="service-history-results">
        ${
          history.length
            ? history.map(renderServiceHistoryCard).join("")
            : `<section class="empty-history">Nessun servizio concluso per questo animale.</section>`
        }
      </div>
    </section>
  `;
}

function renderServiceHistoryCard(appointment) {
  const serviceRows = appointmentServiceRows(appointment);
  return `
    <article class="service-history-card status-${escapeHtml(appointment.status)}">
      <div class="service-history-card-head">
        <div>
          <strong>${escapeHtml(formatShortDate(appointment.date))}</strong>
          <span>${escapeHtml([appointment.startTime, appointment.endTime].filter(Boolean).join(" - ") || "--:--")}</span>
        </div>
        <div class="history-amount">${escapeHtml(moneyLabel(appointment.paidAmount))}</div>
      </div>
      <div class="service-lines">
        ${serviceRows
          .map(
            (item) => `
              <div>
                <span>${escapeHtml(item.service)}</span>
                <strong>${escapeHtml(moneyLabel(item.amount))}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      ${appointment.notes ? `<p class="service-history-note">${escapeHtml(appointment.notes)}</p>` : ""}
      ${renderAppointmentGallery(appointment)}
      <div class="service-history-actions">
        <button class="btn secondary slim" type="button" data-service-history-edit="${appointment.id}">Modifica servizio</button>
      </div>
    </article>
  `;
}

function bindServiceHistory() {
  const searchInput = document.getElementById("serviceHistoryDogSearch");
  const applySearch = () => {
    const dog = serviceHistoryDogFromSearch(searchInput.value);
    if (!dog) {
      notify("Seleziona un animale dall'elenco");
      return;
    }
    state.serviceHistoryDogId = dog.id;
    state.serviceHistoryDogQuery = serviceHistoryDogLabel(dog);
    renderView();
  };
  searchInput?.addEventListener("input", () => {
    state.serviceHistoryDogQuery = searchInput.value;
    const dog = serviceHistoryDogFromSearch(searchInput.value, true);
    if (dog && dog.id !== state.serviceHistoryDogId) {
      state.serviceHistoryDogId = dog.id;
      state.serviceHistoryDogQuery = serviceHistoryDogLabel(dog);
      renderView();
    }
  });
  searchInput?.addEventListener("change", applySearch);
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applySearch();
  });
  document.querySelector("[data-service-history-open-dog]")?.addEventListener("click", (event) => {
    const dog = state.dogs.find((item) => item.id === event.currentTarget.dataset.serviceHistoryOpenDog);
    if (dog) openDogDetailsDialog(dog);
  });
  document.querySelectorAll("[data-service-history-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointment = state.appointments.find((item) => item.id === button.dataset.serviceHistoryEdit);
      if (appointment) openAppointmentDialog(appointment);
    });
  });
}

function renderUsers() {
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Utenti</h1>
        <p>Gestione accessi amministratore e operatori.</p>
      </div>
      <button class="btn" type="button" id="newUserBtn">Nuovo utente</button>
    </div>
    <section class="table-card">
      ${state.users
        .map(
          (user) => `
            <div class="table-row">
              <div class="user-row-main">
                ${renderUserAvatar(user, "user-row-avatar")}
                <div>
                  <strong>${escapeHtml(user.displayName || user.username)}</strong><br />
                  <span class="muted">${escapeHtml(user.username)}</span>
                </div>
              </div>
              <span class="role-pill ${user.role === "admin" ? "admin" : ""}">${user.role === "admin" ? "Admin" : "User"}</span>
              <span class="state-pill ${user.active ? "active" : "off"}">${user.active ? "Attivo" : "Disattivo"}</span>
              <span class="online-pill ${user.online ? "online" : "offline"}">
                <span class="online-dot" aria-hidden="true"></span>
                ${user.online ? "Online" : "Offline"}
              </span>
              <div class="row-actions">
                <button class="btn secondary slim" type="button" data-user-edit="${user.id}">Modifica</button>
                <button class="btn secondary slim" type="button" data-user-delete="${user.id}">Elimina</button>
              </div>
            </div>
          `
        )
        .join("")}
    </section>
  `;
}

function bindUsers() {
  document.getElementById("newUserBtn").addEventListener("click", () => openUserDialog());
  document.querySelectorAll("[data-user-edit]").forEach((button) => {
    button.addEventListener("click", () => openUserDialog(state.users.find((item) => item.id === button.dataset.userEdit)));
  });
  document.querySelectorAll("[data-user-delete]").forEach((button) => {
    const user = state.users.find((item) => item.id === button.dataset.userDelete);
    button.addEventListener("click", () => confirmAction(`Eliminare l'utente ${user.username}?`, async () => {
      await api(`/api/users/${user.id}`, { method: "DELETE", body: "{}" });
      await loadData();
      renderView();
      notify("Utente eliminato");
    }));
  });
}

function renderSettings() {
  const branding = getBranding();
  const loginBackground = branding.loginBackground;
  const whatsapp = state.whatsapp || {};
  const duckdns = state.duckdns || {};
  const animal = getAnimalSettings();
  const version = state.version || {};
  const updateCheck = state.updateCheck;
  const localUrls = duckdns.localUrls || [];
  const navigationOrder = sidebarOrder();
  const localLinks = localUrls.length
    ? localUrls.map((item) => `<a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}: ${escapeHtml(item.url)}</a>`).join("")
    : `<span class="muted">Indirizzi locali non disponibili</span>`;
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Impostazioni</h1>
        <p>Identita aziendale, colori, WhatsApp, DuckDNS e backup.</p>
      </div>
    </div>
    <section class="settings-grid">
      <form class="settings-panel wide" id="brandingForm">
        <div class="settings-heading-row">
          <div>
            <h2>Identita azienda</h2>
            <p class="settings-note">Nome, logo e informazioni aziendali sono comuni; tema, colori e sfondo restano personali per questo utente.</p>
          </div>
          ${renderBrandMark("settings-logo-preview")}
        </div>
        <div class="form-grid">
          <label>Nome portale
            <input name="portalName" value="${escapeAttr(branding.portalName)}" />
          </label>
          <label>Nome azienda
            <input name="businessName" value="${escapeAttr(branding.businessName)}" />
          </label>
          <label class="full">Sottotitolo
            <input name="tagline" value="${escapeAttr(branding.tagline)}" />
          </label>
          <label>Telefono azienda
            <input name="phone" value="${escapeAttr(branding.phone)}" inputmode="tel" />
          </label>
          <label>Email azienda
            <input name="email" value="${escapeAttr(branding.email)}" inputmode="email" />
          </label>
          <label class="full">Indirizzo
            <input name="address" value="${escapeAttr(branding.address)}" />
          </label>
          <label class="full">Informazioni azienda
            <textarea name="companyInfo">${escapeHtml(branding.companyInfo)}</textarea>
          </label>
          <label>Tema portale
            <select name="theme" data-theme-select>
              <option value="light" ${branding.theme === "light" ? "selected" : ""}>Chiaro</option>
              <option value="dark" ${branding.theme === "dark" ? "selected" : ""}>Scuro</option>
              <option value="custom" ${branding.theme === "custom" ? "selected" : ""}>Personalizzato</option>
            </select>
          </label>
          <label class="scale-field">Dimensione desktop/tablet
            <input name="uiScale" type="range" min="85" max="105" step="5" value="${escapeAttr(normalizeUiScale(branding.uiScale))}" data-ui-scale-range />
            <small class="field-hint"><strong data-ui-scale-value>${escapeHtml(`${normalizeUiScale(branding.uiScale)}%`)}</strong></small>
          </label>
          <label>Logo
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          <label class="checkbox-line">
            <input name="clearLogo" type="checkbox" />
            Rimuovi logo
          </label>
        </div>
        <div class="login-bg-settings">
          <h3>Sfondo login</h3>
          <div class="form-grid">
            <label>Tipo sfondo
              <select name="loginBackgroundMode" data-login-bg-mode>
                <option value="pattern" ${loginBackground.mode === "pattern" ? "selected" : ""}>Pattern</option>
                <option value="solid" ${loginBackground.mode === "solid" ? "selected" : ""}>Colore singolo</option>
                <option value="gradient" ${loginBackground.mode === "gradient" ? "selected" : ""}>Sfumatura sopra/sotto</option>
                <option value="image" ${loginBackground.mode === "image" ? "selected" : ""}>Immagine di sfondo</option>
              </select>
            </label>
            <label data-login-bg-panel="solid">Colore singolo
              <input name="loginSolidColor" type="color" value="${escapeAttr(loginBackground.solidColor)}" />
            </label>
            <label data-login-bg-panel="pattern">Colore pattern
              <input name="loginPatternColor" type="color" value="${escapeAttr(loginBackground.patternColor)}" />
            </label>
            <label data-login-bg-panel="pattern">Dettaglio pattern
              <input name="loginPatternAccentColor" type="color" value="${escapeAttr(loginBackground.patternAccentColor)}" />
            </label>
            <label data-login-bg-panel="gradient">Colore sopra
              <input name="loginGradientTop" type="color" value="${escapeAttr(loginBackground.gradientTop)}" />
            </label>
            <label data-login-bg-panel="gradient">Colore sotto
              <input name="loginGradientBottom" type="color" value="${escapeAttr(loginBackground.gradientBottom)}" />
            </label>
            <label data-login-bg-panel="image">Immagine sfondo
              <input name="loginBackgroundImage" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            <label class="checkbox-line" data-login-bg-panel="image">
              <input name="clearLoginBackgroundImage" type="checkbox" />
              Rimuovi immagine sfondo
            </label>
          </div>
        </div>
        <div class="color-grid">
          <p class="settings-note full" data-dark-color-note>Nel tema scuro puoi cambiare i colori verdi/evidenza senza toccare sfondo, pannelli e testo.</p>
          <label data-color-scope="accent">Colore principale
            <input name="brand" type="color" value="${escapeAttr(branding.colors.brand)}" />
          </label>
          <label data-color-scope="accent">Colore scuro
            <input name="brandStrong" type="color" value="${escapeAttr(branding.colors.brandStrong)}" />
          </label>
          <label data-color-scope="accent">Accento
            <input name="accent" type="color" value="${escapeAttr(branding.colors.accent)}" />
          </label>
          <label data-color-scope="surface">Sfondo
            <input name="background" type="color" value="${escapeAttr(branding.colors.background)}" />
          </label>
          <label data-color-scope="surface">Pannelli
            <input name="panel" type="color" value="${escapeAttr(branding.colors.panel)}" />
          </label>
          <label data-color-scope="surface">Testo
            <input name="text" type="color" value="${escapeAttr(branding.colors.text)}" />
          </label>
        </div>
        <div class="settings-actions">
          <button class="btn" type="submit">Salva identita</button>
        </div>
      </form>
      <form class="settings-panel wide" id="animalSettingsForm">
        <div class="settings-heading-row">
          <div>
            <h2>Scheda animale</h2>
            <p class="settings-note">Gestisci la lista master: qui finiscono anche razze e prestazioni aggiunte da schede e appuntamenti.</p>
          </div>
          <span class="badge">${escapeHtml(animal.loyaltyTopVisitsPerYear)} prestazioni/anno</span>
        </div>
        <div class="form-grid">
          <label class="full">Razze disponibili
            <textarea name="breeds" placeholder="Una razza per riga">${escapeHtml((animal.breeds || []).join("\n"))}</textarea>
          </label>
          <label class="full">Prestazioni disponibili
            <textarea name="services" placeholder="Una prestazione per riga">${escapeHtml((animal.services || []).join("\n"))}</textarea>
          </label>
          <label class="full">Colori cane
            <textarea name="colors" placeholder="Un colore per riga">${escapeHtml((animal.colors || []).join("\n"))}</textarea>
          </label>
          <label>Prestazioni annue per cliente top
            <input name="loyaltyTopVisitsPerYear" type="number" min="1" step="1" value="${escapeAttr(animal.loyaltyTopVisitsPerYear || 8)}" />
          </label>
        </div>
        <div class="settings-actions">
          <button class="btn" type="submit">Salva scheda animale</button>
        </div>
      </form>
      <form class="settings-panel wide" id="navigationSettingsForm">
        <div class="settings-heading-row">
          <div>
            <h2>Menu laterale</h2>
            <p class="settings-note">Riordina le voci principali della sidebar. Impostazioni resta fissa sotto al profilo.</p>
          </div>
          <span class="badge">Sidebar</span>
        </div>
        <div class="order-list" data-sidebar-order-list>
          ${renderSidebarOrderRows(navigationOrder)}
        </div>
        <div class="settings-actions">
          <button class="btn" type="submit">Salva menu</button>
        </div>
      </form>
      <form class="settings-panel wide" id="whatsappForm">
        <div class="settings-heading-row">
          <div>
            <h2>WhatsApp promemoria</h2>
            <p class="settings-note">Prepara il messaggio da inviare al numero cliente per ricordare l'appuntamento.</p>
          </div>
          <span class="badge">${whatsapp.enabled ? "Attivo" : "Disattivo"}</span>
        </div>
        <div class="form-grid">
          <label class="checkbox-line full">
            <input name="enabled" type="checkbox" ${whatsapp.enabled ? "checked" : ""} />
            Abilita promemoria WhatsApp
          </label>
          <label>Modalita invio
            <select name="mode">
              <option value="manual" ${whatsapp.mode !== "cloud-api" ? "selected" : ""}>Manuale con link WhatsApp</option>
              <option value="cloud-api" ${whatsapp.mode === "cloud-api" ? "selected" : ""}>WhatsApp Cloud API futura</option>
            </select>
          </label>
          <label>Prefisso predefinito
            <input name="countryPrefix" value="${escapeAttr(whatsapp.countryPrefix || "+39")}" />
          </label>
          <label>Ore prima dell'appuntamento
            <input name="reminderHoursBefore" type="number" min="0" step="1" value="${escapeAttr(whatsapp.reminderHoursBefore ?? 24)}" />
          </label>
          <label>Phone Number ID Cloud API
            <input name="cloudPhoneNumberId" value="${escapeAttr(whatsapp.cloudPhoneNumberId || "")}" autocomplete="off" />
          </label>
          <label>Token Cloud API
            <input name="cloudAccessToken" type="password" autocomplete="new-password" placeholder="${whatsapp.hasCloudAccessToken ? "Lascia vuoto per non cambiarlo" : "Token futuro WhatsApp"}" />
          </label>
          <label class="checkbox-line">
            <input name="clearCloudAccessToken" type="checkbox" />
            Rimuovi token salvato
          </label>
          <label class="full">Testo promemoria
            <textarea name="template">${escapeHtml(whatsapp.template || "")}</textarea>
          </label>
        </div>
        <p class="settings-note">Variabili disponibili: {ownerName}, {dogName}, {businessName}, {date}, {time}, {service}, {address}, {phone}.</p>
        <div class="settings-actions">
          <button class="btn" type="submit">Salva WhatsApp</button>
        </div>
      </form>
      <form class="settings-panel wide" id="duckDnsForm">
        <div class="settings-heading-row">
          <div>
            <h2>DuckDNS e accesso web</h2>
            <p class="settings-note">Il portale resta raggiungibile localmente dagli indirizzi LAN e via web dal dominio DuckDNS configurato.</p>
          </div>
          <span class="badge">Token ${duckdns.hasToken ? "salvato" : "mancante"}</span>
        </div>
        <div class="access-grid">
          <div class="access-box">
            <h3>Accesso locale</h3>
            <div class="link-list">${localLinks}</div>
          </div>
          <div class="access-box">
            <h3>Accesso web</h3>
            ${
              duckdns.publicUrl
                ? `<a class="public-url" href="${escapeAttr(duckdns.publicUrl)}" target="_blank" rel="noreferrer">${escapeHtml(duckdns.publicUrl)}</a>`
                : `<span class="muted">Configura un dominio DuckDNS per vedere l'URL pubblico.</span>`
            }
            <p class="settings-note">Per iPad/PWA conviene usare HTTPS; localmente puoi continuare a usare gli indirizzi http della rete.</p>
          </div>
        </div>
        <div class="form-grid">
          <label>Dominio DuckDNS
            <input name="domain" value="${escapeAttr(duckdns.domain || "")}" placeholder="nome.duckdns.org" autocomplete="off" />
          </label>
          <label>Protocollo pubblico
            <select name="publicProtocol">
              <option value="https" ${duckdns.publicProtocol !== "http" ? "selected" : ""}>HTTPS</option>
              <option value="http" ${duckdns.publicProtocol === "http" ? "selected" : ""}>HTTP</option>
            </select>
          </label>
          <label>Porta pubblica
            <input name="publicPort" value="${escapeAttr(duckdns.publicPort || "")}" inputmode="numeric" placeholder="443, 80 o porta esposta" />
          </label>
          <label>Token DuckDNS
            <input name="token" type="password" autocomplete="new-password" placeholder="${duckdns.hasToken ? "Lascia vuoto per non cambiarlo" : "Incolla il token DuckDNS"}" />
          </label>
          <label class="checkbox-line full">
            <input name="clearToken" type="checkbox" />
            Rimuovi token salvato
          </label>
        </div>
        <div class="settings-actions">
          <button class="btn" type="submit">Salva DuckDNS</button>
          <button class="btn secondary" type="button" id="duckDnsUpdateBtn">Aggiorna DuckDNS</button>
        </div>
        ${
          duckdns.lastUpdateAt
            ? `<p class="settings-note">Ultimo aggiornamento: ${escapeHtml(formatDateTime(duckdns.lastUpdateAt))} - ${escapeHtml(duckdns.lastResult || "-")}</p>`
            : ""
        }
      </form>
      <form class="settings-panel" id="exportBackupForm">
        <h2>Esporta backup</h2>
        <p class="settings-note">Scarica configurazione, utenti, schede, appuntamenti e foto in un file protetto da password.</p>
        <label>Password backup
          <input name="password" type="password" minlength="8" autocomplete="new-password" required />
        </label>
        <button class="btn" type="submit">Scarica backup</button>
      </form>
      <form class="settings-panel" id="importBackupForm">
        <h2>Importa backup</h2>
        <p class="settings-note">Il ripristino sostituisce i dati correnti. Serve la stessa password usata in esportazione.</p>
        <label>File backup
          <input name="backupFile" type="file" accept="application/json,.json" required />
        </label>
        <label>Password backup
          <input name="password" type="password" minlength="8" autocomplete="new-password" required />
        </label>
        <label class="checkbox-line">
          <input name="confirmImport" type="checkbox" required />
          Confermo il ripristino completo
        </label>
        <button class="btn danger" type="submit">Importa e ripristina</button>
      </form>
      <form class="settings-panel wide" id="updateForm">
        <div class="settings-heading-row">
          <div>
            <h2>Aggiornamento portale</h2>
            <p class="settings-note">Controllo automatico update web e installazione da pacchetto locale.</p>
          </div>
          <span class="badge">Beta</span>
        </div>
        <div class="update-layout">
          <div class="update-block">
            <span class="update-label">Versione installata</span>
            <strong>${escapeHtml(version.releaseLabel || version.version || "non disponibile")}</strong>
            <small>Pacchetti accettati: ${escapeHtml(version.updateExtension || ".pgs-update")}</small>
          </div>
          <div class="update-block update-block-main" id="updateStatus">
            ${renderUpdateStatus(updateCheck)}
          </div>
          <div class="update-block">
            <span class="update-label">Update da file locale</span>
            <label>File update
              <input name="updateFile" type="file" accept=".pgs-update" />
            </label>
            <button class="btn" type="submit">Installa file locale</button>
          </div>
        </div>
        <p class="settings-note">L'update aggiorna solo il software. Database, foto e backup non vengono toccati.</p>
        <div class="settings-actions">
          <button class="btn secondary" type="button" id="checkUpdateBtn">Controlla update web</button>
          ${
            updateCheck?.updateAvailable && updateCheck.packageUrl
              ? `<button class="btn" type="button" id="installWebUpdateBtn">Installa update disponibile</button>`
              : ""
          }
          <button class="btn secondary" type="button" id="restartPortalBtn">Riavvia servizio</button>
        </div>
      </form>
    </section>
  `;
}

function renderUpdateStatus(updateCheck) {
  if (state.updateCheckLoading) {
    return `
      <span class="update-label">Update web</span>
      <strong>Controllo in corso...</strong>
      <small>Sto verificando la release pubblicata su GitHub.</small>
    `;
  }
  if (!updateCheck) {
    return `
      <span class="update-label">Update web</span>
      <strong>Controllo automatico</strong>
      <small>Il portale verifica la release web quando apri queste impostazioni.</small>
    `;
  }
  if (updateCheck.error) {
    return `
      <span class="update-label">Update web</span>
      <strong class="danger-note">Non verificabile</strong>
      <small>${escapeHtml(updateCheck.error)}</small>
    `;
  }
  if (updateCheck.updateAvailable) {
    return `
      <span class="update-label">Update web</span>
      <strong>Disponibile: ${escapeHtml(updateCheck.latestReleaseLabel || updateCheck.latestVersion)}</strong>
      <small>Installata: ${escapeHtml(updateCheck.currentReleaseLabel || updateCheck.currentVersion)}. Premi "Installa update disponibile", poi riavvia il servizio.</small>
      ${renderUpdateChangelog(updateCheck)}
    `;
  }
  return `
    <span class="update-label">Update web</span>
    <strong>Portale aggiornato</strong>
    <small>Versione online: ${escapeHtml(updateCheck.latestReleaseLabel || updateCheck.latestVersion || "-")}.</small>
    ${renderUpdateChangelog(updateCheck)}
  `;
}

function renderUpdateChangelog(updateCheck) {
  const notes = String(updateCheck?.changelog || updateCheck?.notes || "").trim();
  if (!notes) return "";
  return `
    <div class="update-changelog">
      <span>Changelog</span>
      <p>${escapeHtml(notes)}</p>
    </div>
  `;
}

function renderSidebarOrderRows(order = sidebarOrder()) {
  return order
    .map((id) => SIDEBAR_DEFINITIONS[id])
    .filter(Boolean)
    .map(
      (item) => `
        <div class="order-row" data-sidebar-order-row>
          <input type="hidden" name="sidebarOrder" value="${escapeAttr(item.id)}" />
          ${renderNavSymbol(item.icon)}
          <strong>${escapeHtml(item.label)}</strong>
          <div class="order-actions">
            <button class="icon-btn" type="button" data-order-move="-1" title="Sposta su" aria-label="Sposta ${escapeAttr(item.label)} su">&#8593;</button>
            <button class="icon-btn" type="button" data-order-move="1" title="Sposta giu" aria-label="Sposta ${escapeAttr(item.label)} giu">&#8595;</button>
          </div>
        </div>
      `
    )
    .join("");
}

function syncSidebarOrderButtons(list) {
  const rows = Array.from(list.querySelectorAll("[data-sidebar-order-row]"));
  rows.forEach((row, index) => {
    const up = row.querySelector('[data-order-move="-1"]');
    const down = row.querySelector('[data-order-move="1"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === rows.length - 1;
  });
}

function bindSettings() {
  bindThemePreset(document.getElementById("brandingForm"));
  bindLoginBackgroundMode(document.getElementById("brandingForm"));
  bindUiScaleRange(document.getElementById("brandingForm"));

  document.getElementById("brandingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const logo = form.elements.logo.files[0];
    const loginBackgroundImage = form.elements.loginBackgroundImage.files[0];
    const payload = {
      portalName: data.get("portalName"),
      businessName: data.get("businessName"),
      tagline: data.get("tagline"),
      companyInfo: data.get("companyInfo"),
      phone: data.get("phone"),
      email: data.get("email"),
      address: data.get("address"),
      theme: data.get("theme"),
      uiScale: normalizeUiScale(data.get("uiScale")),
      clearLogo: data.get("clearLogo") === "on",
      clearLoginBackgroundImage: data.get("clearLoginBackgroundImage") === "on",
      loginBackground: {
        mode: data.get("loginBackgroundMode"),
        solidColor: data.get("loginSolidColor"),
        patternColor: data.get("loginPatternColor"),
        patternAccentColor: data.get("loginPatternAccentColor"),
        gradientTop: data.get("loginGradientTop"),
        gradientBottom: data.get("loginGradientBottom")
      },
      colors: {
        brand: data.get("brand"),
        brandStrong: data.get("brandStrong"),
        accent: data.get("accent"),
        background: data.get("background"),
        panel: data.get("panel"),
        text: data.get("text")
      }
    };
    if (logo) payload.logoData = await fileToDataUrl(logo);
    if (loginBackgroundImage) payload.loginBackgroundImageData = await fileToDataUrl(loginBackgroundImage);
    try {
      const response = await api("/api/settings/branding", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      state.branding = response.branding;
      applyBranding();
      renderShell();
      notify("Identita e preferenze salvate");
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("animalSettingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const response = await api("/api/settings/animal", {
        method: "PUT",
        body: JSON.stringify({
          breeds: parseTextareaList(data.get("breeds")),
          services: parseTextareaList(data.get("services")),
          colors: parseTextareaList(data.get("colors")),
          loyaltyTopVisitsPerYear: data.get("loyaltyTopVisitsPerYear")
        })
      });
      state.animalSettings = response.animal;
      renderView();
      notify("Impostazioni scheda animale salvate");
    } catch (err) {
      notify(err.message);
    }
  });

  const navigationForm = document.getElementById("navigationSettingsForm");
  const orderList = navigationForm.querySelector("[data-sidebar-order-list]");
  orderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-move]");
    if (!button) return;
    const row = button.closest("[data-sidebar-order-row]");
    const direction = Number(button.dataset.orderMove);
    if (direction < 0 && row.previousElementSibling) {
      orderList.insertBefore(row, row.previousElementSibling);
    }
    if (direction > 0 && row.nextElementSibling) {
      orderList.insertBefore(row.nextElementSibling, row);
    }
    syncSidebarOrderButtons(orderList);
  });
  syncSidebarOrderButtons(orderList);
  navigationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const response = await api("/api/settings/navigation", {
        method: "PUT",
        body: JSON.stringify({
          sidebarOrder: data.getAll("sidebarOrder")
        })
      });
      state.navigation = response.navigation;
      renderShell();
      notify("Menu laterale salvato");
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("whatsappForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const response = await api("/api/settings/whatsapp", {
        method: "PUT",
        body: JSON.stringify({
          enabled: data.get("enabled") === "on",
          mode: data.get("mode"),
          countryPrefix: data.get("countryPrefix"),
          reminderHoursBefore: data.get("reminderHoursBefore"),
          cloudPhoneNumberId: data.get("cloudPhoneNumberId"),
          cloudAccessToken: data.get("cloudAccessToken"),
          clearCloudAccessToken: data.get("clearCloudAccessToken") === "on",
          template: data.get("template")
        })
      });
      state.whatsapp = response.whatsapp;
      renderView();
      notify("Impostazioni WhatsApp salvate");
    } catch (err) {
      notify(err.message);
    }
  });

  const duckDnsForm = document.getElementById("duckDnsForm");
  duckDnsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await api("/api/settings/duckdns", {
        method: "PUT",
        body: JSON.stringify({
          domain: data.get("domain"),
          publicProtocol: data.get("publicProtocol"),
          publicPort: data.get("publicPort"),
          token: data.get("token"),
          clearToken: data.get("clearToken") === "on"
        })
      });
      state.duckdns = response.duckdns;
      renderView();
      notify("Configurazione DuckDNS salvata");
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("duckDnsUpdateBtn").addEventListener("click", async () => {
    try {
      const response = await api("/api/duckdns/update", {
        method: "POST",
        body: "{}"
      });
      state.duckdns = response.duckdns;
      renderView();
      notify("DuckDNS aggiornato");
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("exportBackupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    try {
      const response = await api("/api/backup/export", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      const blob = new Blob([JSON.stringify(response.backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = response.fileName || "toelettatura-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 500);
      form.reset();
      notify("Backup scaricato");
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("importBackupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = form.elements.backupFile.files[0];
    try {
      const backup = JSON.parse(await file.text());
      await api("/api/backup/import", {
        method: "POST",
        body: JSON.stringify({
          password: data.get("password"),
          backup
        })
      });
      notify("Backup importato. Accesso richiesto.");
      await logout();
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("updateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.updateFile.files[0];
    try {
      if (!file) throw new Error("Seleziona un file update locale");
      if (!file.name.toLowerCase().endsWith(".pgs-update")) throw new Error("Seleziona un file .pgs-update");
      const payload = {
        fileName: file.name,
        package: JSON.parse(await file.text())
      };
      const response = await api("/api/system/update", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      notify(`Update ${response.update.installedVersion || ""} installato: riavvia il servizio`);
    } catch (err) {
      notify(err.message);
    }
  });

  document.getElementById("checkUpdateBtn")?.addEventListener("click", () => refreshUpdateCheck(true));
  document.getElementById("installWebUpdateBtn")?.addEventListener("click", async () => {
    if (!state.updateCheck?.packageUrl) return;
    try {
      const button = document.getElementById("installWebUpdateBtn");
      if (button) button.disabled = true;
      const response = await api("/api/system/update", {
        method: "POST",
        body: JSON.stringify({ url: state.updateCheck.packageUrl })
      });
      notify(`Update ${response.update.installedVersion || ""} installato: riavvia il servizio`);
    } catch (err) {
      notify(err.message);
    } finally {
      const button = document.getElementById("installWebUpdateBtn");
      if (button) button.disabled = false;
    }
  });
  document.getElementById("restartPortalBtn")?.addEventListener("click", () => {
    confirmAction("Riavviare il servizio del portale? Su Linux con systemd tornera online dopo pochi secondi.", async () => {
      await api("/api/system/restart", {
        method: "POST",
        body: "{}"
      });
      notify("Riavvio servizio in corso");
      setTimeout(() => window.location.reload(), 7000);
    });
  });

  if (!state.updateCheck && !state.updateCheckLoading) refreshUpdateCheck(false);
}

async function refreshUpdateCheck(showToast = false) {
  const statusBox = document.getElementById("updateStatus");
  const previousAvailable = Boolean(state.updateCheck?.updateAvailable);
  state.updateCheckLoading = true;
  if (statusBox) statusBox.innerHTML = renderUpdateStatus(state.updateCheck);
  try {
    const response = await api("/api/system/update-check");
    state.updateCheck = response.update;
    if (showToast) notify(response.update.updateAvailable ? "Nuovo update disponibile" : "Nessun update disponibile");
  } catch (err) {
    state.updateCheck = { error: err.message };
    if (showToast) notify(err.message);
  } finally {
    state.updateCheckLoading = false;
    const currentAvailable = Boolean(state.updateCheck?.updateAvailable);
    if (state.view === "settings") renderShell();
    else if (state.me?.role === "admin" && currentAvailable !== previousAvailable) renderShell();
  }
}

function checkUpdatesInBackground() {
  if (state.me?.role !== "admin" || state.updateCheck || state.updateCheckLoading) return;
  setTimeout(() => {
    if (state.me?.role === "admin" && !state.updateCheck && !state.updateCheckLoading) {
      refreshUpdateCheck(false);
    }
  }, 700);
}

function bindThemePreset(form) {
  const themeSelect = form.querySelector("[data-theme-select]");
  const colorNames = ["brand", "brandStrong", "accent", "background", "panel", "text"];
  const surfaceColorFields = form.querySelectorAll('[data-color-scope="surface"]');
  const darkColorNote = form.querySelector("[data-dark-color-note]");
  const applyPreset = () => {
    const preset = THEME_PRESETS[themeSelect.value];
    if (preset) {
      for (const name of colorNames) {
        if (form.elements[name]) form.elements[name].value = preset[name];
      }
    }
    syncDarkColorControls();
  };
  const syncDarkColorControls = () => {
    const isDark = themeSelect.value === "dark";
    surfaceColorFields.forEach((field) => {
      field.hidden = isDark;
    });
    if (darkColorNote) darkColorNote.hidden = !isDark;
  };
  themeSelect.addEventListener("change", applyPreset);
  syncDarkColorControls();
}

function bindLoginBackgroundMode(form) {
  const modeSelect = form.querySelector("[data-login-bg-mode]");
  const sync = () => {
    const mode = modeSelect.value || "pattern";
    form.querySelectorAll("[data-login-bg-panel]").forEach((field) => {
      field.hidden = field.dataset.loginBgPanel !== mode;
    });
  };
  modeSelect.addEventListener("change", sync);
  sync();
}

function bindUiScaleRange(form) {
  const range = form?.querySelector("[data-ui-scale-range]");
  const value = form?.querySelector("[data-ui-scale-value]");
  if (!range || !value) return;
  const sync = () => {
    const scale = normalizeUiScale(range.value);
    value.textContent = `${scale}%`;
    document.documentElement.style.setProperty("--ui-scale", String(scale / 100));
  };
  range.addEventListener("input", sync);
  sync();
}

function openDogDetailsDialog(dog = {}) {
  const history = dogAppointmentHistory(dog);
  const scheduledCount = history.filter(isScheduledAppointment).length;
  const topDog = isTopDog(dog);
  const photo = dog.photoUrl
    ? `<img src="${escapeAttr(dog.photoUrl)}" alt="Foto di ${escapeAttr(dog.dogName)}" />`
    : `<span>${escapeHtml(initials(dog.dogName))}</span>`;
  openModal({
    title: dog.dogName || "Scheda cane",
    hideActions: true,
    headerAction: `<button class="icon-btn" type="button" data-header-action aria-label="Modifica scheda" title="Modifica scheda">&#9998;</button>`,
    content: `
      <section class="dog-detail">
        <div class="dog-detail-photo ${topDog ? "top-client" : ""}">${photo}${topDog ? `<img class="top-paw detail" src="/icons/top-client-paw.png" alt="Cliente top" />` : ""}</div>
        <div class="dog-detail-body">
          <div class="dog-detail-heading">
            <strong>${escapeHtml(dog.dogName || "Scheda cane")}</strong>
            ${topDog ? `<span class="top-badge"><img src="/icons/top-client-paw.png" alt="" /> Cliente top</span>` : ""}
            ${scheduledCount ? `<span>${escapeHtml(scheduledAppointmentLabel(scheduledCount))}</span>` : ""}
          </div>
          <div class="detail-list">
            <div class="detail-item">
              <span>Proprietario</span>
              <strong>${escapeHtml(dog.ownerName || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Contatto</span>
              <strong>${escapeHtml(dog.contactMissing ? "Non presente" : dog.contact || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Contatto alternativo</span>
              <strong>${escapeHtml(dog.alternateContact || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Razza</span>
              <strong>${escapeHtml(dog.breed || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Eta animale</span>
              <strong>${escapeHtml(ageLabel(dog.birthYear))}</strong>
            </div>
            <div class="detail-item">
              <span>Colore</span>
              <strong>${escapeHtml(dog.color || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Sesso</span>
              <strong>${escapeHtml(dog.sex === "F" ? "Femmina" : dog.sex === "M" ? "Maschio" : "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Consenso immagini</span>
              <strong>${escapeHtml(dog.imageConsent === "yes" ? "Si" : dog.imageConsent === "no" ? "No" : "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Cliente top</span>
              <strong>${escapeHtml(topDog ? (dog.manualTopClient ? "Si, manuale" : "Si, automatico") : "No")}</strong>
            </div>
            <div class="detail-item">
              <span>Tempo stimato</span>
              <strong>${escapeHtml(durationLabel(dog.estimatedMinutes))}</strong>
            </div>
            <div class="detail-item">
              <span>Reminder</span>
              <strong>${escapeHtml(reminderLabel(dog.reminderDaysBefore))}</strong>
            </div>
            <div class="detail-item full">
              <span>Servizi preferiti</span>
              <strong>${escapeHtml((dog.services || []).join(", ") || "-")}</strong>
            </div>
            <div class="detail-item full">
              <span>Patologie</span>
              <strong>${escapeHtml(dog.pathologies || "-")}</strong>
            </div>
            <div class="detail-item full">
              <span>Note</span>
              <strong>${escapeHtml(dog.notes || "-")}</strong>
            </div>
          </div>
          <div class="modal-inline-actions">
            <button class="btn" type="button" data-detail-done-appointment="${dog.id}">Concludi prestazione</button>
            <button class="btn secondary" type="button" data-detail-appointment="${dog.id}">Nuovo appuntamento</button>
            <button class="btn secondary" type="button" data-detail-delete="${dog.id}">Elimina</button>
          </div>
          <details class="dog-history" data-history-dropdown>
            <summary class="history-summary">
              <span>Storico appuntamenti</span>
              <span class="badge">${history.length}</span>
            </summary>
            <div class="history-panel">
              ${
                history.length
                  ? `<div class="history-list">${history.map(renderHistoryAppointment).join("")}</div>`
                  : `<div class="empty-history">Nessun appuntamento registrato.</div>`
              }
            </div>
          </details>
        </div>
      </section>
    `,
    onHeaderAction: () => {
      const freshDog = state.dogs.find((item) => item.id === dog.id) || dog;
      closeModal();
      openDogDialog(freshDog);
    },
    onOpen: () => {
      const appointmentButton = modalRoot.querySelector("[data-detail-appointment]");
      const doneAppointmentButton = modalRoot.querySelector("[data-detail-done-appointment]");
      const deleteButton = modalRoot.querySelector("[data-detail-delete]");
      appointmentButton?.addEventListener("click", () => {
        const freshDog = state.dogs.find((item) => item.id === dog.id) || dog;
        closeModal();
        openAppointmentDialog({ date: todayISO(), dogId: freshDog.id, dogName: freshDog.dogName });
      });
      doneAppointmentButton?.addEventListener("click", () => {
        const freshDog = state.dogs.find((item) => item.id === dog.id) || dog;
        closeModal();
        openAppointmentDialog({
          date: todayISO(),
          startTime: currentTimeInput(),
          dogId: freshDog.id,
          dogName: freshDog.dogName,
          ownerName: freshDog.ownerName,
          contact: freshDog.contact,
          services: freshDog.services?.length ? freshDog.services : ["Toelettatura"],
          service: freshDog.services?.length ? freshDog.services.join(", ") : "Toelettatura",
          status: "completato"
        }, { completionMode: true });
      });
      deleteButton?.addEventListener("click", () => {
        const freshDog = state.dogs.find((item) => item.id === dog.id) || dog;
        confirmAction(`Eliminare la scheda di ${freshDog.dogName}?`, async () => {
          await api(`/api/dogs/${freshDog.id}`, { method: "DELETE", body: "{}" });
          await loadData();
          renderView();
          notify("Scheda eliminata");
        });
      });
      modalRoot.querySelectorAll("[data-history-appointment]").forEach((button) => {
        button.addEventListener("click", () => {
          const appointment = state.appointments.find((item) => item.id === button.dataset.historyAppointment);
          if (!appointment) return;
          closeModal();
          openAppointmentDialog(appointment);
        });
      });
    }
  });
}

function renderHistoryAppointment(appointment) {
  const treatment = appointment.treatmentDone || appointment.service || "-";
  const gallery = renderAppointmentGallery(appointment);
  return `
    <article class="history-item status-${escapeHtml(appointment.status)}">
      <div class="history-main">
        <strong>${escapeHtml(formatShortDate(appointment.date))}</strong>
        <span>${escapeHtml(appointment.startTime || "--:--")} ${appointment.endTime ? `- ${escapeHtml(appointment.endTime)}` : ""}</span>
      </div>
      <div class="history-treatment">
        <span>${escapeHtml(statusLabel(appointment.status))}</span>
        <strong>${escapeHtml(treatment)}</strong>
      </div>
      <div class="history-amount">${escapeHtml(moneyLabel(appointment.paidAmount))}</div>
      <button class="history-edit" type="button" data-history-appointment="${appointment.id}" aria-label="Modifica appuntamento del ${escapeAttr(formatShortDate(appointment.date))}">&#9998;</button>
      ${gallery}
    </article>
  `;
}

function renderBreedField(dog, animal) {
  return renderChoiceField({
    name: "breed",
    label: "Razza",
    customLabel: "Nuova razza",
    placeholder: "Scrivi o scegli razza",
    addLabel: "+ Aggiungi razza",
    customPlaceholder: "Scrivi nuova razza",
    current: dog.breed,
    options: animal.breeds || []
  });
}

function renderColorField(dog, animal, required = true, quickRequired = false) {
  return renderChoiceField({
    name: "color",
    label: "Colore cane",
    customLabel: "Nuovo colore",
    placeholder: "Scrivi o scegli colore",
    addLabel: "+ Aggiungi colore",
    customPlaceholder: "Scrivi nuovo colore",
    current: dog.color,
    options: animal.colors || [],
    required,
    quickRequired
  });
}

function renderEstimatedTimeField(value = {}) {
  const hours = Number(value.hours || 0);
  const minutes = Number(value.minutes || 0);
  const hourOptions = Array.from({ length: 13 }, (_, index) => index);
  const minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5);
  return `
    <fieldset class="field-group compact estimated-time-field">
      <legend>Tempo stimato</legend>
      <div class="time-parts">
        <label>Ore
          <select name="estimatedHours">
            ${hourOptions.map((item) => `<option value="${item}" ${item === hours ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
        <label>Minuti
          <select name="estimatedMinutesPart">
            ${minuteOptions.map((item) => `<option value="${item}" ${item === minutes ? "selected" : ""}>${String(item).padStart(2, "0")}</option>`).join("")}
          </select>
        </label>
      </div>
    </fieldset>
  `;
}

function renderChoiceField({ name, label, placeholder, customPlaceholder, current = "", options = [], required = false, quickRequired = false }) {
  const values = uniqueValues([...(options || []), current].filter(Boolean));
  const selected = String(current || "").trim();
  const quickRequiredAttr = quickRequired ? "data-quick-required" : "";
  const listId = `${name}Suggestions`;
  return `
    <label>${escapeHtml(label)}
      <input name="${escapeAttr(name)}Choice" list="${escapeAttr(listId)}" value="${escapeAttr(selected)}" placeholder="${escapeAttr(placeholder)}" autocomplete="off" data-choice-input ${required ? "required" : ""} ${quickRequiredAttr} />
      <datalist id="${escapeAttr(listId)}">
        ${values.map((value) => `<option value="${escapeAttr(value)}"></option>`).join("")}
      </datalist>
      <small class="field-hint">${escapeHtml(customPlaceholder)} se non lo trovi nei suggerimenti.</small>
    </label>
  `;
}

function renderServicePicker(selected = [], options = []) {
  const selectedServices = normalizeServiceList(selected);
  const serviceOptions = uniqueValues([...(options || []), ...selectedServices]);
  return `
    <div class="service-picker" data-service-picker>
      <div class="service-selected" data-service-selected>
        ${selectedServices.map(renderServiceChip).join("")}
      </div>
      <div class="service-picker-controls">
        <select data-service-select aria-label="Seleziona prestazione">
          <option value="">Seleziona prestazione</option>
          <option value="${CUSTOM_OPTION_VALUE}">+ Aggiungi prestazione</option>
          ${serviceOptions.map((service) => `<option value="${escapeAttr(service)}">${escapeHtml(service)}</option>`).join("")}
        </select>
      </div>
      <div class="service-custom-row" data-service-custom hidden>
        <input data-service-custom-input placeholder="Nome nuova prestazione" />
        <button class="btn secondary slim" type="button" data-service-custom-add>Aggiungi</button>
      </div>
    </div>
  `;
}

function renderServiceChip(service) {
  return `
    <span class="service-chip" data-service-chip>
      <input type="hidden" name="services" value="${escapeAttr(service)}" />
      <span>${escapeHtml(service)}</span>
      <button type="button" data-service-remove title="Rimuovi prestazione" aria-label="Rimuovi ${escapeAttr(service)}">&times;</button>
    </span>
  `;
}

function bindChoiceSelects(form) {
  form.querySelectorAll("[data-choice-input]").forEach((input) => {
    const initiallyRequired = input.required;
    const sync = () => {
      input.required = !input.disabled && (initiallyRequired || input.hasAttribute("data-quick-required"));
    };
    input._syncChoiceCustom = sync;
    sync();
  });
}

function bindServicePickers(form) {
  form.querySelectorAll("[data-service-picker]").forEach((picker) => {
    const select = picker.querySelector("[data-service-select]");
    const customRow = picker.querySelector("[data-service-custom]");
    const customInput = picker.querySelector("[data-service-custom-input]");
    const customAdd = picker.querySelector("[data-service-custom-add]");
    const addService = (service) => {
      const label = String(service || "").trim();
      if (!label) return;
      const existing = collectServicesFromPicker(picker).map((item) => item.toLowerCase());
      if (!existing.includes(label.toLowerCase())) {
        picker.querySelector("[data-service-selected]").insertAdjacentHTML("beforeend", renderServiceChip(label));
      }
      updateServicePickerEmpty(picker);
      select.value = "";
    };
    select.addEventListener("change", () => {
      if (select.value === CUSTOM_OPTION_VALUE) {
        customRow.hidden = false;
        customInput.focus();
        return;
      }
      addService(select.value);
      customRow.hidden = true;
      customInput.value = "";
    });
    customAdd.addEventListener("click", () => {
      addService(customInput.value);
      customInput.value = "";
      customRow.hidden = true;
      select.value = "";
    });
    customInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      customAdd.click();
    });
    picker.querySelector("[data-service-selected]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-service-remove]");
      if (!button) return;
      button.closest("[data-service-chip]")?.remove();
      updateServicePickerEmpty(picker);
    });
    updateServicePickerEmpty(picker);
  });
}

function collectServicesFromPicker(picker) {
  return normalizeServiceList(Array.from(picker.querySelectorAll('input[name="services"]')).map((input) => input.value));
}

function collectServicesFromForm(formData, form) {
  const services = formData.getAll("services");
  form?.querySelectorAll("[data-service-custom-input]")?.forEach((input) => {
    const value = String(input.value || "").trim();
    if (value && !input.closest("[data-service-custom]")?.hidden) services.push(value);
  });
  return normalizeServiceList(services);
}

function setServicePickerValues(form, services) {
  const picker = form.querySelector("[data-service-picker]");
  if (!picker) return;
  picker.querySelector("[data-service-selected]").innerHTML = normalizeServiceList(services).map(renderServiceChip).join("");
  updateServicePickerEmpty(picker);
}

function serviceAmountMap(appointment = {}) {
  const map = new Map();
  if (Array.isArray(appointment.serviceAmounts)) {
    appointment.serviceAmounts.forEach((item) => {
      const service = String(item?.service || "").trim();
      if (service) map.set(service.toLowerCase(), Number(item.amount || 0));
    });
  }
  return map;
}

function renderServiceAmountRows(services = [], appointment = {}) {
  const selected = normalizeServiceList(services);
  if (!selected.length) return `<p class="muted">Seleziona almeno un servizio.</p>`;
  const amounts = serviceAmountMap(appointment);
  const fallbackAmount = Number(appointment.paidAmount || 0);
  const splitFallback = fallbackAmount > 0 && !amounts.size ? fallbackAmount / selected.length : 0;
  return selected
    .map((service) => {
      const amount = amounts.has(service.toLowerCase()) ? amounts.get(service.toLowerCase()) : splitFallback;
      return `
        <div class="service-amount-row" data-service-amount-row>
          <input type="hidden" name="serviceAmountService" value="${escapeAttr(service)}" />
          <span>${escapeHtml(service)}</span>
          <input name="serviceAmountValue" type="number" min="0" step="0.01" value="${amount ? escapeAttr(Number(amount).toFixed(2)) : ""}" inputmode="decimal" data-service-amount-input />
        </div>
      `;
    })
    .join("");
}

function collectServiceAmounts(form) {
  return Array.from(form.querySelectorAll("[data-service-amount-row]"))
    .map((row) => ({
      service: row.querySelector('input[name="serviceAmountService"]')?.value || "",
      amount: Number(row.querySelector('input[name="serviceAmountValue"]')?.value || 0)
    }))
    .filter((item) => item.service);
}

function serviceAmountsTotal(serviceAmounts = []) {
  return (serviceAmounts || []).reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
}

function syncServiceAmountTotal(form) {
  const total = serviceAmountsTotal(collectServiceAmounts(form));
  const target = form.querySelector("[data-service-amount-total]");
  if (target) target.textContent = moneyLabel(total);
}

function syncServiceAmountRows(form, baseAppointment = {}) {
  const list = form.querySelector("[data-service-amount-list]");
  if (!list) return;
  const previous = { serviceAmounts: collectServiceAmounts(form) };
  const services = collectServicesFromPicker(form.querySelector("[data-service-picker]"));
  list.innerHTML = renderServiceAmountRows(services, previous.serviceAmounts.length ? previous : baseAppointment);
  syncServiceAmountTotal(form);
}

function updateServicePickerEmpty(picker) {
  const selected = picker.querySelector("[data-service-selected]");
  const hasServices = selected.querySelector('input[name="services"]');
  selected.querySelector("[data-empty-services]")?.remove();
  if (!hasServices) {
    selected.insertAdjacentHTML("beforeend", `<span class="muted" data-empty-services>Nessuna prestazione selezionata</span>`);
  }
}

function selectedChoiceValue(formData, name) {
  return String(formData.get(`${name}Choice`) || "").trim();
}

function openDogDialog(dog = {}) {
  const isEdit = Boolean(dog.id);
  const animal = getAnimalSettings();
  const dogServices = dog.services || [];
  const estimatedTime = splitMinutes(dog.estimatedMinutes);
  openModal({
    title: isEdit ? "Modifica scheda" : "Nuova scheda",
    submitLabel: isEdit ? "Salva scheda" : "Crea scheda",
    content: `
      <div class="form-grid">
        <label>Nome cane
          <input name="dogName" value="${escapeAttr(dog.dogName || "")}" required />
        </label>
        ${renderEstimatedTimeField(estimatedTime)}
        ${renderBreedField(dog, animal)}
        <label>Anno nascita
          <input name="birthYear" type="number" min="1980" max="${new Date().getFullYear()}" value="${escapeAttr(dog.birthYear || "")}" />
        </label>
        ${renderColorField(dog, animal)}
        <fieldset class="field-group">
          <legend>Sesso cane</legend>
          <label class="choice-line"><input name="sex" type="radio" value="M" ${dog.sex === "M" ? "checked" : ""} required /> Maschio</label>
          <label class="choice-line"><input name="sex" type="radio" value="F" ${dog.sex === "F" ? "checked" : ""} required /> Femmina</label>
        </fieldset>
        <label>Reminder WhatsApp
          <select name="reminderDaysBefore">
            ${[0, 1, 2, 3, 5, 7].map((days) => `<option value="${days}" ${Number(dog.reminderDaysBefore ?? 1) === days ? "selected" : ""}>${escapeHtml(reminderLabel(days))}</option>`).join("")}
          </select>
        </label>
        <label>Nome proprietario
          <input name="ownerName" value="${escapeAttr(dog.ownerName || "")}" />
        </label>
        <label>Numero contatto
          <input name="contact" value="${escapeAttr(dog.contact || "")}" inputmode="tel" ${dog.contactMissing ? "disabled" : ""} required />
        </label>
        <label>Secondo contatto
          <input name="alternateContact" value="${escapeAttr(dog.alternateContact || "")}" inputmode="tel" />
        </label>
        <label class="checkbox-line full">
          <input name="contactMissing" type="checkbox" ${dog.contactMissing ? "checked" : ""} />
          Numero non presente
        </label>
        <label class="checkbox-line full">
          <input name="manualTopClient" type="checkbox" ${dog.manualTopClient ? "checked" : ""} />
          Cliente top manuale
        </label>
        <fieldset class="field-group full">
          <legend>Prestazioni</legend>
          ${renderServicePicker(dogServices, animal.services)}
        </fieldset>
        <fieldset class="field-group full">
          <legend>Consenso utilizzo immagini</legend>
          <label class="choice-line"><input name="imageConsent" type="radio" value="yes" ${dog.imageConsent === "yes" ? "checked" : ""} required /> Si</label>
          <label class="choice-line"><input name="imageConsent" type="radio" value="no" ${dog.imageConsent === "no" ? "checked" : ""} required /> No</label>
        </fieldset>
        <label class="full">Patologie
          <textarea name="pathologies">${escapeHtml(dog.pathologies || "")}</textarea>
        </label>
        <label class="full">Note
          <textarea name="notes">${escapeHtml(dog.notes || "")}</textarea>
        </label>
        <label class="full">Foto
          <input name="photo" type="file" accept="image/*" />
        </label>
        <div class="full">
          <img class="photo-preview" id="photoPreview" src="${escapeAttr(dog.photoUrl || "")}" alt="Anteprima foto" />
        </div>
      </div>
    `,
    onOpen: (form) => {
      bindChoiceSelects(form);
      bindServicePickers(form);
      const fileInput = form.elements.photo;
      const preview = document.getElementById("photoPreview");
      if (!dog.photoUrl) preview.style.display = "none";
      const syncContact = () => {
        const missing = form.elements.contactMissing.checked;
        form.elements.contact.disabled = missing;
        form.elements.contact.required = !missing;
        if (missing) form.elements.contact.value = "";
      };
      form.elements.contactMissing.addEventListener("change", syncContact);
      syncContact();
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        preview.src = await imageFileToDataUrl(file);
        preview.style.display = "block";
      });
    },
    onSubmit: async (formData, form) => {
      const photo = form.elements.photo.files[0];
      const services = collectServicesFromForm(formData, form);
      const breed = selectedChoiceValue(formData, "breed");
      const color = selectedChoiceValue(formData, "color");
      const payload = {
        dogName: formData.get("dogName"),
        ownerName: formData.get("ownerName"),
        contact: formData.get("contact"),
        contactMissing: formData.get("contactMissing") === "on",
        alternateContact: formData.get("alternateContact"),
        breed,
        birthYear: formData.get("birthYear"),
        color,
        sex: formData.get("sex"),
        imageConsent: formData.get("imageConsent"),
        manualTopClient: formData.get("manualTopClient") === "on",
        pathologies: formData.get("pathologies"),
        estimatedMinutes: timePartsToMinutes(formData.get("estimatedHours"), formData.get("estimatedMinutesPart")),
        reminderDaysBefore: formData.get("reminderDaysBefore"),
        services,
        notes: formData.get("notes")
      };
      if (photo) payload.photoData = await imageFileToDataUrl(photo);
      await api(isEdit ? `/api/dogs/${dog.id}` : "/api/dogs", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      await loadData();
      renderView();
      notify(isEdit ? "Scheda aggiornata" : "Scheda creata");
    }
  });
}

function openAppointmentDialog(appointment = {}, options = {}) {
  const isEdit = Boolean(appointment.id);
  const completionMode = Boolean(options.completionMode) || (!isEdit && appointment.status === "completato");
  const currentStatus = completionMode ? "completato" : appointment.status || "programmato";
  const selectedDog = appointment.dogId ? state.dogs.find((dog) => dog.id === appointment.dogId) : null;
  const animal = getAnimalSettings();
  const plannedServices = normalizeServiceList(
    appointment.services?.length ? appointment.services : appointment.service || selectedDog?.services || ["Toelettatura"]
  );
  const performedServices = currentStatus === "completato" ? normalizeServiceList(appointment.treatmentDone) : [];
  const selectedServices = performedServices.length ? performedServices : plannedServices;
  const serviceOptions = uniqueValues([...(animal.services || []), ...selectedServices, "Toelettatura"]);
  openModal({
    title: completionMode ? "Concludi prestazione" : isEdit ? "Modifica appuntamento" : "Nuovo appuntamento",
    submitLabel: completionMode ? "Salva prestazione" : isEdit ? "Salva appuntamento" : "Crea appuntamento",
    dangerLabel: isEdit ? "Elimina" : "",
    extraActions:
      isEdit && currentStatus !== "completato"
        ? `<button class="btn secondary" type="button" data-complete-form>Concludi prestazione</button>`
        : "",
    content: `
      <div class="form-grid">
        <label>Data
          <input name="date" type="date" value="${escapeAttr(appointment.date || todayISO())}" required />
        </label>
        <label>Stato
          <select name="status">
            ${["programmato", "confermato", "completato", "annullato"]
              .map((status) => `<option value="${status}" ${currentStatus === status ? "selected" : ""}>${statusLabel(status)}</option>`)
              .join("")}
          </select>
        </label>
        <label>Inizio
          <input name="startTime" type="time" value="${escapeAttr(appointment.startTime || "09:00")}" required />
        </label>
        <label>Fine
          <input name="endTime" type="time" value="${escapeAttr(appointment.endTime || "")}" />
        </label>
        <label class="full">Scheda cane
          <select name="dogId" id="appointmentDog">
            <option value="">Cane non presente in scheda</option>
            ${state.dogs
              .map((dog) => `<option value="${dog.id}" ${dog.id === appointment.dogId ? "selected" : ""}>${escapeHtml(dog.dogName)} - ${escapeHtml(dog.ownerName || "senza proprietario")}</option>`)
              .join("")}
          </select>
        </label>
        ${
          appointment.dogId
            ? ""
            : `<fieldset class="field-group full quick-profile" data-create-dog-row>
                <legend>Scheda rapida cane</legend>
                <label class="checkbox-line">
                  <input name="createDogProfile" type="checkbox" checked />
                  Crea subito la scheda cane con questi dati
                </label>
                <label class="checkbox-line">
                  <input name="contactMissing" type="checkbox" />
                  Numero non presente
                </label>
                ${renderBreedField({}, animal)}
                ${renderColorField({}, animal, false, false)}
                <fieldset class="field-group compact">
                  <legend>Sesso cane</legend>
                  <label class="choice-line"><input name="sex" type="radio" value="M" data-quick-required /> Maschio</label>
                  <label class="choice-line"><input name="sex" type="radio" value="F" data-quick-required /> Femmina</label>
                </fieldset>
                <fieldset class="field-group compact">
                  <legend>Consenso immagini</legend>
                  <label class="choice-line"><input name="imageConsent" type="radio" value="yes" data-quick-required /> Si</label>
                  <label class="choice-line"><input name="imageConsent" type="radio" value="no" data-quick-required /> No</label>
                </fieldset>
              </fieldset>`
        }
        <label>Nome cane
          <input name="dogName" value="${escapeAttr(selectedDog?.dogName || appointment.dogName || "")}" required />
        </label>
        <label>Proprietario
          <input name="ownerName" value="${escapeAttr(selectedDog?.ownerName || appointment.ownerName || "")}" />
        </label>
        <label>Contatto
          <input name="contact" value="${escapeAttr(selectedDog?.contact || appointment.contact || "")}" inputmode="tel" />
        </label>
        <fieldset class="field-group full">
          <legend data-service-legend>${currentStatus === "completato" ? "Servizi eseguiti" : "Prestazioni previste"}</legend>
          ${renderServicePicker(selectedServices, serviceOptions)}
        </fieldset>
        <fieldset class="field-group full service-amounts" data-completion-field data-service-amounts>
          <legend>Prezzi servizi</legend>
          <div class="service-amount-list" data-service-amount-list>
            ${renderServiceAmountRows(selectedServices, appointment)}
          </div>
          <div class="service-amount-total">
            <span>Totale prestazione</span>
            <strong data-service-amount-total>${escapeHtml(moneyLabel(appointment.paidAmount))}</strong>
          </div>
        </fieldset>
        <div class="full gallery-upload" data-completion-field>
          <label>Foto prima del lavoro
            <input name="beforePhotos" type="file" accept="image/*" multiple />
          </label>
          ${appointment.beforePhotos?.length ? `<div class="gallery-preview">${appointment.beforePhotos.map((src) => `<img src="${escapeAttr(src)}" alt="Prima del lavoro" />`).join("")}</div>` : ""}
          ${appointment.beforePhotos?.length ? `<label class="checkbox-line"><input name="clearBeforePhotos" type="checkbox" /> Rimuovi foto prima salvate</label>` : ""}
        </div>
        <div class="full gallery-upload" data-completion-field>
          <label>Foto dopo il lavoro
            <input name="afterPhotos" type="file" accept="image/*" multiple />
          </label>
          ${appointment.afterPhotos?.length ? `<div class="gallery-preview">${appointment.afterPhotos.map((src) => `<img src="${escapeAttr(src)}" alt="Dopo il lavoro" />`).join("")}</div>` : ""}
          ${appointment.afterPhotos?.length ? `<label class="checkbox-line"><input name="clearAfterPhotos" type="checkbox" /> Rimuovi foto dopo salvate</label>` : ""}
        </div>
        <label class="full">Note appuntamento
          <textarea name="notes">${escapeHtml(appointment.notes || "")}</textarea>
        </label>
      </div>
    `,
    onOpen: (form) => {
      bindChoiceSelects(form);
      bindServicePickers(form);
      const createDogRows = form.querySelectorAll("[data-create-dog-row]");
      const completionFields = form.querySelectorAll("[data-completion-field]");
      const serviceLegend = form.querySelector("[data-service-legend]");
      const syncAmounts = () => syncServiceAmountRows(form, appointment);
      const syncCompletionFields = () => {
        const isCompleted = form.elements.status.value === "completato";
        if (serviceLegend) serviceLegend.textContent = isCompleted ? "Servizi eseguiti" : "Prestazioni previste";
        completionFields.forEach((field) => {
          field.hidden = !isCompleted;
          field.querySelectorAll("input, textarea, select").forEach((input) => {
            input.disabled = !isCompleted;
          });
        });
      };
      const syncCreateDogRow = () => {
        const hasLinkedDog = Boolean(form.elements.dogId.value);
        const wantsProfile = Boolean(form.elements.createDogProfile?.checked);
        createDogRows.forEach((row) => {
          row.hidden = hasLinkedDog;
          row.querySelectorAll("input, select, textarea").forEach((input) => {
            if (input.name === "createDogProfile") {
              input.disabled = hasLinkedDog;
              if (hasLinkedDog) input.checked = false;
              return;
            }
            input.disabled = hasLinkedDog || !wantsProfile;
            input.required = !hasLinkedDog && wantsProfile && input.hasAttribute("data-quick-required");
          });
        });
        form.querySelectorAll("[data-choice-input]").forEach((input) => input._syncChoiceCustom?.());
        if (form.elements.contactMissing) {
          const missing = form.elements.contactMissing.checked && !hasLinkedDog && wantsProfile;
          form.elements.contact.disabled = missing;
          form.elements.contact.required = !hasLinkedDog && wantsProfile && !missing;
          if (missing) form.elements.contact.value = "";
        }
      };
      modalRoot.querySelector("[data-complete-form]")?.addEventListener("click", () => {
        form.elements.status.value = "completato";
        syncCompletionFields();
        syncAmounts();
        form.querySelector("[data-service-select]")?.focus();
        notify("Completa servizio e importo, poi salva la prestazione");
      });
      form.elements.status.addEventListener("change", syncCompletionFields);
      form.addEventListener("change", (event) => {
        if (event.target.matches("[data-service-select]")) setTimeout(syncAmounts, 0);
        if (event.target.matches("[data-service-amount-input]")) syncServiceAmountTotal(form);
      });
      form.addEventListener("click", (event) => {
        if (event.target.closest("[data-service-remove], [data-service-custom-add]")) setTimeout(syncAmounts, 0);
      });
      form.elements.createDogProfile?.addEventListener("change", syncCreateDogRow);
      form.elements.contactMissing?.addEventListener("change", syncCreateDogRow);
      form.elements.dogId.addEventListener("change", () => {
        syncCreateDogRow();
        const dog = state.dogs.find((item) => item.id === form.elements.dogId.value);
        if (!dog) return;
        form.elements.dogName.value = dog.dogName || "";
        form.elements.ownerName.value = dog.ownerName || "";
        form.elements.contact.value = dog.contact || "";
        setServicePickerValues(form, dog.services);
        syncAmounts();
      });
      syncCreateDogRow();
      syncCompletionFields();
      syncServiceAmountTotal(form);
    },
    onDanger: async () => {
      await api(`/api/appointments/${appointment.id}`, { method: "DELETE", body: "{}" });
      await loadData();
      renderView();
      notify("Appuntamento eliminato");
    },
    onSubmit: async (formData, form) => {
      const payload = Object.fromEntries(formData.entries());
      const services = collectServicesFromForm(formData, form);
      if (!services.length) services.push("Toelettatura");
      payload.services = services;
      payload.service = services.join(", ");
      payload.breed = selectedChoiceValue(formData, "breed");
      payload.color = selectedChoiceValue(formData, "color");
      payload.createDogProfile = formData.get("createDogProfile") === "on";
      if (completionMode) payload.status = "completato";
      if (payload.status === "completato") payload.treatmentDone = payload.service || "Toelettatura";
      if (payload.status !== "completato") {
        payload.treatmentDone = "";
        payload.paidAmount = "";
        payload.serviceAmounts = [];
      } else {
        payload.serviceAmounts = collectServiceAmounts(form);
        payload.paidAmount = Number(serviceAmountsTotal(payload.serviceAmounts).toFixed(2));
        payload.beforePhotoData = await filesToDataUrls(form.elements.beforePhotos?.files, 5);
        payload.afterPhotoData = await filesToDataUrls(form.elements.afterPhotos?.files, 5);
        payload.clearBeforePhotos = formData.get("clearBeforePhotos") === "on";
        payload.clearAfterPhotos = formData.get("clearAfterPhotos") === "on";
      }
      await api(isEdit ? `/api/appointments/${appointment.id}` : "/api/appointments", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      await loadData();
      state.calendarDate = parseISODate(payload.date);
      renderView();
      notify(payload.status === "completato" ? "Prestazione conclusa" : isEdit ? "Appuntamento aggiornato" : "Appuntamento creato");
    }
  });
}

function openUserDialog(user = {}) {
  const isEdit = Boolean(user.id);
  openModal({
    title: isEdit ? "Modifica utente" : "Nuovo utente",
    submitLabel: isEdit ? "Salva utente" : "Crea utente",
    content: `
      <div class="form-grid">
        <label>Nome visualizzato
          <input name="displayName" value="${escapeAttr(user.displayName || "")}" required />
        </label>
        <label>Username
          <input name="username" value="${escapeAttr(user.username || "")}" autocomplete="off" required />
        </label>
        <label>Ruolo
          <select name="role">
            <option value="user" ${user.role !== "admin" ? "selected" : ""}>Operatore</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Amministratore</option>
          </select>
        </label>
        <label>Password ${isEdit ? "(lascia vuota per non cambiarla)" : ""}
          <input name="password" type="password" autocomplete="new-password" ${isEdit ? "" : "required"} />
        </label>
        <label>Foto profilo
          <input name="avatar" type="file" accept="image/*" />
        </label>
        <div class="user-avatar-preview-wrap">
          ${renderUserAvatar(user, "user-avatar-preview")}
        </div>
        <label class="checkbox-line full">
          <input name="clearAvatar" type="checkbox" />
          Rimuovi foto profilo
        </label>
        <label class="checkbox-line full">
          <input name="active" type="checkbox" ${user.active !== false ? "checked" : ""} />
          Utente attivo
        </label>
      </div>
    `,
    onOpen: (form) => {
      const avatarInput = form.elements.avatar;
      const preview = form.querySelector(".user-avatar-preview");
      avatarInput?.addEventListener("change", async () => {
        const file = avatarInput.files[0];
        if (!file || !preview) return;
        const dataUrl = await imageFileToDataUrl(file, { maxSize: 420, quality: 0.82 });
        preview.innerHTML = `<img src="${escapeAttr(dataUrl)}" alt="Foto profilo" />`;
      });
    },
    onSubmit: async (formData, form) => {
      const avatar = form.elements.avatar.files[0];
      const payload = {
        displayName: formData.get("displayName"),
        username: formData.get("username"),
        role: formData.get("role"),
        password: formData.get("password"),
        clearAvatar: formData.get("clearAvatar") === "on",
        active: formData.get("active") === "on"
      };
      if (avatar) payload.avatarData = await imageFileToDataUrl(avatar, { maxSize: 420, quality: 0.82 });
      const response = await api(isEdit ? `/api/users/${user.id}` : "/api/users", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      if (response.user?.id === state.me?.id) state.me = response.user;
      await loadData();
      if (response.user?.id === state.me?.id) renderShell();
      else renderView();
      notify(isEdit ? "Utente aggiornato" : "Utente creato");
    }
  });
}

function openModal({
  title,
  content,
  submitLabel = "Salva",
  dangerLabel = "",
  headerAction = "",
  extraActions = "",
  hideActions = false,
  preventClose = false,
  onSubmit,
  onDanger,
  onOpen,
  onHeaderAction
}) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="presentation">
      <form class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div class="modal-title-row">
            <h2>${escapeHtml(title)}</h2>
            ${headerAction}
          </div>
          ${preventClose ? "" : `<button class="modal-close" type="button" data-close aria-label="Chiudi">&times;</button>`}
        </div>
        <div class="modal-body">${content}</div>
        ${
          hideActions
            ? ""
            : `<div class="modal-actions">
                ${dangerLabel ? `<button class="btn danger" type="button" data-danger>${escapeHtml(dangerLabel)}</button>` : ""}
                ${extraActions}
                <button class="btn" type="submit">${escapeHtml(submitLabel)}</button>
              </div>`
        }
      </form>
    </div>
  `;
  const form = modalRoot.querySelector("form");
  modalRoot.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      await onSubmit(new FormData(form), form);
      closeModal();
    } catch (err) {
      notify(err.message);
      submitButton.disabled = false;
    }
  });
  const dangerButton = modalRoot.querySelector("[data-danger]");
  if (dangerButton && onDanger) {
    dangerButton.addEventListener("click", async () => {
      dangerButton.disabled = true;
      try {
        await onDanger();
        closeModal();
      } catch (err) {
        notify(err.message);
        dangerButton.disabled = false;
      }
    });
  }
  const headerActionButton = modalRoot.querySelector("[data-header-action]");
  if (headerActionButton && onHeaderAction) {
    headerActionButton.addEventListener("click", onHeaderAction);
  }
  onOpen?.(form);
  const firstInput = form.querySelector("input, select, textarea, button");
  firstInput?.focus();
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function handleNewDogAction(event) {
  const target = event.target?.closest ? event.target : event.target?.parentElement;
  const trigger = target?.closest?.("[data-new-dog]");
  if (!trigger) return;
  if (event.type === "pointerup" && event.pointerType === "mouse") return;
  event.preventDefault();
  event.stopPropagation();
  const now = Date.now();
  if (now - lastNewDogActionAt < 500) return;
  lastNewDogActionAt = now;
  try {
    openDogDialog();
  } catch (err) {
    console.error(err);
    notify(err?.message || "Errore apertura nuova scheda");
  }
}

function handlePhotoZoomClick(event) {
  const trigger = event.target.closest("[data-photo-zoom]");
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  openPhotoLightbox(trigger.dataset.photoSrc, trigger.dataset.photoTitle || "Foto servizio");
}

function openPhotoLightbox(src, title = "Foto servizio") {
  if (!src) return;
  closePhotoLightbox();
  const viewer = document.createElement("div");
  viewer.id = "photoLightbox";
  viewer.className = "photo-lightbox";
  viewer.innerHTML = `
    <div class="photo-lightbox-backdrop" data-photo-close></div>
    <figure class="photo-lightbox-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
      <button class="modal-close photo-lightbox-close" type="button" data-photo-close aria-label="Chiudi foto">x</button>
      <img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" />
      <figcaption>${escapeHtml(title)}</figcaption>
    </figure>
  `;
  document.body.appendChild(viewer);
  viewer.querySelectorAll("[data-photo-close]").forEach((button) => button.addEventListener("click", closePhotoLightbox));
  viewer.querySelector(".photo-lightbox-close")?.focus();
}

function closePhotoLightbox() {
  document.getElementById("photoLightbox")?.remove();
}

function confirmAction(message, onConfirm) {
  openModal({
    title: "Conferma",
    submitLabel: "Conferma",
    content: `<p>${escapeHtml(message)}</p>`,
    onSubmit: onConfirm
  });
}

function filteredDogList() {
  const query = state.dogSearch.trim().toLowerCase();
  if (!query) return state.dogs;
  return state.dogs.filter((dog) =>
    [dog.dogName, dog.ownerName, dog.contact, dog.alternateContact, dog.breed, dog.color, dog.pathologies, dog.notes, ...(dog.services || [])].some((field) =>
      String(field || "").toLowerCase().includes(query)
    )
  );
}

function appointmentsForDate(iso) {
  return state.appointments
    .filter((appointment) => appointment.date === iso)
    .sort((a, b) => `${a.startTime || ""}`.localeCompare(`${b.startTime || ""}`));
}

function dogAppointmentHistory(dog) {
  const dogName = lowerText(dog.dogName);
  const ownerName = lowerText(dog.ownerName);
  return state.appointments
    .filter((appointment) => {
      if (appointment.dogId && appointment.dogId === dog.id) return true;
      if (appointment.dogId) return false;
      return lowerText(appointment.dogName) === dogName && (!ownerName || lowerText(appointment.ownerName) === ownerName);
    })
    .sort((a, b) => `${b.date || ""} ${b.startTime || ""}`.localeCompare(`${a.date || ""} ${a.startTime || ""}`));
}

function selectedServiceHistoryDog() {
  if (!state.dogs.length) return null;
  const selected = state.dogs.find((dog) => dog.id === state.serviceHistoryDogId) || state.dogs[0];
  state.serviceHistoryDogId = selected.id;
  return selected;
}

function serviceHistoryDogLabel(dog = {}) {
  return [dog.dogName || "Senza nome", dog.ownerName].filter(Boolean).join(" - ");
}

function serviceHistoryDogFromSearch(value, exactOnly = false) {
  const query = lowerText(value);
  if (!query) return null;
  const exact = state.dogs.find((dog) => lowerText(serviceHistoryDogLabel(dog)) === query);
  if (exact || exactOnly) return exact || null;
  const startsWith = state.dogs.filter((dog) =>
    [dog.dogName, dog.ownerName, dog.contact, dog.breed, serviceHistoryDogLabel(dog)].some((field) => lowerText(field).startsWith(query))
  );
  if (startsWith.length === 1) return startsWith[0];
  const contains = state.dogs.filter((dog) =>
    [dog.dogName, dog.ownerName, dog.contact, dog.breed, serviceHistoryDogLabel(dog)].some((field) => lowerText(field).includes(query))
  );
  return contains.length === 1 ? contains[0] : null;
}

function appointmentPhotoCount(appointment) {
  return (Array.isArray(appointment.beforePhotos) ? appointment.beforePhotos.length : 0) + (Array.isArray(appointment.afterPhotos) ? appointment.afterPhotos.length : 0);
}

function appointmentServiceRows(appointment) {
  if (Array.isArray(appointment?.serviceAmounts) && appointment.serviceAmounts.length) {
    return appointment.serviceAmounts
      .map((item) => ({
        service: String(item?.service || "").trim() || "Servizio",
        amount: Number(item?.amount || 0)
      }))
      .filter((item) => item.service);
  }
  const services = normalizeServiceList(appointment?.services?.length ? appointment.services : appointment?.treatmentDone || appointment?.service || "Servizio");
  const total = Number(appointment?.paidAmount || 0);
  const share = total > 0 && services.length ? total / services.length : 0;
  return (services.length ? services : ["Servizio"]).map((service) => ({ service, amount: share }));
}

function isScheduledAppointment(appointment) {
  return ["programmato", "confermato"].includes(appointment.status) && (!appointment.date || appointment.date >= todayISO());
}

function scheduledAppointmentLabel(count) {
  return count === 1 ? "1 appuntamento programmato" : `${count} appuntamenti programmati`;
}

function lowerText(value) {
  return String(value || "").trim().toLowerCase();
}

function todayISO() {
  return toISODate(new Date());
}

function currentTimeInput() {
  const date = new Date();
  const minutes = Math.round(date.getMinutes() / 5) * 5;
  if (minutes === 60) {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0);
  } else {
    date.setMinutes(minutes);
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function currentMinutesOfDay() {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatPlannerTime(minutes) {
  const total = clampNumber(Math.round(Number(minutes || 0)), 0, 24 * 60);
  if (total === 24 * 60) return "24:00";
  const hours = Math.floor(total / 60) % 24;
  const minutePart = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutePart).padStart(2, "0")}`;
}

function percentWithin(minutes, range) {
  const total = Math.max(1, range.end - range.start);
  return Number((((minutes - range.start) / total) * 100).toFixed(3));
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date) {
  const clone = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = clone.getDay() || 7;
  clone.setDate(clone.getDate() - day + 1);
  return clone;
}

function addDays(date, days) {
  const clone = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  clone.setDate(clone.getDate() + days);
  return clone;
}

function weekTitle(date) {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return `Settimana ${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatLongDate(value) {
  if (!value) return "-";
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatMonthYear(value) {
  const date = parseISODate(`${String(value || "").slice(0, 7)}-01`);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function statusLabel(status) {
  return {
    programmato: "Programmato",
    confermato: "Confermato",
    completato: "Completato",
    annullato: "Annullato"
  }[status] || "Programmato";
}

function durationLabel(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "Tempo n.d.";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} min`;
  return `${hours}h${rest ? ` ${rest}m` : ""}`;
}

function moneyLabel(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Non pagato";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(amount);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function shortText(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderUserAvatar(user = {}, className = "") {
  const name = user.displayName || user.username || "Utente";
  const image = user.avatarUrl
    ? `<img src="${escapeAttr(user.avatarUrl)}" alt="Foto profilo ${escapeAttr(name)}" />`
    : `<span>${escapeHtml(initials(name))}</span>`;
  return `<span class="user-avatar ${escapeAttr(className)}">${image}</span>`;
}

function parseTextareaList(value) {
  return uniqueValues(
    String(value || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeServiceList(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return uniqueValues(raw.map((item) => String(item || "").trim()).filter(Boolean));
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function splitMinutes(minutes) {
  const max = 12 * 60 + 55;
  const raw = Number(minutes || 0);
  const total = Number.isFinite(raw) ? Math.max(0, Math.min(Math.round(raw / 5) * 5, max)) : 0;
  return {
    hours: Math.floor(total / 60),
    minutes: total % 60
  };
}

function timePartsToMinutes(hours, minutes) {
  const hourValue = Math.max(0, Math.min(Number(hours || 0), 12));
  const minuteValue = Math.max(0, Math.min(Number(minutes || 0), 55));
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return 0;
  return hourValue * 60 + minuteValue;
}

function reminderLabel(days) {
  const value = Number(days);
  if (!Number.isFinite(value) || value <= 0) return "Il giorno stesso";
  if (value === 1) return "1 giorno prima";
  return `${value} giorni prima`;
}

function ageLabel(birthYear) {
  const year = Number(birthYear || 0);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1980 || year > currentYear) return "-";
  const age = currentYear - year;
  if (age <= 0) return `Meno di 1 anno (${year})`;
  if (age === 1) return `1 anno (${year})`;
  return `${age} anni (${year})`;
}

function isTopDog(dog) {
  if (dog?.manualTopClient) return true;
  const threshold = Math.max(1, Number(getAnimalSettings().loyaltyTopVisitsPerYear || 8));
  const year = String(new Date().getFullYear());
  const completedThisYear = dogAppointmentHistory(dog).filter((appointment) =>
    appointment.status === "completato" && String(appointment.date || "").startsWith(`${year}-`)
  ).length;
  return completedThisYear >= threshold;
}

function countBy(items, picker = (item) => item) {
  const counts = new Map();
  for (const item of items || []) {
    const picked = picker(item);
    const labels = Array.isArray(picked) ? picked : [picked];
    for (const rawLabel of labels) {
      const label = String(rawLabel || "Non indicato").trim() || "Non indicato";
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "it"));
}

function average(values) {
  const valid = (values || []).map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function topStatLabel(stats) {
  const first = stats?.[0];
  if (!first) return "-";
  return `${first.label} (${first.count})`;
}

function topDashboardClient(completedAppointments = []) {
  const counts = new Map();
  for (const appointment of completedAppointments) {
    const key = appointment.dogId || `name:${lowerText(appointment.dogName)}|owner:${lowerText(appointment.ownerName)}`;
    const current = counts.get(key) || { appointment, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  const first = [...counts.values()].sort((a, b) => b.count - a.count || String(a.appointment.dogName || "").localeCompare(String(b.appointment.dogName || ""), "it"))[0];
  if (!first) return null;
  const dog =
    state.dogs.find((item) => item.id === first.appointment.dogId) ||
    state.dogs.find(
      (item) =>
        lowerText(item.dogName) === lowerText(first.appointment.dogName) &&
        (!first.appointment.ownerName || lowerText(item.ownerName) === lowerText(first.appointment.ownerName))
    );
  return {
    dog,
    count: first.count,
    name: dog?.dogName || first.appointment.dogName || "Senza nome"
  };
}

function topRevenueClient(completedAppointments = []) {
  const totals = new Map();
  for (const appointment of completedAppointments) {
    const amount = appointmentRevenue(appointment);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = appointment.dogId || `name:${lowerText(appointment.dogName)}|owner:${lowerText(appointment.ownerName)}`;
    const current = totals.get(key) || { appointment, total: 0, count: 0 };
    current.total += amount;
    current.count += 1;
    totals.set(key, current);
  }
  const first = [...totals.values()].sort((a, b) => b.total - a.total || String(a.appointment.dogName || "").localeCompare(String(b.appointment.dogName || ""), "it"))[0];
  if (!first) return null;
  const dog =
    state.dogs.find((item) => item.id === first.appointment.dogId) ||
    state.dogs.find(
      (item) =>
        lowerText(item.dogName) === lowerText(first.appointment.dogName) &&
        (!first.appointment.ownerName || lowerText(item.ownerName) === lowerText(first.appointment.ownerName))
    );
  return {
    dog,
    total: first.total,
    count: first.count,
    name: dog?.dogName || first.appointment.dogName || "Senza nome"
  };
}

function revenueByService(completedAppointments = []) {
  const totals = new Map();
  for (const appointment of completedAppointments) {
    for (const item of serviceRevenueItems(appointment)) {
      if (item.amount <= 0) continue;
      const service = item.service || "Servizio";
      const current = totals.get(service) || { label: service, total: 0, count: 0 };
      current.total += item.amount;
      current.count += 1;
      totals.set(service, current);
    }
  }
  return [...totals.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "it"));
}

function serviceRevenueItems(appointment) {
  if (Array.isArray(appointment?.serviceAmounts) && appointment.serviceAmounts.length) {
    return appointment.serviceAmounts
      .map((item) => ({
        service: String(item?.service || "").trim() || "Servizio",
        amount: Number(item?.amount || 0)
      }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0);
  }
  const amount = Number(appointment?.paidAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const services = normalizeServiceList(appointment.services?.length ? appointment.services : appointment.treatmentDone || appointment.service || "Servizio");
  const names = services.length ? services : ["Servizio"];
  const share = amount / names.length;
  return names.map((service) => ({ service, amount: share }));
}

function revenueTrendSeries(completedAppointments = [], range = "month") {
  const today = new Date();
  const selected = ["day", "week", "month", "year"].includes(range) ? range : "month";
  const year = today.getFullYear();
  let points = [];
  if (selected === "day") {
    const iso = toISODate(today);
    points = Array.from({ length: 24 }, (_, hour) => ({
      key: `${iso}T${String(hour).padStart(2, "0")}`,
      label: String(hour).padStart(2, "0"),
      total: 0
    }));
  } else if (selected === "week") {
    const start = startOfWeek(today);
    points = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      return { key: toISODate(date), label: new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit" }).format(date), total: 0 };
    });
  } else if (selected === "year") {
    points = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, index, 1);
      return { key: `${year}-${String(index + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date), total: 0 };
    });
  } else {
    const days = new Date(year, today.getMonth() + 1, 0).getDate();
    points = Array.from({ length: days }, (_, index) => {
      const date = new Date(year, today.getMonth(), index + 1);
      return { key: toISODate(date), label: String(index + 1), total: 0 };
    });
  }
  const lookup = new Map(points.map((point) => [point.key, point]));
  for (const appointment of completedAppointments) {
    const amount = appointmentRevenue(appointment);
    if (amount <= 0 || !appointment.date) continue;
    const key =
      selected === "year"
        ? String(appointment.date).slice(0, 7)
        : selected === "day"
          ? `${String(appointment.date).slice(0, 10)}T${String(appointment.startTime || "00").slice(0, 2).padStart(2, "0")}`
          : String(appointment.date).slice(0, 10);
    const point = lookup.get(key);
    if (point) point.total += amount;
  }
  const total = points.reduce((sum, point) => sum + point.total, 0);
  return { range: selected, points, total, max: Math.max(...points.map((point) => point.total), 0) };
}

function appointmentRevenue(appointment) {
  const serviceTotal = serviceAmountsTotal(appointment?.serviceAmounts || []);
  if (serviceTotal > 0) return Number(serviceTotal.toFixed(2));
  const amount = Number(appointment?.paidAmount || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function renderTopClientMetric(topClient) {
  if (!topClient) return `<strong>-</strong>`;
  const photo = topClient.dog?.photoUrl
    ? `<img src="${escapeAttr(topClient.dog.photoUrl)}" alt="Foto di ${escapeAttr(topClient.name)}" />`
    : `<span>${escapeHtml(initials(topClient.name))}</span>`;
  return `
    <div class="metric-client">
      <div class="metric-client-photo">${photo}</div>
      <div class="metric-client-copy">
        <strong>${escapeHtml(topClient.name)}</strong>
        <small>${escapeHtml(topClient.count === 1 ? "1 prestazione" : `${topClient.count} prestazioni`)}</small>
      </div>
    </div>
  `;
}

function renderRevenueBars(stats = []) {
  const rows = stats.slice(0, 8);
  if (!rows.length) return `<div class="empty-chart">Nessun incasso registrato.</div>`;
  const max = Math.max(...rows.map((item) => item.total), 0);
  return `
    <div class="revenue-bars">
      ${rows
        .map((item) => {
          const height = max ? Math.max(8, Math.round((item.total / max) * 100)) : 0;
          return `
            <div class="revenue-bar-item">
              <div class="revenue-bar-value">${escapeHtml(moneyLabel(item.total))}</div>
              <div class="revenue-bar-track" title="${escapeAttr(`${item.label}: ${moneyLabel(item.total)}`)}">
                <span style="height: ${escapeAttr(height)}%;"></span>
              </div>
              <strong>${escapeHtml(item.label)}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderRevenueLineChart(series) {
  const points = series?.points || [];
  if (!points.length || !series.total) return `<div class="empty-chart">Nessun incasso nel periodo.</div>`;
  const width = 640;
  const height = 230;
  const left = 34;
  const right = 22;
  const top = 24;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(series.max || 0, 1);
  const coordinates = points.map((point, index) => {
    const x = left + (points.length === 1 ? chartWidth / 2 : (chartWidth / (points.length - 1)) * index);
    const y = top + chartHeight - (point.total / max) * chartHeight;
    return { ...point, x, y };
  });
  const selectedKey = state.revenueSelectedPoint?.range === series.range ? state.revenueSelectedPoint.key : "";
  const selectedPoint = coordinates.find((point) => point.key === selectedKey) || coordinates.find((point) => point.total > 0) || coordinates[0];
  const polyline = coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return `
    <div class="revenue-line-card">
      <svg class="revenue-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento incassi ${escapeAttr(revenueRangeLabel(series.range).toLowerCase())}">
        <line class="revenue-axis" x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}"></line>
        <line class="revenue-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + chartHeight}"></line>
        <polyline class="revenue-line" points="${escapeAttr(polyline)}"></polyline>
        ${coordinates
          .map(
            (point, index) => {
              const isSelected = point.key === selectedPoint?.key;
              return `
              <g class="revenue-point ${isSelected ? "selected" : ""}" data-revenue-point="${escapeAttr(point.key)}" role="button" tabindex="0">
                <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${isSelected ? 7 : point.total > 0 ? 5 : 3}">
                  <title>${escapeHtml(`${revenuePointDetailLabel(series.range, point)}: ${moneyLabel(point.total)}`)}</title>
                </circle>
                ${shouldShowRevenueTick(series.range, index, points.length) ? `<text x="${point.x.toFixed(1)}" y="${height - 22}" text-anchor="middle">${escapeHtml(point.label)}</text>` : ""}
              </g>
            `;
            }
          )
          .join("")}
      </svg>
      <div class="revenue-point-detail">
        <span>${escapeHtml(revenuePointDetailLabel(series.range, selectedPoint))}</span>
        <strong>${escapeHtml(moneyLabel(selectedPoint?.total || 0))}</strong>
      </div>
      <div class="revenue-total"><span>Totale</span><strong>${escapeHtml(moneyLabel(series.total))}</strong></div>
    </div>
  `;
}

function shouldShowRevenueTick(range, index, total) {
  if (range === "day") return index % 3 === 0 || index === total - 1;
  if (range === "week" || range === "year") return true;
  if (index === 0 || index === total - 1) return true;
  return index % 5 === 4;
}

function revenuePointDetailLabel(range, point) {
  if (!point) return "Nessun punto";
  if ((range === "week" || range === "month") && point.key) return formatLongDate(point.key);
  if (range === "year" && point.key) return formatMonthYear(point.key);
  if (range === "day" && point.key) return `${formatLongDate(String(point.key).slice(0, 10))}, ore ${point.label}:00`;
  return {
    day: `Ore ${point.label}:00`,
    week: point.label,
    month: `Giorno ${point.label}`,
    year: point.label
  }[range] || point.label;
}

function revenueRangeLabel(range) {
  return {
    day: "Giorno",
    week: "Settimana",
    month: "Mese",
    year: "Anno"
  }[range] || "Mese";
}

function renderRevenueClientMetric(topClient) {
  if (!topClient) return `<strong>-</strong>`;
  const photo = topClient.dog?.photoUrl
    ? `<img src="${escapeAttr(topClient.dog.photoUrl)}" alt="Foto di ${escapeAttr(topClient.name)}" />`
    : `<span>${escapeHtml(initials(topClient.name))}</span>`;
  return `
    <div class="metric-client">
      <div class="metric-client-photo">${photo}</div>
      <div class="metric-client-copy">
        <strong>${escapeHtml(topClient.name)}</strong>
        <small>${escapeHtml(moneyLabel(topClient.total))}</small>
      </div>
    </div>
  `;
}

function renderStatList(title, stats) {
  const rows = (stats || []).slice(0, 6);
  return `
    <div class="stat-list">
      <h3>${escapeHtml(title)}</h3>
      ${
        rows.length
          ? rows
              .map((item, index) => {
                const count = Number(item.count || 0);
                return `
                  <div class="rank-row">
                    <span>${index + 1}</span>
                    <strong>${escapeHtml(item.label)}</strong>
                    <small>${escapeHtml(count)}</small>
                  </div>
                `;
              })
              .join("")
          : `<p class="muted">Nessun dato.</p>`
      }
    </div>
  `;
}

function renderPieChart(stats) {
  const rows = (stats || []).slice(0, 6);
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  if (!total) return `<div class="empty-chart">Nessun dato da mostrare.</div>`;
  const colors = ["#366a8a", "#2f7a65", "#cf6155", "#e1a63d", "#7a5ca8", "#79834d"];
  let cursor = 0;
  const gradient = rows
    .map((item, index) => {
      const start = cursor;
      cursor += (item.count / total) * 360;
      return `${colors[index % colors.length]} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
    })
    .join(", ");
  return `
    <div class="pie-layout">
      <div class="pie-chart" style="background: conic-gradient(${escapeAttr(gradient)});"></div>
      <div class="pie-legend">
        ${rows
          .map(
            (item, index) => `
              <div>
                <span style="background:${colors[index % colors.length]}"></span>
                <strong>${escapeHtml(item.label)}</strong>
                <small>${escapeHtml(item.count)}</small>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderAppointmentGallery(appointment) {
  const before = Array.isArray(appointment.beforePhotos) ? appointment.beforePhotos : [];
  const after = Array.isArray(appointment.afterPhotos) ? appointment.afterPhotos : [];
  if (!before.length && !after.length) return "";
  const group = (label, photos) =>
    photos.length
      ? `<div class="appointment-gallery-group"><span>${escapeHtml(label)}</span>${photos
          .slice(0, 5)
          .map(
            (src, index) => `
              <button class="gallery-thumb" type="button" data-photo-zoom data-photo-src="${escapeAttr(src)}" data-photo-title="${escapeAttr(`${label} - ${formatShortDate(appointment.date)} #${index + 1}`)}" aria-label="Ingrandisci foto ${escapeAttr(label.toLowerCase())}">
                <img src="${escapeAttr(src)}" alt="" />
              </button>
            `
          )
          .join("")}</div>`
      : "";
  return `<div class="appointment-gallery">${group("Prima", before)}${group("Dopo", after)}</div>`;
}

async function filesToDataUrls(fileList, limit = 5) {
  const files = Array.from(fileList || []);
  if (files.length > limit) throw new Error(`Massimo ${limit} foto per tipo`);
  const dataUrls = [];
  for (const file of files) {
    dataUrls.push(await imageFileToDataUrl(file, { maxSize: 1100, quality: 0.72 }));
  }
  return dataUrls;
}

async function imageFileToDataUrl(file, options = {}) {
  if (!file) return "";
  if (!String(file.type || "").startsWith("image/")) throw new Error("Seleziona solo immagini");
  const maxOriginalBytes = options.maxOriginalBytes || 12 * 1024 * 1024;
  if (file.size > maxOriginalBytes) throw new Error("File immagine troppo grande: massimo 12 MB");
  const source = await fileToDataUrl(file);
  if (typeof Image === "undefined" || typeof document.createElement !== "function") return source;
  const image = await loadImage(source);
  const maxSize = options.maxSize || 1200;
  const scale = Math.min(1, maxSize / image.width, maxSize / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  let quality = options.quality || 0.78;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrlByteSize(dataUrl) > 4 * 1024 * 1024 && quality > 0.42) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrlByteSize(dataUrl) > 4 * 1024 * 1024) {
    throw new Error("Immagine troppo grande anche dopo la riduzione");
  }
  return dataUrl;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Immagine non leggibile"));
    image.src = src;
  });
}

function dataUrlByteSize(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

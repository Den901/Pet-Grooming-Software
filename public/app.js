const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const toast = document.getElementById("toast");

const state = {
  me: null,
  dogs: [],
  appointments: [],
  users: [],
  duckdns: null,
  branding: null,
  whatsapp: null,
  animalSettings: null,
  navigation: null,
  version: null,
  initialAccessHint: false,
  updateCheck: null,
  updateCheckLoading: false,
  eventSource: null,
  liveRefreshTimer: null,
  dashboardFocus: "breeds",
  deferredInstallPrompt: null,
  pwaPromptHidden: false,
  view: new URLSearchParams(window.location.search).get("view") || "calendar",
  calendarDate: new Date(),
  calendarMode: "month",
  dogSearch: ""
};

const weekdayShort = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const formatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "short" });
const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const CUSTOM_OPTION_VALUE = "__add_new__";
const SIDEBAR_DEFINITIONS = {
  calendar: { id: "calendar", label: "Calendario", symbol: "CA" },
  dashboard: { id: "dashboard", label: "Dashboard", symbol: "DA" },
  dogs: { id: "dogs", label: "Schede", symbol: "SC" },
  users: { id: "users", label: "Utenti", symbol: "UT", adminOnly: true }
};
const DEFAULT_SIDEBAR_ORDER = ["calendar", "dashboard", "dogs", "users"];
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

boot();

async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

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
    promptDefaultPasswordChange();
  } catch {
    renderLogin();
    renderPwaInstallPrompt();
  }
}

async function loadPublicSettings() {
  try {
    const response = await api("/api/public-settings");
    state.branding = response.branding || state.branding;
    state.navigation = response.navigation || state.navigation;
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
    portalName: "Toelettatura Manager",
    businessName: "Toelettatura",
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
    },
    ...(state.branding || {}),
    theme: ["light", "dark", "custom"].includes(state.branding?.theme) ? state.branding.theme : "light",
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

function applyBranding() {
  const branding = getBranding();
  const colors = branding.colors;
  const theme = branding.theme === "dark" || (branding.theme === "custom" && isDarkHex(colors.background)) ? "dark" : "light";
  const loginBackground = loginBackgroundCss(branding.loginBackground, colors);
  document.documentElement.dataset.theme = theme;
  document.title = branding.portalName || "Toelettatura Manager";
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
    "--login-background": loginBackground.background,
    "--login-background-size": loginBackground.size,
    "--login-background-position": loginBackground.position
  };
  for (const [key, value] of Object.entries(variables)) {
    if (key.startsWith("--login-") || key === "--shadow" || /^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty(key, value);
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
  const [meResponse, dogsResponse, appointmentsResponse, animalResponse, navigationResponse] = await Promise.all([
    api("/api/me"),
    api("/api/dogs"),
    api("/api/appointments"),
    api("/api/settings/animal"),
    api("/api/settings/navigation")
  ]);
  state.me = meResponse.user || state.me;
  state.dogs = dogsResponse.dogs || [];
  state.appointments = appointmentsResponse.appointments || [];
  state.animalSettings = animalResponse.animal || state.animalSettings;
  state.navigation = navigationResponse.navigation || state.navigation;
  if (state.me?.role === "admin") {
    const [usersResponse, duckdnsResponse, brandingResponse, whatsappResponse, versionResponse] = await Promise.all([
      api("/api/users"),
      api("/api/settings/duckdns"),
      api("/api/settings/branding"),
      api("/api/settings/whatsapp"),
      api("/api/version")
    ]);
    state.users = usersResponse.users || [];
    state.duckdns = duckdnsResponse.duckdns || null;
    state.branding = brandingResponse.branding || state.branding;
    state.whatsapp = whatsappResponse.whatsapp || null;
    state.version = versionResponse || null;
    applyBranding();
  } else {
    state.users = [];
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
    if (!payload.type || payload.type === "connected") return;
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

function renderLogin(error = "") {
  const branding = getBranding();
  const initialAccessHint = state.initialAccessHint;
  app.className = "login-screen";
  app.innerHTML = `
    <section class="login-panel">
      ${renderBrandMark("brand-mark")}
      <h1>${escapeHtml(branding.portalName)}</h1>
      <p>${escapeHtml(branding.businessName)}${branding.tagline ? ` - ${escapeHtml(branding.tagline)}` : ""}</p>
      ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ""}
      <form class="login-form" id="loginForm">
        <label>Username
          <input name="username" autocomplete="username" required />
        </label>
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
      connectLiveUpdates();
      notify("Accesso effettuato");
      promptDefaultPasswordChange();
    } catch (err) {
      renderLogin(err.message);
    }
  });
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
                  <span class="nav-symbol">${item.symbol}</span>
                  <span>${item.label}</span>
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
                  <span class="nav-symbol gear" aria-hidden="true">&#9881;</span>
                  <span>Impostazioni</span>
                </button>`
              : ""
          }
          <button class="btn ghost" type="button" id="logoutBtn">Esci</button>
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
  state.duckdns = null;
  state.whatsapp = null;
  state.animalSettings = null;
  state.navigation = null;
  state.version = null;
  state.updateCheck = null;
  state.updateCheckLoading = false;
  state.eventSource?.close();
  state.eventSource = null;
  renderLogin();
  renderPwaInstallPrompt();
}

function renderView() {
  const main = document.getElementById("mainContent");
  if (state.view === "calendar") main.innerHTML = renderCalendar();
  if (state.view === "dashboard") main.innerHTML = renderDashboard();
  if (state.view === "dogs") main.innerHTML = renderDogs();
  if (state.view === "users") main.innerHTML = renderUsers();
  if (state.view === "settings") main.innerHTML = renderSettings();

  if (state.view === "calendar") bindCalendar();
  if (state.view === "dashboard") bindDashboard();
  if (state.view === "dogs") bindDogs();
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
    <div class="topbar">
      <div class="page-title">
        <h1>Calendario</h1>
        <p>${state.calendarMode === "month" ? capitalize(monthFormatter.format(state.calendarDate)) : weekTitle(state.calendarDate)}</p>
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
        <button type="button" data-calendar-mode="month" class="${state.calendarMode === "month" ? "active" : ""}">Mese</button>
        <button type="button" data-calendar-mode="week" class="${state.calendarMode === "week" ? "active" : ""}">Settimana</button>
      </div>
    </div>
    ${state.calendarMode === "month" ? renderMonthCalendar() : renderWeekCalendar()}
  `;
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
          <span class="day-number">${cursor.getDate()}</span>
          <button class="add-day" type="button" title="Aggiungi appuntamento" data-day-add="${iso}">+</button>
        </div>
        <div class="appointment-list">
          ${dayAppointments.map(renderAppointmentPill).join("")}
        </div>
      </div>
    `);
    cursor = addDays(cursor, 1);
  }
  return `
    <section class="calendar calendar-desktop">
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
                <h3>${capitalize(formatter.format(day))}</h3>
                <button class="add-day" type="button" title="Aggiungi appuntamento" data-day-add="${iso}">+</button>
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

function renderMobileCalendarList() {
  const days =
    state.calendarMode === "month"
      ? Array.from(
          { length: new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 0).getDate() },
          (_, index) => new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), index + 1)
        )
      : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(state.calendarDate), index));
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
  return `
    <article class="mobile-agenda-day ${iso === todayISO() ? "today" : ""}">
      <div class="mobile-day-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${dayAppointments.length ? `${dayAppointments.length} appuntamenti` : "Libero"}</span>
        </div>
        <button class="add-day" type="button" title="Aggiungi appuntamento" data-day-add="${iso}">+</button>
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
    state.calendarDate =
      state.calendarMode === "month"
        ? new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1)
        : addDays(state.calendarDate, -7);
    renderView();
  });
  document.getElementById("nextPeriod").addEventListener("click", () => {
    state.calendarDate =
      state.calendarMode === "month"
        ? new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1)
        : addDays(state.calendarDate, 7);
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
  document.querySelectorAll("[data-day-add]").forEach((button) => {
    button.addEventListener("click", () => openAppointmentDialog({ date: button.dataset.dayAdd }));
  });
  document.querySelectorAll("[data-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointment = state.appointments.find((item) => item.id === button.dataset.appointmentId);
      openAppointmentDialog(appointment);
    });
  });
  document.querySelectorAll("[data-complete-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const appointment = state.appointments.find((item) => item.id === button.dataset.completeAppointmentId);
      if (!appointment) return;
      openAppointmentDialog(appointment, { completionMode: true });
    });
  });
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
  const avgMinutes = average(state.dogs.map((dog) => Number(dog.estimatedMinutes || 0)).filter(Boolean));
  const focus = state.dashboardFocus === "services" ? serviceStats : breedStats;
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Dashboard</h1>
        <p>Statistiche operative su appuntamenti, razze, servizi e tempi.</p>
      </div>
      <div class="segmented" role="group" aria-label="Grafico dashboard">
        <button type="button" data-dashboard-focus="breeds" class="${state.dashboardFocus !== "services" ? "active" : ""}">Razze</button>
        <button type="button" data-dashboard-focus="services" class="${state.dashboardFocus === "services" ? "active" : ""}">Servizi</button>
      </div>
    </div>
    <section class="metric-grid" aria-label="Riepilogo dashboard">
      <div class="metric"><span>Da fare</span><strong>${planned.length}</strong></div>
      <div class="metric"><span>Fatti</span><strong>${completed.length}</strong></div>
      <div class="metric"><span>Cliente piu presente</span><strong>${escapeHtml(topStatLabel(dogStats))}</strong></div>
      <div class="metric"><span>Tempo medio scheda</span><strong>${escapeHtml(durationLabel(avgMinutes))}</strong></div>
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <h2>${state.dashboardFocus === "services" ? "Servizi piu richiesti" : "Razze piu trattate"}</h2>
        ${renderPieChart(focus)}
      </div>
      <div class="panel">
        <h2>Classifiche</h2>
        <div class="stat-lists">
          ${renderStatList("Razze", breedStats)}
          ${renderStatList("Servizi", serviceStats)}
          ${renderStatList("Animali", dogStats)}
        </div>
      </div>
    </section>
  `;
}

function bindDashboard() {
  document.querySelectorAll("[data-dashboard-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dashboardFocus = button.dataset.dashboardFocus;
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
      <button class="btn" type="button" id="newDogBtn">Nuova scheda</button>
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
      <div class="dog-thumb">${photo}${topDog ? `<span class="top-paw" aria-label="Cliente top">&#128062;</span>` : ""}</div>
      <div class="dog-tile-main">
        <h3>${escapeHtml(dog.dogName || "Senza nome")}</h3>
      </div>
    </button>
  `;
}

function bindDogs() {
  document.getElementById("newDogBtn").addEventListener("click", () => openDogDialog());
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
            <p class="settings-note">Personalizza nome, logo, informazioni aziendali e colori del portale.</p>
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
    `;
  }
  return `
    <span class="update-label">Update web</span>
    <strong>Portale aggiornato</strong>
    <small>Versione online: ${escapeHtml(updateCheck.latestReleaseLabel || updateCheck.latestVersion || "-")}.</small>
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
          <span class="nav-symbol">${escapeHtml(item.symbol)}</span>
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
      notify("Identita azienda salvata");
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
    if (state.view === "settings") renderView();
  }
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
        <div class="dog-detail-photo ${topDog ? "top-client" : ""}">${photo}${topDog ? `<span class="top-paw detail" aria-label="Cliente top">&#128062;</span>` : ""}</div>
        <div class="dog-detail-body">
          <div class="dog-detail-heading">
            <strong>${escapeHtml(dog.dogName || "Scheda cane")}</strong>
            ${topDog ? `<span class="top-badge"><span aria-hidden="true">&#128062;</span> Cliente top</span>` : ""}
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
    <button class="history-item status-${escapeHtml(appointment.status)}" type="button" data-history-appointment="${appointment.id}" aria-label="Modifica appuntamento del ${escapeAttr(formatShortDate(appointment.date))}">
      <div class="history-main">
        <strong>${escapeHtml(formatShortDate(appointment.date))}</strong>
        <span>${escapeHtml(appointment.startTime || "--:--")} ${appointment.endTime ? `- ${escapeHtml(appointment.endTime)}` : ""}</span>
      </div>
      <div class="history-treatment">
        <span>${escapeHtml(statusLabel(appointment.status))}</span>
        <strong>${escapeHtml(treatment)}</strong>
      </div>
      <div class="history-amount">${escapeHtml(moneyLabel(appointment.paidAmount))}</div>
      <span class="history-edit" aria-hidden="true">&#9998;</span>
      ${gallery}
    </button>
  `;
}

function renderBreedField(dog, animal) {
  const breeds = uniqueValues([...(animal.breeds || []), dog.breed].filter(Boolean));
  const current = String(dog.breed || "").trim();
  const matched = breeds.find((breed) => breed.toLowerCase() === current.toLowerCase());
  const customSelected = Boolean(current && !matched);
  return `
    <label>Razza
      <select name="breedChoice" data-choice-select data-choice-custom="breedCustom">
        <option value="">Seleziona razza</option>
        ${breeds
          .map((breed) => `<option value="${escapeAttr(breed)}" ${matched === breed ? "selected" : ""}>${escapeHtml(breed)}</option>`)
          .join("")}
        <option value="${CUSTOM_OPTION_VALUE}" ${customSelected ? "selected" : ""}>+ Aggiungi razza</option>
      </select>
    </label>
    <label class="choice-custom" data-choice-custom-row="breedCustom" ${customSelected ? "" : "hidden"}>Nuova razza
      <input name="breedCustom" value="${customSelected ? escapeAttr(current) : ""}" placeholder="Scrivi nuova razza" ${customSelected ? "" : "disabled"} />
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
          ${serviceOptions.map((service) => `<option value="${escapeAttr(service)}">${escapeHtml(service)}</option>`).join("")}
          <option value="${CUSTOM_OPTION_VALUE}">+ Aggiungi prestazione</option>
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
  form.querySelectorAll("[data-choice-select]").forEach((select) => {
    const customName = select.dataset.choiceCustom;
    const row = form.querySelector(`[data-choice-custom-row="${customName}"]`);
    const input = row?.querySelector("input");
    const sync = () => {
      const custom = select.value === CUSTOM_OPTION_VALUE;
      if (row) row.hidden = !custom;
      if (input) {
        input.disabled = !custom;
        input.required = custom && select.required;
        if (!custom) input.value = "";
      }
    };
    select.addEventListener("change", sync);
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

function updateServicePickerEmpty(picker) {
  const selected = picker.querySelector("[data-service-selected]");
  const hasServices = selected.querySelector('input[name="services"]');
  selected.querySelector("[data-empty-services]")?.remove();
  if (!hasServices) {
    selected.insertAdjacentHTML("beforeend", `<span class="muted" data-empty-services>Nessuna prestazione selezionata</span>`);
  }
}

function selectedChoiceValue(formData, name) {
  const choice = String(formData.get(`${name}Choice`) || "").trim();
  if (choice === CUSTOM_OPTION_VALUE) return String(formData.get(`${name}Custom`) || "").trim();
  return choice;
}

function openDogDialog(dog = {}) {
  const isEdit = Boolean(dog.id);
  const animal = getAnimalSettings();
  const dogServices = dog.services || [];
  openModal({
    title: isEdit ? "Modifica scheda" : "Nuova scheda",
    submitLabel: isEdit ? "Salva scheda" : "Crea scheda",
    content: `
      <div class="form-grid">
        <label>Nome cane
          <input name="dogName" value="${escapeAttr(dog.dogName || "")}" required />
        </label>
        <label>Tempo stimato
          <input name="estimatedTime" type="time" step="300" value="${escapeAttr(minutesToTimeInput(dog.estimatedMinutes))}" />
        </label>
        ${renderBreedField(dog, animal)}
        <label>Anno nascita
          <input name="birthYear" type="number" min="1980" max="${new Date().getFullYear()}" value="${escapeAttr(dog.birthYear || "")}" />
        </label>
        <label>Colore cane
          <input name="color" value="${escapeAttr(dog.color || "")}" required />
        </label>
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
      const payload = {
        dogName: formData.get("dogName"),
        ownerName: formData.get("ownerName"),
        contact: formData.get("contact"),
        contactMissing: formData.get("contactMissing") === "on",
        alternateContact: formData.get("alternateContact"),
        breed,
        birthYear: formData.get("birthYear"),
        color: formData.get("color"),
        sex: formData.get("sex"),
        imageConsent: formData.get("imageConsent"),
        pathologies: formData.get("pathologies"),
        estimatedMinutes: timeInputToMinutes(formData.get("estimatedTime")),
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
  const selectedServices = normalizeServiceList(
    appointment.services?.length ? appointment.services : appointment.service || selectedDog?.services || ["Toelettatura"]
  );
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
                <label>Colore cane
                  <input name="color" data-quick-required />
                </label>
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
          <legend>Prestazioni previste</legend>
          ${renderServicePicker(selectedServices, serviceOptions)}
        </fieldset>
        <label data-completion-field>Importo pagato
          <input name="paidAmount" type="number" min="0" step="0.01" value="${escapeAttr(appointment.paidAmount || "")}" inputmode="decimal" />
        </label>
        <label class="full" data-completion-field>Servizio eseguito
          <input name="treatmentDone" value="${escapeAttr(appointment.treatmentDone || "")}" placeholder="Es. bagno, taglio, snodatura, stripping" />
        </label>
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
      bindServicePickers(form);
      if (completionMode && !form.elements.treatmentDone.value) {
        form.elements.treatmentDone.value = selectedServiceLabelsFromForm(form) || "Toelettatura";
      }
      const createDogRows = form.querySelectorAll("[data-create-dog-row]");
      const completionFields = form.querySelectorAll("[data-completion-field]");
      const syncCompletionFields = () => {
        const isCompleted = form.elements.status.value === "completato";
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
        if (!form.elements.treatmentDone.value) form.elements.treatmentDone.value = selectedServiceLabelsFromForm(form) || "Toelettatura";
        form.elements.treatmentDone.focus();
        notify("Completa servizio e importo, poi salva la prestazione");
      });
      form.elements.status.addEventListener("change", syncCompletionFields);
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
      });
      syncCreateDogRow();
      syncCompletionFields();
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
      payload.createDogProfile = formData.get("createDogProfile") === "on";
      if (completionMode) payload.status = "completato";
      if (payload.status === "completato" && !payload.treatmentDone) payload.treatmentDone = payload.service || "Toelettatura";
      if (payload.status !== "completato") {
        payload.treatmentDone = "";
        payload.paidAmount = "";
      } else {
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
          ${preventClose ? "" : `<button class="modal-close" type="button" data-close aria-label="Chiudi">x</button>`}
        </div>
        <div class="modal-body">${content}</div>
        ${
          hideActions
            ? ""
            : `<div class="modal-actions">
                ${dangerLabel ? `<button class="btn danger" type="button" data-danger>${escapeHtml(dangerLabel)}</button>` : ""}
                ${extraActions}
                ${preventClose ? "" : `<button class="btn secondary" type="button" data-close>Annulla</button>`}
                <button class="btn" type="submit">${escapeHtml(submitLabel)}</button>
              </div>`
        }
      </form>
    </div>
  `;
  const form = modalRoot.querySelector("form");
  modalRoot.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModal));
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", (event) => {
    if (!preventClose && event.target.classList.contains("modal-backdrop")) closeModal();
  });
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

function minutesToTimeInput(minutes) {
  const total = Math.max(0, Math.min(Number(minutes || 0), 23 * 60 + 55));
  if (!total) return "";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function timeInputToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, hours * 60 + minutes);
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

function renderStatList(title, stats) {
  const rows = (stats || []).slice(0, 6);
  return `
    <div class="stat-list">
      <h3>${escapeHtml(title)}</h3>
      ${
        rows.length
          ? rows.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.count)}</strong></div>`).join("")
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
          .map((src) => `<img src="${escapeAttr(src)}" alt="" />`)
          .join("")}</div>`
      : "";
  return `<div class="appointment-gallery">${group("Prima", before)}${group("Dopo", after)}</div>`;
}

function selectedServiceLabelsFromForm(form) {
  const formData = new FormData(form);
  return collectServicesFromForm(formData, form).join(", ");
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

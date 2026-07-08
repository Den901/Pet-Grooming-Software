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
  view: new URLSearchParams(window.location.search).get("view") || "calendar",
  calendarDate: new Date(),
  calendarMode: "month",
  dogSearch: ""
};

const weekdayShort = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const formatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "short" });
const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
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
      return;
    }
    await loadData();
    renderShell();
    promptDefaultPasswordChange();
  } catch {
    renderLogin();
  }
}

async function loadPublicSettings() {
  try {
    const response = await api("/api/public-settings");
    state.branding = response.branding || state.branding;
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
    portalName: "Toilettatura Manager",
    businessName: "Toilettatura",
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

function applyBranding() {
  const branding = getBranding();
  const colors = branding.colors;
  const theme = branding.theme === "dark" || (branding.theme === "custom" && isDarkHex(colors.background)) ? "dark" : "light";
  const loginBackground = loginBackgroundCss(branding.loginBackground, colors);
  document.documentElement.dataset.theme = theme;
  document.title = branding.portalName || "Toilettatura Manager";
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
  const [dogsResponse, appointmentsResponse] = await Promise.all([api("/api/dogs"), api("/api/appointments")]);
  state.dogs = dogsResponse.dogs || [];
  state.appointments = appointmentsResponse.appointments || [];
  if (state.me?.role === "admin") {
    const [usersResponse, duckdnsResponse, brandingResponse, whatsappResponse] = await Promise.all([
      api("/api/users"),
      api("/api/settings/duckdns"),
      api("/api/settings/branding"),
      api("/api/settings/whatsapp")
    ]);
    state.users = usersResponse.users || [];
    state.duckdns = duckdnsResponse.duckdns || null;
    state.branding = brandingResponse.branding || state.branding;
    state.whatsapp = whatsappResponse.whatsapp || null;
    applyBranding();
  } else {
    state.users = [];
    state.duckdns = null;
    state.whatsapp = null;
  }
}

function renderLogin(error = "") {
  const branding = getBranding();
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
      <div class="hint-box">
        Accesso iniziale admin: <strong>admin</strong> / <strong>admin123</strong><br />
        Operatore demo: <strong>operatore</strong> / <strong>operatore123</strong>
      </div>
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
      await loadData();
      renderShell();
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
            <strong>${escapeHtml(state.me.displayName || state.me.username)}</strong>
            <span>${state.me.role === "admin" ? "Amministratore" : "Operatore"}</span>
          </div>
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
}

function navItems() {
  const items = [
    { id: "calendar", label: "Calendario", symbol: "CA" },
    { id: "dogs", label: "Schede", symbol: "SC" }
  ];
  if (state.me?.role === "admin") {
    items.push({ id: "users", label: "Utenti", symbol: "UT" });
    items.push({ id: "settings", label: "Impostazioni", symbol: "IM" });
  }
  return items;
}

function canAccessView(view) {
  return navItems().some((item) => item.id === view);
}

async function logout() {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  state.me = null;
  state.dogs = [];
  state.appointments = [];
  state.users = [];
  state.duckdns = null;
  state.whatsapp = null;
  renderLogin();
}

function renderView() {
  const main = document.getElementById("mainContent");
  if (state.view === "calendar") main.innerHTML = renderCalendar();
  if (state.view === "dogs") main.innerHTML = renderDogs();
  if (state.view === "users") main.innerHTML = renderUsers();
  if (state.view === "settings") main.innerHTML = renderSettings();

  if (state.view === "calendar") bindCalendar();
  if (state.view === "dogs") bindDogs();
  if (state.view === "users") bindUsers();
  if (state.view === "settings") bindSettings();
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
    <section class="calendar">
      <div class="calendar-weekdays">${weekdayShort.map((day) => `<div>${day}</div>`).join("")}</div>
      <div class="calendar-grid">${cells.join("")}</div>
    </section>
  `;
}

function renderWeekCalendar() {
  const start = startOfWeek(state.calendarDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return `
    <section class="week-grid">
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
  const photo = dog.photoUrl
    ? `<img src="${escapeAttr(dog.photoUrl)}" alt="Foto di ${escapeAttr(dog.dogName)}" />`
    : `<span>${escapeHtml(initials(dog.dogName))}</span>`;
  return `
    <button class="dog-tile" type="button" data-dog-open="${dog.id}" aria-label="Apri scheda di ${escapeAttr(dog.dogName || "cane")}">
      <div class="dog-thumb">${photo}</div>
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
              <div>
                <strong>${escapeHtml(user.displayName || user.username)}</strong><br />
                <span class="muted">${escapeHtml(user.username)}</span>
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
  const localUrls = duckdns.localUrls || [];
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
    </section>
  `;
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
      link.download = response.fileName || "toilettatura-backup.json";
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
  const photo = dog.photoUrl
    ? `<img src="${escapeAttr(dog.photoUrl)}" alt="Foto di ${escapeAttr(dog.dogName)}" />`
    : `<span>${escapeHtml(initials(dog.dogName))}</span>`;
  openModal({
    title: dog.dogName || "Scheda cane",
    hideActions: true,
    headerAction: `<button class="icon-btn" type="button" data-header-action aria-label="Modifica scheda" title="Modifica scheda">&#9998;</button>`,
    content: `
      <section class="dog-detail">
        <div class="dog-detail-photo">${photo}</div>
        <div class="dog-detail-body">
          <div class="detail-list">
            <div class="detail-item">
              <span>Proprietario</span>
              <strong>${escapeHtml(dog.ownerName || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Contatto</span>
              <strong>${escapeHtml(dog.contact || "-")}</strong>
            </div>
            <div class="detail-item">
              <span>Tempo stimato</span>
              <strong>${escapeHtml(durationLabel(dog.estimatedMinutes))}</strong>
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
          service: "Toilettatura",
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
    </button>
  `;
}

function openDogDialog(dog = {}) {
  const isEdit = Boolean(dog.id);
  openModal({
    title: isEdit ? "Modifica scheda" : "Nuova scheda",
    submitLabel: isEdit ? "Salva scheda" : "Crea scheda",
    content: `
      <div class="form-grid">
        <label>Nome cane
          <input name="dogName" value="${escapeAttr(dog.dogName || "")}" required />
        </label>
        <label>Tempo stimato in minuti
          <input name="estimatedMinutes" type="number" min="0" step="5" value="${escapeAttr(dog.estimatedMinutes || "")}" />
        </label>
        <label>Nome proprietario
          <input name="ownerName" value="${escapeAttr(dog.ownerName || "")}" />
        </label>
        <label>Numero contatto
          <input name="contact" value="${escapeAttr(dog.contact || "")}" inputmode="tel" />
        </label>
        <label class="full">Patologie animale
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
      const fileInput = form.elements.photo;
      const preview = document.getElementById("photoPreview");
      if (!dog.photoUrl) preview.style.display = "none";
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        preview.src = await fileToDataUrl(file);
        preview.style.display = "block";
      });
    },
    onSubmit: async (formData, form) => {
      const photo = form.elements.photo.files[0];
      const payload = {
        dogName: formData.get("dogName"),
        ownerName: formData.get("ownerName"),
        contact: formData.get("contact"),
        pathologies: formData.get("pathologies"),
        estimatedMinutes: formData.get("estimatedMinutes"),
        notes: formData.get("notes")
      };
      if (photo) payload.photoData = await fileToDataUrl(photo);
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
        <label>Nome cane
          <input name="dogName" value="${escapeAttr(selectedDog?.dogName || appointment.dogName || "")}" required />
        </label>
        <label>Proprietario
          <input name="ownerName" value="${escapeAttr(selectedDog?.ownerName || appointment.ownerName || "")}" />
        </label>
        <label>Contatto
          <input name="contact" value="${escapeAttr(selectedDog?.contact || appointment.contact || "")}" inputmode="tel" />
        </label>
        <label>Trattamento previsto
          <input name="service" value="${escapeAttr(appointment.service || "Toilettatura")}" />
        </label>
        <label>Importo pagato
          <input name="paidAmount" type="number" min="0" step="0.01" value="${escapeAttr(appointment.paidAmount || "")}" inputmode="decimal" />
        </label>
        <label class="full">Trattamento eseguito
          <input name="treatmentDone" value="${escapeAttr(appointment.treatmentDone || "")}" placeholder="Es. bagno, taglio, snodatura, stripping" />
        </label>
        <label class="full">Note appuntamento
          <textarea name="notes">${escapeHtml(appointment.notes || "")}</textarea>
        </label>
      </div>
    `,
    onOpen: (form) => {
      if (completionMode && !form.elements.treatmentDone.value) {
        form.elements.treatmentDone.value = form.elements.service.value || "Toilettatura";
      }
      modalRoot.querySelector("[data-complete-form]")?.addEventListener("click", () => {
        form.elements.status.value = "completato";
        if (!form.elements.treatmentDone.value) form.elements.treatmentDone.value = form.elements.service.value || "Toilettatura";
        form.elements.treatmentDone.focus();
        notify("Completa trattamento e importo, poi salva la prestazione");
      });
      form.elements.dogId.addEventListener("change", () => {
        const dog = state.dogs.find((item) => item.id === form.elements.dogId.value);
        if (!dog) return;
        form.elements.dogName.value = dog.dogName || "";
        form.elements.ownerName.value = dog.ownerName || "";
        form.elements.contact.value = dog.contact || "";
      });
    },
    onDanger: async () => {
      await api(`/api/appointments/${appointment.id}`, { method: "DELETE", body: "{}" });
      await loadData();
      renderView();
      notify("Appuntamento eliminato");
    },
    onSubmit: async (formData) => {
      const payload = Object.fromEntries(formData.entries());
      if (completionMode) payload.status = "completato";
      if (payload.status === "completato" && !payload.treatmentDone) payload.treatmentDone = payload.service || "Toilettatura";
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
        <label class="checkbox-line full">
          <input name="active" type="checkbox" ${user.active !== false ? "checked" : ""} />
          Utente attivo
        </label>
      </div>
    `,
    onSubmit: async (formData) => {
      const payload = {
        displayName: formData.get("displayName"),
        username: formData.get("username"),
        role: formData.get("role"),
        password: formData.get("password"),
        active: formData.get("active") === "on"
      };
      await api(isEdit ? `/api/users/${user.id}` : "/api/users", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      await loadData();
      renderView();
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
    [dog.dogName, dog.ownerName, dog.contact, dog.pathologies, dog.notes].some((field) => String(field || "").toLowerCase().includes(query))
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

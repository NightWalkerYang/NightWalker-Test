import { findSidebar, findTopbarSearch } from "../framework/dom-compat.js";
import {
  LUFENG_ROUTE,
  LUFENG_SESSION_KEY,
  isLufengPublicPath,
  normalizeLufengRouteUrl,
} from "./context.js";

const STYLE_ATTR = "data-oc-lufeng-style";
const SIDEBAR_FOOTER_SELECTOR = ".sidebar-shell__footer";
const LUFENG_MODEL_VALUE = "openai/gpt-5.4";
const LUFENG_MODEL_LABEL = "GPT-5.4 · openai";
const CHAT_SESSION_SELECTORS = [
  ".chat-controls__session:not(.chat-controls__model)",
  ".chat-mobile-controls-wrapper .chat-controls__session",
];
const CHAT_MODEL_SELECT_SELECTOR = 'select[data-chat-model-select="true"]';
const LUFENG_PINNED_MODEL_ID = "gpt-5.4";
const LUFENG_PINNED_MODEL_PROVIDER = "openai";
const LUFENG_PINNED_MODEL_ENTRY = {
  id: LUFENG_PINNED_MODEL_ID,
  name: "GPT-5.4",
  provider: LUFENG_PINNED_MODEL_PROVIDER,
};
const LUFENG_STALE_STARTUP_ERROR_PATTERN =
  /does not have a valid coding plan subscription|subscription has expired/i;

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./surface.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function normalizeLufengLocation() {
  const normalized = normalizeLufengRouteUrl(window.location.href, window.location.href);
  if (
    normalized.pathname !== window.location.pathname ||
    normalized.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalized.toString());
  }
}

function isChatSidebarItem(item) {
  if (!(item instanceof HTMLAnchorElement || item instanceof HTMLElement)) {
    return false;
  }

  const href = item.getAttribute("href");
  if (href) {
    try {
      const resolved = new URL(href, document.baseURI);
      if (resolved.pathname.endsWith("/chat") || resolved.pathname === LUFENG_ROUTE) {
        return true;
      }
    } catch {
      // Fall through to text matching.
    }
  }

  return (item.textContent || "").includes("聊天");
}

function syncSidebar(navRoot) {
  if (!(navRoot instanceof HTMLElement)) {
    return;
  }

  const sections = [...navRoot.querySelectorAll(":scope > .nav-section")];
  if (sections.length === 0) {
    return;
  }

  const chatSection =
    sections.find((section) =>
      [...section.querySelectorAll(".nav-item")].some((item) => isChatSidebarItem(item)),
    ) ?? sections[0];

  for (const section of sections) {
    section.setAttribute("data-oc-lufeng-nav", section === chatSection ? "chat" : "hidden");
  }

  chatSection.classList.remove("nav-section--collapsed");
  const label = chatSection.querySelector(".nav-section__label");
  if (label instanceof HTMLElement) {
    label.setAttribute("aria-expanded", "true");
  }
}

function clearSidebarSync(navRoot) {
  if (!(navRoot instanceof HTMLElement)) {
    return;
  }

  for (const section of navRoot.querySelectorAll(":scope > .nav-section")) {
    section.removeAttribute("data-oc-lufeng-nav");
  }
}

function clearFooterSync(footer) {
  if (footer instanceof HTMLElement) {
    footer.removeAttribute("data-oc-lufeng-footer");
  }
}

function syncTopbarSearch() {
  const search = findTopbarSearch(document);
  if (search instanceof HTMLElement) {
    search.setAttribute("data-oc-lufeng-search", "hidden");
  }
}

function clearTopbarSearch() {
  const search = findTopbarSearch(document);
  if (search instanceof HTMLElement) {
    search.removeAttribute("data-oc-lufeng-search");
  }
}

function syncSessionControls() {
  for (const selector of CHAT_SESSION_SELECTORS) {
    for (const section of document.querySelectorAll(selector)) {
      if (section instanceof HTMLElement) {
        section.setAttribute("data-oc-lufeng-session", "hidden");
      }
    }
  }
}

function clearSessionControls() {
  for (const selector of CHAT_SESSION_SELECTORS) {
    for (const section of document.querySelectorAll(selector)) {
      if (section instanceof HTMLElement) {
        section.removeAttribute("data-oc-lufeng-session");
      }
    }
  }
}

function syncModelControl() {
  const select = document.querySelector(CHAT_MODEL_SELECT_SELECTOR);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  syncPinnedModelSelect(select);
  if (!select.hasAttribute("data-oc-lufeng-prev-disabled")) {
    select.setAttribute("data-oc-lufeng-prev-disabled", String(select.disabled));
  }
  select.disabled = true;
  select.setAttribute("data-oc-lufeng-model", "locked");
  select.setAttribute("title", `模型已固定为 ${LUFENG_MODEL_LABEL}`);
}

function clearModelControl() {
  const select = document.querySelector(CHAT_MODEL_SELECT_SELECTOR);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const previousDisabled = select.getAttribute("data-oc-lufeng-prev-disabled");
  if (previousDisabled === "true") {
    select.disabled = true;
  } else if (previousDisabled === "false") {
    select.disabled = false;
  }
  select.removeAttribute("data-oc-lufeng-prev-disabled");
  select.removeAttribute("data-oc-lufeng-model");
  select.removeAttribute("title");
}

function createPinnedModelOption() {
  const option = document.createElement("option");
  option.value = LUFENG_MODEL_VALUE;
  option.textContent = LUFENG_MODEL_LABEL;
  option.selected = true;
  return option;
}

function syncPinnedModelSelect(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const currentOptions = [...select.options];
  if (
    currentOptions.length === 1 &&
    currentOptions[0]?.value === LUFENG_MODEL_VALUE &&
    currentOptions[0]?.textContent === LUFENG_MODEL_LABEL
  ) {
    select.value = LUFENG_MODEL_VALUE;
    return;
  }
  select.replaceChildren(createPinnedModelOption());
  select.value = LUFENG_MODEL_VALUE;
}

function pinPublicChatSession(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }

  if (!app.__openclawLufengPatched) {
    if (typeof app.setTab === "function") {
      const originalSetTab = app.setTab.bind(app);
      app.setTab = () => originalSetTab("chat");
    }
    if (typeof app.applySettings === "function") {
      const originalApplySettings = app.applySettings.bind(app);
      app.applySettings = (next) =>
        originalApplySettings({
          ...next,
          sessionKey: LUFENG_SESSION_KEY,
          lastActiveSessionKey: LUFENG_SESSION_KEY,
        });
    }
    app.__openclawLufengPatched = true;
  }

  if (typeof app.setTab === "function" && app.tab !== "chat") {
    app.setTab("chat");
  }

  if (app.sessionKey !== LUFENG_SESSION_KEY) {
    app.sessionKey = LUFENG_SESSION_KEY;
    if (typeof app.applySettings === "function" && app.settings) {
      app.applySettings({
        ...app.settings,
        sessionKey: LUFENG_SESSION_KEY,
        lastActiveSessionKey: LUFENG_SESSION_KEY,
      });
    }
    if (typeof app.loadAssistantIdentity === "function") {
      void app.loadAssistantIdentity();
    }
  }
}

function isPinnedLufengModel(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === LUFENG_MODEL_VALUE || normalized === "gpt-5.4";
}

function extractLufengMessageText(message) {
  if (!message || typeof message !== "object") {
    return "";
  }
  if (typeof message.errorMessage === "string" && message.errorMessage.trim()) {
    return message.errorMessage.trim();
  }
  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((item) =>
        item && typeof item === "object" && item.type === "text" && typeof item.text === "string"
          ? item.text.trim()
          : "",
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function isStaleLufengStartupError(message) {
  if (!message || typeof message !== "object") {
    return false;
  }
  const role = String(message.role || "")
    .trim()
    .toLowerCase();
  if (role !== "assistant") {
    return false;
  }
  const text = extractLufengMessageText(message);
  if (!LUFENG_STALE_STARTUP_ERROR_PATTERN.test(text)) {
    return false;
  }
  const provider = String(message.provider || message.modelProvider || "")
    .trim()
    .toLowerCase();
  const model = String(message.model || "")
    .trim()
    .toLowerCase();
  return (
    provider === "volcengine-plan" ||
    provider === "byteplus-plan" ||
    model === "ark-code-latest" ||
    model === "volcengine-plan/ark-code-latest"
  );
}

function isAllowedLufengModelValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes("/")) {
    const [provider, model] = normalized.split("/", 2);
    return provider === LUFENG_PINNED_MODEL_PROVIDER && model.startsWith("gpt");
  }
  return normalized.startsWith("gpt");
}

function isAllowedLufengModelEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const provider = String(entry.provider || "")
    .trim()
    .toLowerCase();
  const id = String(entry.id || "")
    .trim()
    .toLowerCase();
  return provider === LUFENG_PINNED_MODEL_PROVIDER && id.startsWith("gpt");
}

function normalizeLufengModelsListResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const models = Array.isArray(result.models) ? result.models : [];
  const seen = new Set();
  const filtered = [];
  for (const entry of models) {
    if (!isAllowedLufengModelEntry(entry)) {
      continue;
    }
    const provider = String(entry.provider || "").trim() || LUFENG_PINNED_MODEL_PROVIDER;
    const id = String(entry.id || "").trim();
    const key = `${provider.toLowerCase()}/${id.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    filtered.push({ ...entry, provider, id });
  }
  if (filtered.length === 0) {
    filtered.push({ ...LUFENG_PINNED_MODEL_ENTRY });
  }
  return {
    ...result,
    models: filtered,
  };
}

function normalizeLufengSessionsListResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const sessions = Array.isArray(result.sessions) ? result.sessions : [];
  return {
    ...result,
    defaults: {
      ...(result.defaults && typeof result.defaults === "object" ? result.defaults : {}),
      model: LUFENG_PINNED_MODEL_ID,
      modelProvider: LUFENG_PINNED_MODEL_PROVIDER,
    },
    sessions: sessions.map((session) => {
      if (String(session?.key || "").trim() !== LUFENG_SESSION_KEY) {
        return session;
      }
      return {
        ...session,
        model: LUFENG_PINNED_MODEL_ID,
        modelProvider: LUFENG_PINNED_MODEL_PROVIDER,
        providerOverride: LUFENG_PINNED_MODEL_PROVIDER,
      };
    }),
  };
}

function sanitizeLufengHistoryMessage(message) {
  if (!message || typeof message !== "object") {
    return message;
  }
  if (isStaleLufengStartupError(message)) {
    return null;
  }
  const role = String(message.role || "")
    .trim()
    .toLowerCase();
  const model = typeof message.model === "string" ? message.model.trim() : "";
  if (role !== "assistant" || !model || model === "gateway-injected") {
    return message;
  }
  if (isAllowedLufengModelValue(model)) {
    return message;
  }
  const next = { ...message };
  delete next.model;
  return next;
}

function normalizeLufengChatHistoryResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const messages = Array.isArray(result.messages) ? result.messages : [];
  return {
    ...result,
    messages: messages
      .map(sanitizeLufengHistoryMessage)
      .filter((message) => message && typeof message === "object"),
  };
}

function normalizeLufengSessionsPatchResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  return {
    ...result,
    resolved: {
      ...(result.resolved && typeof result.resolved === "object" ? result.resolved : {}),
      model: LUFENG_PINNED_MODEL_ID,
      modelProvider: LUFENG_PINNED_MODEL_PROVIDER,
    },
  };
}

function setPinnedLufengModelOverride(app, override) {
  const existing =
    app?.chatModelOverrides && typeof app.chatModelOverrides === "object"
      ? app.chatModelOverrides
      : {};
  const next = { ...existing };
  if (override) {
    next[LUFENG_SESSION_KEY] = override;
  } else {
    delete next[LUFENG_SESSION_KEY];
  }
  app.chatModelOverrides = next;
  if (typeof app.requestUpdate === "function") {
    app.requestUpdate();
  }
}

function patchLufengClient(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }
  if (!app.client || typeof app.client.request !== "function") {
    return;
  }
  if (app.__openclawLufengClientPatchedFor === app.client) {
    return;
  }

  const originalRequest = app.client.request.bind(app.client);
  app.client.request = async (method, params) => {
    const onLufengRoute = isLufengPublicPath();
    const nextParams =
      onLufengRoute &&
      method === "sessions.patch" &&
      params &&
      typeof params === "object" &&
      String(params.key || "").trim() === LUFENG_SESSION_KEY
        ? {
            ...params,
            key: LUFENG_SESSION_KEY,
            model: LUFENG_MODEL_VALUE,
          }
        : params;

    const result = await originalRequest(method, nextParams);
    if (!onLufengRoute) {
      return result;
    }
    if (method === "models.list") {
      return normalizeLufengModelsListResult(result);
    }
    if (method === "sessions.list") {
      return normalizeLufengSessionsListResult(result);
    }
    if (method === "chat.history") {
      return normalizeLufengChatHistoryResult(result);
    }
    if (method === "sessions.patch") {
      return normalizeLufengSessionsPatchResult(result);
    }
    return result;
  };
  app.__openclawLufengClientPatchedFor = app.client;
}

function syncLufengChatModelCatalog(app) {
  const current = Array.isArray(app?.chatModelCatalog) ? app.chatModelCatalog : [];
  const next = normalizeLufengModelsListResult({ models: current }).models;
  const changed =
    next.length !== current.length ||
    next.some((entry, index) => {
      const previous = current[index];
      return (
        previous?.id !== entry.id ||
        previous?.name !== entry.name ||
        previous?.provider !== entry.provider
      );
    });
  if (!changed) {
    return false;
  }
  app.chatModelCatalog = next;
  return true;
}

function syncLufengSessionsState(app) {
  if (!app?.sessionsResult || typeof app.sessionsResult !== "object") {
    return false;
  }
  const next = normalizeLufengSessionsListResult(app.sessionsResult);
  const current = app.sessionsResult;
  const currentSession = Array.isArray(current.sessions)
    ? current.sessions.find((session) => String(session?.key || "").trim() === LUFENG_SESSION_KEY)
    : null;
  const nextSession = Array.isArray(next.sessions)
    ? next.sessions.find((session) => String(session?.key || "").trim() === LUFENG_SESSION_KEY)
    : null;
  const changed =
    current?.defaults?.model !== next?.defaults?.model ||
    current?.defaults?.modelProvider !== next?.defaults?.modelProvider ||
    currentSession?.model !== nextSession?.model ||
    currentSession?.modelProvider !== nextSession?.modelProvider ||
    currentSession?.providerOverride !== nextSession?.providerOverride;
  if (!changed) {
    return false;
  }
  app.sessionsResult = next;
  return true;
}

function syncLufengChatMessages(app) {
  const current = Array.isArray(app?.chatMessages) ? app.chatMessages : null;
  if (!current) {
    return false;
  }
  let changed = false;
  const next = current
    .map((message) => {
      const normalized = sanitizeLufengHistoryMessage(message);
      if (normalized !== message) {
        changed = true;
      }
      return normalized;
    })
    .filter((message) => message && typeof message === "object");
  if (!changed) {
    return false;
  }
  app.chatMessages = next;
  return true;
}

function syncLufengLastError(app) {
  const current = String(app?.lastError || "").trim();
  if (!current || !LUFENG_STALE_STARTUP_ERROR_PATTERN.test(current)) {
    return false;
  }
  app.lastError = null;
  return true;
}

function syncLufengAppState(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }
  const changedCatalog = syncLufengChatModelCatalog(app);
  const changedSessions = syncLufengSessionsState(app);
  const changedMessages = syncLufengChatMessages(app);
  const changedError = syncLufengLastError(app);
  const changed = changedCatalog || changedSessions || changedMessages || changedError;
  if (changed && typeof app.requestUpdate === "function") {
    app.requestUpdate();
  }
}

async function ensurePinnedLufengModel(app) {
  if (!(app instanceof HTMLElement)) {
    return;
  }
  if (app.__openclawLufengModelSyncPending) {
    return;
  }
  if (app.__openclawLufengModelPinnedFor === app.client) {
    return;
  }
  if (!app.client || typeof app.client.request !== "function") {
    return;
  }

  app.__openclawLufengModelSyncPending = true;
  const previousOverride = app?.chatModelOverrides?.[LUFENG_SESSION_KEY] ?? null;
  setPinnedLufengModelOverride(app, {
    kind: "qualified",
    value: LUFENG_MODEL_VALUE,
  });

  try {
    await app.client.request("sessions.patch", {
      key: LUFENG_SESSION_KEY,
      model: LUFENG_MODEL_VALUE,
    });
    app.__openclawLufengModelPinnedFor = app.client;
  } catch {
    setPinnedLufengModelOverride(app, previousOverride);
  } finally {
    app.__openclawLufengModelSyncPending = false;
  }
}

function syncLufengSurface() {
  if (!isLufengPublicPath()) {
    document.documentElement.removeAttribute("data-oc-lufeng-route");
    document.body?.removeAttribute("data-oc-lufeng-route");
    for (const candidate of document.querySelectorAll("div, nav, aside, section")) {
      if (findSidebar(candidate) === candidate) {
        clearSidebarSync(candidate);
      }
    }
    document.querySelectorAll(SIDEBAR_FOOTER_SELECTOR).forEach(clearFooterSync);
    clearTopbarSearch();
    clearSessionControls();
    clearModelControl();
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return;
  }

  ensureStyle();
  document.documentElement.setAttribute("data-oc-lufeng-route", "true");
  document.body?.setAttribute("data-oc-lufeng-route", "true");
  normalizeLufengLocation();
  for (const candidate of document.querySelectorAll("div, nav, aside, section")) {
    if (findSidebar(candidate) === candidate) {
      syncSidebar(candidate);
    }
  }
  document.querySelectorAll(SIDEBAR_FOOTER_SELECTOR).forEach((footer) => {
    if (footer instanceof HTMLElement) {
      footer.setAttribute("data-oc-lufeng-footer", "hidden");
    }
  });
  syncTopbarSearch();
  syncSessionControls();
  syncModelControl();
  const app = document.querySelector("openclaw-app");
  pinPublicChatSession(app);
  patchLufengClient(app);
  void ensurePinnedLufengModel(app);
  syncLufengAppState(app);
}

export function bootLufengSurface() {
  syncLufengSurface();

  if (window.__openclawLufengSurfaceBooted) {
    return;
  }
  window.__openclawLufengSurfaceBooted = true;

  const observer = new MutationObserver(() => {
    syncLufengSurface();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  window.addEventListener("popstate", syncLufengSurface);
  window.setInterval(syncLufengSurface, 800);
}

export { LUFENG_ROUTE, LUFENG_SESSION_KEY };

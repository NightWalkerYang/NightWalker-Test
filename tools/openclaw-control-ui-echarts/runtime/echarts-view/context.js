const ECHARTS_VIEW_ROUTE = "/echarts-view";
const ECHARTS_VIEW_CHAT_ROUTE = `${ECHARTS_VIEW_ROUTE}/chat`;
const ECHARTS_VIEW_CANONICAL_ROUTE = `${ECHARTS_VIEW_ROUTE}/`;
const ECHARTS_VIEW_TOKEN_STORAGE_KEY = "openclaw:tenant-platform:echarts-view-token:v1";
const ECHARTS_VIEW_CONTEXT_STORAGE_KEY = "openclaw:tenant-platform:echarts-view-context:v1";

function normalizePathname(pathname = window.location.pathname) {
  const raw = String(pathname ?? "").trim() || "/";
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  if (prefixed.length > 1 && prefixed.endsWith("/")) {
    return prefixed.slice(0, -1);
  }
  return prefixed;
}

function stripIndexHtml(pathname) {
  return String(pathname ?? "").replace(/\/index\.html$/i, "");
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredJson(key) {
  for (const storage of [safeSessionStorage(), safeLocalStorage()]) {
    if (!storage) {
      continue;
    }
    const raw = storage.getItem(key)?.trim() || "";
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore malformed browser-local context.
    }
  }
  return null;
}

function writeStoredJson(key, value) {
  const storages = [safeSessionStorage(), safeLocalStorage()].filter(Boolean);
  if (!storages.length) {
    return;
  }
  const payload = JSON.stringify(value && typeof value === "object" ? value : {});
  for (const storage of storages) {
    storage.setItem(key, payload);
  }
}

function clearStoredJson(key) {
  for (const storage of [safeSessionStorage(), safeLocalStorage()]) {
    storage?.removeItem(key);
  }
}

export function writeEchartsViewToken(token) {
  const normalized = String(token || "").trim();
  const storages = [safeSessionStorage(), safeLocalStorage()].filter(Boolean);
  if (!storages.length) {
    return;
  }
  for (const storage of storages) {
    if (!normalized) {
      storage.removeItem(ECHARTS_VIEW_TOKEN_STORAGE_KEY);
      continue;
    }
    storage.setItem(ECHARTS_VIEW_TOKEN_STORAGE_KEY, normalized);
  }
}

function readStoredEchartsViewToken() {
  for (const storage of [safeSessionStorage(), safeLocalStorage()]) {
    if (!storage) {
      continue;
    }
    const token = storage.getItem(ECHARTS_VIEW_TOKEN_STORAGE_KEY)?.trim() || "";
    if (token) {
      return token;
    }
  }
  return "";
}

export function normalizeEchartsViewPathname(pathname = window.location.pathname) {
  return normalizePathname(stripIndexHtml(pathname));
}

export function isEchartsViewPublicPath(pathname = window.location.pathname) {
  const normalized = normalizeEchartsViewPathname(pathname);
  return normalized === ECHARTS_VIEW_ROUTE || normalized === ECHARTS_VIEW_CHAT_ROUTE;
}

export function readEchartsViewToken(locationHref = window.location.href) {
  const url = new URL(locationHref, document.baseURI);
  return url.searchParams.get("token")?.trim() || readStoredEchartsViewToken();
}

export function readEchartsViewRuntimeContext(token = readEchartsViewToken()) {
  const normalizedToken = String(token || "").trim();
  const context = readStoredJson(ECHARTS_VIEW_CONTEXT_STORAGE_KEY);
  if (!context || typeof context !== "object") {
    return null;
  }
  if (normalizedToken && String(context.token || "").trim() !== normalizedToken) {
    return null;
  }
  return context;
}

export function writeEchartsViewRuntimeContext(context = {}) {
  const token = String(context.token || readEchartsViewToken() || "").trim();
  if (!token) {
    return;
  }
  const existing = readEchartsViewRuntimeContext(token) || {};
  writeStoredJson(ECHARTS_VIEW_CONTEXT_STORAGE_KEY, {
    ...existing,
    ...context,
    token,
    updatedAt: Date.now(),
  });
}

export function writeEchartsViewPendingPrompt(context = {}) {
  const token = String(context.token || readEchartsViewToken() || "").trim();
  if (!token) {
    return;
  }
  const existing = readEchartsViewRuntimeContext(token) || {};
  writeStoredJson(ECHARTS_VIEW_CONTEXT_STORAGE_KEY, {
    ...existing,
    ...context,
    token,
    pendingPrompt: String(context.pendingPrompt || "").trim(),
    pendingPromptAt: Date.now(),
  });
}

export function consumeEchartsViewPendingPrompt(params = {}) {
  const token = String(params.token || readEchartsViewToken() || "").trim();
  const context = readEchartsViewRuntimeContext(token);
  const prompt = String(context?.pendingPrompt || "").trim();
  if (!context || !prompt) {
    return null;
  }
  const tenantAgentId = String(params.tenantAgentId || "").trim();
  const sessionKey = String(params.sessionKey || "").trim();
  if (tenantAgentId && String(context.tenantAgentId || "").trim() !== tenantAgentId) {
    return null;
  }
  if (
    sessionKey &&
    String(context.openclawSessionKey || "").trim() &&
    String(context.openclawSessionKey || "").trim() !== sessionKey
  ) {
    return null;
  }
  writeStoredJson(ECHARTS_VIEW_CONTEXT_STORAGE_KEY, {
    ...context,
    pendingPrompt: "",
    pendingPromptAt: 0,
  });
  return {
    prompt,
    returnChatHref: String(context.returnChatHref || "").trim(),
    tenantAgentId: String(context.tenantAgentId || "").trim(),
    openclawSessionKey: String(context.openclawSessionKey || "").trim(),
    pageId: String(context.pageId || "").trim(),
  };
}

export function clearEchartsViewRuntimeContext() {
  clearStoredJson(ECHARTS_VIEW_CONTEXT_STORAGE_KEY);
}

export function normalizeEchartsViewRouteUrl(urlLike, baseHref = window.location.href) {
  const url = new URL(urlLike, baseHref);
  if (!isEchartsViewPublicPath(url.pathname)) {
    return url;
  }

  const normalizedPathname = normalizeEchartsViewPathname(url.pathname);
  if (
    normalizedPathname === ECHARTS_VIEW_CHAT_ROUTE ||
    normalizedPathname === ECHARTS_VIEW_ROUTE
  ) {
    url.pathname = ECHARTS_VIEW_CANONICAL_ROUTE;
    url.searchParams.delete("session");
  }
  return url;
}

export { ECHARTS_VIEW_ROUTE };

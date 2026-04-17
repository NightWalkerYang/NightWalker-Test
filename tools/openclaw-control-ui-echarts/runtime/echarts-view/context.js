const ECHARTS_VIEW_ROUTE = "/echarts-view";
const ECHARTS_VIEW_CHAT_ROUTE = `${ECHARTS_VIEW_ROUTE}/chat`;
const ECHARTS_VIEW_TOKEN_STORAGE_KEY = "openclaw:tenant-platform:echarts-view-token:v1";

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

export function normalizeEchartsViewRouteUrl(urlLike, baseHref = window.location.href) {
  const url = new URL(urlLike, baseHref);
  if (!isEchartsViewPublicPath(url.pathname)) {
    return url;
  }

  const normalizedPathname = normalizeEchartsViewPathname(url.pathname);
  if (normalizedPathname === ECHARTS_VIEW_CHAT_ROUTE) {
    url.pathname = ECHARTS_VIEW_ROUTE;
  }
  if (normalizeEchartsViewPathname(url.pathname) === ECHARTS_VIEW_ROUTE) {
    url.searchParams.delete("session");
  }
  return url;
}

export { ECHARTS_VIEW_ROUTE };

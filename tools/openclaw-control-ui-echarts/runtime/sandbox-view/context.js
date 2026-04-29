const SANDBOX_VIEW_ROUTE = "/sandbox-view";
const SANDBOX_VIEW_CHAT_ROUTE = `${SANDBOX_VIEW_ROUTE}/chat`;
const SANDBOX_VIEW_CANONICAL_ROUTE = `${SANDBOX_VIEW_ROUTE}/`;
const SANDBOX_VIEW_TOKEN_STORAGE_KEY = "openclaw:tenant-platform:sandbox-view-token:v1";

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

export function writeSandboxViewToken(token) {
  const normalized = String(token || "").trim();
  const storages = [safeSessionStorage(), safeLocalStorage()].filter(Boolean);
  if (!storages.length) {
    return;
  }
  for (const storage of storages) {
    if (!normalized) {
      storage.removeItem(SANDBOX_VIEW_TOKEN_STORAGE_KEY);
      continue;
    }
    storage.setItem(SANDBOX_VIEW_TOKEN_STORAGE_KEY, normalized);
  }
}

function readStoredSandboxViewToken() {
  for (const storage of [safeSessionStorage(), safeLocalStorage()]) {
    if (!storage) {
      continue;
    }
    const token = storage.getItem(SANDBOX_VIEW_TOKEN_STORAGE_KEY)?.trim() || "";
    if (token) {
      return token;
    }
  }
  return "";
}

export function normalizeSandboxViewPathname(pathname = window.location.pathname) {
  return normalizePathname(stripIndexHtml(pathname));
}

export function isSandboxViewPublicPath(pathname = window.location.pathname) {
  const normalized = normalizeSandboxViewPathname(pathname);
  return normalized === SANDBOX_VIEW_ROUTE || normalized === SANDBOX_VIEW_CHAT_ROUTE;
}

export function readSandboxViewToken(locationHref = window.location.href) {
  const url = new URL(locationHref, document.baseURI);
  return url.searchParams.get("token")?.trim() || readStoredSandboxViewToken();
}

export function normalizeSandboxViewRouteUrl(urlLike, baseHref = window.location.href) {
  const url = new URL(urlLike, baseHref);
  if (!isSandboxViewPublicPath(url.pathname)) {
    return url;
  }

  const normalizedPathname = normalizeSandboxViewPathname(url.pathname);
  if (
    normalizedPathname === SANDBOX_VIEW_CHAT_ROUTE ||
    normalizedPathname === SANDBOX_VIEW_ROUTE
  ) {
    url.pathname = SANDBOX_VIEW_CANONICAL_ROUTE;
    url.searchParams.delete("session");
  }
  return url;
}

export { SANDBOX_VIEW_ROUTE };

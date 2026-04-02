export const LUFENG_ROUTE = "/lufeng";
export const LUFENG_CHAT_ROUTE = `${LUFENG_ROUTE}/chat`;
export const LUFENG_AGENT_ID = "subotech-finance";
export const LUFENG_AGENT_NAME = "苏博泰克财务分析助手";
export const LUFENG_SESSION_KEY = `agent:${LUFENG_AGENT_ID}:main`;

function normalizePath(value) {
  const raw = String(value ?? "").trim() || "/";
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  if (prefixed.length > 1 && prefixed.endsWith("/")) {
    return prefixed.slice(0, -1);
  }
  return prefixed;
}

export function isLufengPublicPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);
  return normalized === LUFENG_ROUTE || normalized === LUFENG_CHAT_ROUTE;
}

export function resolveGatewayOrigin(locationLike = window.location) {
  const protocol = locationLike.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${locationLike.host}`;
}

export function normalizeGatewayScope(gatewayUrl) {
  const trimmed = String(gatewayUrl ?? "").trim();
  if (!trimmed) {
    return "default";
  }
  try {
    const parsed = new URL(trimmed, `${window.location.protocol}//${window.location.host}/`);
    const pathname =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed;
  }
}

export function buildSettingsStorageKey(gatewayUrl) {
  return `openclaw.control.settings.v1:${normalizeGatewayScope(gatewayUrl)}`;
}

export function buildTokenStorageKey(gatewayUrl) {
  return `openclaw.control.token.v1:${normalizeGatewayScope(gatewayUrl)}`;
}

export function normalizeLufengRouteUrl(urlLike, baseHref = window.location.href) {
  const url = new URL(urlLike, baseHref);
  if (!isLufengPublicPath(url.pathname)) {
    return url;
  }
  const normalized = normalizePath(url.pathname);
  if (normalized === LUFENG_CHAT_ROUTE) {
    url.pathname = LUFENG_ROUTE;
  }
  if (normalizePath(url.pathname) === LUFENG_ROUTE) {
    url.searchParams.delete("session");
  }
  return url;
}

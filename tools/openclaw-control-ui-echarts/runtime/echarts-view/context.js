const ECHARTS_VIEW_ROUTE = "/echarts-view";
const ECHARTS_VIEW_CHAT_ROUTE = `${ECHARTS_VIEW_ROUTE}/chat`;

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

export function normalizeEchartsViewPathname(pathname = window.location.pathname) {
  return normalizePathname(stripIndexHtml(pathname));
}

export function isEchartsViewPublicPath(pathname = window.location.pathname) {
  const normalized = normalizeEchartsViewPathname(pathname);
  return normalized === ECHARTS_VIEW_ROUTE || normalized === ECHARTS_VIEW_CHAT_ROUTE;
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

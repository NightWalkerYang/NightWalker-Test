const ECHARTS_VIEW_ROUTE = "/echarts-view";

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
  return normalized === ECHARTS_VIEW_ROUTE || normalized.endsWith(ECHARTS_VIEW_ROUTE);
}

export { ECHARTS_VIEW_ROUTE };

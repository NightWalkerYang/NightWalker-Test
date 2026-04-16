(() => {
  const currentScript =
    typeof document !== "undefined" ? document.currentScript : null;
  const rawToken = currentScript?.dataset?.gatewayToken ?? "";
  const token = String(rawToken ?? "").trim();

  if (!token || typeof window === "undefined" || typeof location === "undefined") {
    return;
  }

  const controlUiTabPaths = new Set([
    "/agents",
    "/overview",
    "/channels",
    "/instances",
    "/sessions",
    "/usage",
    "/cron",
    "/skills",
    "/nodes",
    "/chat",
    "/config",
    "/communications",
    "/appearance",
    "/automation",
    "/infrastructure",
    "/ai-agents",
    "/debug",
    "/logs",
  ]);

  const normalizeBasePath = (basePath) => {
    if (!basePath) {
      return "";
    }
    let base = String(basePath).trim();
    if (!base) {
      return "";
    }
    if (!base.startsWith("/")) {
      base = `/${base}`;
    }
    if (base === "/") {
      return "";
    }
    if (base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    return base;
  };

  const normalizePath = (path) => {
    if (!path) {
      return "/";
    }
    let normalized = String(path).trim();
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  };

  const inferBasePathFromPathname = (pathname) => {
    let normalized = normalizePath(pathname);
    if (normalized.endsWith("/index.html")) {
      normalized = normalizePath(normalized.slice(0, -"/index.html".length));
    }
    if (normalized === "/") {
      return "";
    }
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length === 0) {
      return "";
    }
    for (let index = 0; index < segments.length; index += 1) {
      const candidate = `/${segments.slice(index).join("/")}`.toLowerCase();
      if (controlUiTabPaths.has(candidate)) {
        const prefix = segments.slice(0, index);
        return prefix.length > 0 ? `/${prefix.join("/")}` : "";
      }
    }
    return `/${segments.join("/")}`;
  };

  const normalizeGatewayTokenScope = (gatewayUrl) => {
    const trimmed = String(gatewayUrl || "").trim();
    if (!trimmed) {
      return "default";
    }
    try {
      const base = `${location.protocol}//${location.host}${location.pathname || "/"}`;
      const parsed = new URL(trimmed, base);
      const pathname =
        parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
      return `${parsed.protocol}//${parsed.host}${pathname}`;
    } catch {
      return trimmed;
    }
  };

  try {
    const storage = window.sessionStorage;
    if (!storage) {
      return;
    }
    const configured =
      typeof window.__OPENCLAW_CONTROL_UI_BASE_PATH__ === "string" &&
      window.__OPENCLAW_CONTROL_UI_BASE_PATH__.trim();
    const basePath = configured
      ? normalizeBasePath(window.__OPENCLAW_CONTROL_UI_BASE_PATH__)
      : inferBasePathFromPathname(location.pathname);
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const gatewayUrl = `${proto}://${location.host}${basePath}`;
    const scopes = new Set([
      normalizeGatewayTokenScope(gatewayUrl),
      normalizeGatewayTokenScope(`${proto}://${location.host}`),
    ]);
    for (const scope of scopes) {
      storage.setItem(`openclaw.control.token.v1:${scope}`, token);
    }
    window.__OPENCLAW_CONTROL_UI_AUTO_TOKEN__ = true;
  } catch {
    // Best-effort only. The app can still fall back to manual login if storage
    // is unavailable in this browser context.
  }
})();

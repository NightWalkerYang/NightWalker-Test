(() => {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof location === "undefined") {
    return;
  }

  const currentScript = document.currentScript;
  const rawToken = currentScript?.dataset?.gatewayToken ?? "";
  const ROUTE = "/lufeng";
  const CHAT_ROUTE = "/lufeng/chat";
  const SESSION_KEY = "agent:subotech-finance:main";

  const normalizePath = (value) => {
    const raw = String(value ?? "").trim() || "/";
    const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
    if (prefixed.length > 1 && prefixed.endsWith("/")) {
      return prefixed.slice(0, -1);
    }
    return prefixed;
  };

  const isLufengPath = (pathname) => {
    const normalized = normalizePath(pathname);
    return normalized === ROUTE || normalized === CHAT_ROUTE;
  };

  if (!isLufengPath(location.pathname)) {
    return;
  }

  const normalizeGatewayScope = (gatewayUrl) => {
    const trimmed = String(gatewayUrl ?? "").trim();
    if (!trimmed) {
      return "default";
    }
    try {
      const parsed = new URL(
        trimmed,
        `${window.location.protocol}//${window.location.host}/`,
      );
      const pathname =
        parsed.pathname === "/"
          ? ""
          : parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
      return `${parsed.protocol}//${parsed.host}${pathname}`;
    } catch {
      return trimmed;
    }
  };

  const buildSettingsStorageKey = (gatewayUrl) =>
    `openclaw.control.settings.v1:${normalizeGatewayScope(gatewayUrl)}`;
  const buildTokenStorageKey = (gatewayUrl) =>
    `openclaw.control.token.v1:${normalizeGatewayScope(gatewayUrl)}`;

  const normalizeLufengRouteUrl = (urlLike, baseHref = window.location.href) => {
    const url = new URL(urlLike, baseHref);
    if (!isLufengPath(url.pathname)) {
      return url;
    }
    if (normalizePath(url.pathname) === CHAT_ROUTE) {
      url.pathname = ROUTE;
    }
    if (normalizePath(url.pathname) === ROUTE) {
      url.searchParams.delete("session");
    }
    return url;
  };

  const gatewayOrigin = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`;
  const lufengScopeUrl = `${gatewayOrigin}${ROUTE}`;
  const rootGatewayScope = normalizeGatewayScope(gatewayOrigin);

  window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = ROUTE;
  window.__OPENCLAW_LUFENG_MODE__ = true;
  document.documentElement.setAttribute("data-oc-lufeng-route", "true");

  try {
    const storage = window.localStorage;
    if (storage) {
      const key = buildSettingsStorageKey(lufengScopeUrl);
      const existingRaw = storage.getItem(key);
      const existing =
        existingRaw && existingRaw.trim()
          ? JSON.parse(existingRaw)
          : {};
      const next = {
        ...existing,
        gatewayUrl: gatewayOrigin,
        sessionKey: SESSION_KEY,
        lastActiveSessionKey: SESSION_KEY,
        sessionsByGateway: {
          ...(existing.sessionsByGateway && typeof existing.sessionsByGateway === "object"
            ? existing.sessionsByGateway
            : {}),
          [rootGatewayScope]: {
            sessionKey: SESSION_KEY,
            lastActiveSessionKey: SESSION_KEY,
          },
        },
      };
      storage.setItem(key, JSON.stringify(next));
    }
  } catch {
    // Best-effort only.
  }

  try {
    const token = String(rawToken ?? "").trim();
    if (token && window.sessionStorage) {
      window.sessionStorage.setItem(buildTokenStorageKey(gatewayOrigin), token);
    }
  } catch {
    // Best-effort only.
  }

  if (!window.__OPENCLAW_LUFENG_HISTORY_PATCHED__) {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalPushState = window.history.pushState.bind(window.history);

    const wrap =
      (original) =>
      (state, unused, url) => {
        if (url == null) {
          return original(state, unused, url);
        }
        const normalized = normalizeLufengRouteUrl(url, window.location.href);
        return original(state, unused, normalized.toString());
      };

    window.history.replaceState = wrap(originalReplaceState);
    window.history.pushState = wrap(originalPushState);
    window.__OPENCLAW_LUFENG_HISTORY_PATCHED__ = true;
  }

  const normalizedCurrent = normalizeLufengRouteUrl(window.location.href, window.location.href);
  if (
    normalizedCurrent.pathname !== window.location.pathname ||
    normalizedCurrent.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalizedCurrent.toString());
  }
})();

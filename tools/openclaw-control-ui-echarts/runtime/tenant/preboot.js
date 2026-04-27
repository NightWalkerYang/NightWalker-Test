(() => {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof location === "undefined") {
    return;
  }

  const TENANT_SESSION_STORAGE_KEY = "openclaw:tenant-platform:tenant-session:v1";
  const TENANT_SELECTED_AGENT_STORAGE_KEY = "openclaw:tenant-platform:selected-agent:v1";
  const MEMBER_LAST_SESSION_STORAGE_KEY = "openclaw:tenant-platform:member-chat:last-session:v1";
  const CONTROL_UI_TAB_PATHS = new Set([
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

  const safeStorage = (storage) => {
    try {
      return storage || null;
    } catch {
      return null;
    }
  };

  const readJson = (storage, key) => {
    try {
      const raw = storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeJson = (storage, key, value) => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Best-effort only.
    }
  };

  const normalizePath = (value) => {
    const raw = String(value || "").trim() || "/";
    const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
    if (prefixed.length > 1 && prefixed.endsWith("/")) {
      return prefixed.slice(0, -1);
    }
    return prefixed;
  };

  const normalizeTenantValue = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const readTenantSession = () =>
    readJson(safeStorage(window.localStorage), TENANT_SESSION_STORAGE_KEY);

  const readSelectedTenantAgent = (href = window.location.href) => {
    const url = new URL(href, document.baseURI);
    const tenantAgentId = url.searchParams.get("tenantAgentId")?.trim() || "";
    const stored = readJson(safeStorage(window.localStorage), TENANT_SELECTED_AGENT_STORAGE_KEY);
    if (!tenantAgentId) {
      return stored;
    }
    if (stored?.id === tenantAgentId) {
      return stored;
    }
    return {
      ...(stored && typeof stored === "object" ? stored : {}),
      id: tenantAgentId,
    };
  };

  const resolveTenantSessionAgentIds = (selectedAgent) => {
    const primary = normalizeTenantValue(selectedAgent?.agentId);
    const base = normalizeTenantValue(selectedAgent?.baseAgentId);
    const values = [];
    if (primary) {
      values.push(primary);
    }
    if (base && base !== primary) {
      values.push(base);
    }
    return values;
  };

  const buildTenantMemberSessionPrefix = (session, selectedAgent, explicitAgentId = "") => {
    const agentId =
      normalizeTenantValue(explicitAgentId) || resolveTenantSessionAgentIds(selectedAgent)[0];
    const tenantId = normalizeTenantValue(session?.session?.tenantId);
    const userId = normalizeTenantValue(session?.session?.userId);
    const tenantAgentId = normalizeTenantValue(selectedAgent?.id);
    if (!agentId || !tenantId || !userId || !tenantAgentId) {
      return "";
    }
    return `agent:${agentId}:tenant:${tenantId}:tenant-agent:${tenantAgentId}:user:${userId}:chat:`;
  };

  const buildTenantMemberLegacySessionKeys = (selectedAgent) => {
    const tenantAgentId = normalizeTenantValue(selectedAgent?.id);
    if (!tenantAgentId) {
      return [];
    }
    return resolveTenantSessionAgentIds(selectedAgent).map(
      (agentId) => `agent:${agentId}:tenant-${tenantAgentId}`,
    );
  };

  const isTenantMemberSessionKey = (sessionKey, session, selectedAgent) => {
    const normalizedSessionKey = normalizeTenantValue(sessionKey);
    if (!normalizedSessionKey) {
      return false;
    }
    const legacyKeys = buildTenantMemberLegacySessionKeys(selectedAgent);
    if (legacyKeys.includes(normalizedSessionKey)) {
      return true;
    }
    const sessionPrefixes = resolveTenantSessionAgentIds(selectedAgent)
      .map((agentId) => buildTenantMemberSessionPrefix(session, selectedAgent, agentId))
      .filter(Boolean);
    return sessionPrefixes.some((prefix) => normalizedSessionKey.startsWith(prefix));
  };

  const createTenantMemberSessionKey = (session, selectedAgent) => {
    const prefix = buildTenantMemberSessionPrefix(session, selectedAgent);
    if (!prefix) {
      return "";
    }
    const randomPart =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID().toLowerCase()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}${randomPart}`;
  };

  const buildTenantMemberChatRoute = (tenantAgentId, sessionKey = "") => {
    const url = new URL("./chat", document.baseURI);
    const normalizedTenantAgentId = String(tenantAgentId || "").trim();
    if (normalizedTenantAgentId) {
      url.searchParams.set("tenantAgentId", normalizedTenantAgentId);
    }
    const normalizedSessionKey = String(sessionKey || "").trim();
    if (normalizedSessionKey) {
      url.searchParams.set("session", normalizedSessionKey);
    }
    return url;
  };

  const buildMemberSessionCacheId = (session, selectedAgent) => {
    const tenantId = normalizeTenantValue(session?.session?.tenantId);
    const userId = normalizeTenantValue(session?.session?.userId);
    const tenantAgentId = normalizeTenantValue(selectedAgent?.id);
    if (!tenantId || !userId || !tenantAgentId) {
      return "";
    }
    return `${tenantId}:${userId}:${tenantAgentId}`;
  };

  const readCachedMemberSessionKey = (session, selectedAgent) => {
    const cacheId = buildMemberSessionCacheId(session, selectedAgent);
    if (!cacheId) {
      return "";
    }
    const cache = readJson(safeStorage(window.localStorage), MEMBER_LAST_SESSION_STORAGE_KEY);
    const candidate = cache && typeof cache === "object" ? cache[cacheId] : "";
    return isTenantMemberSessionKey(candidate, session, selectedAgent)
      ? normalizeTenantValue(candidate)
      : "";
  };

  const writeCachedMemberSessionKey = (session, selectedAgent, sessionKey) => {
    if (!isTenantMemberSessionKey(sessionKey, session, selectedAgent)) {
      return;
    }
    const cacheId = buildMemberSessionCacheId(session, selectedAgent);
    if (!cacheId) {
      return;
    }
    const storage = safeStorage(window.localStorage);
    const cache = readJson(storage, MEMBER_LAST_SESSION_STORAGE_KEY);
    const next = cache && typeof cache === "object" ? { ...cache } : {};
    next[cacheId] = normalizeTenantValue(sessionKey);
    writeJson(storage, MEMBER_LAST_SESSION_STORAGE_KEY, next);
  };

  const normalizeGatewayScope = (gatewayUrl) => {
    const trimmed = String(gatewayUrl || "").trim();
    if (!trimmed) {
      return "default";
    }
    try {
      const parsed = new URL(trimmed, `${location.protocol}//${location.host}/`);
      const pathname =
        parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
      return `${parsed.protocol}//${parsed.host}${pathname}`;
    } catch {
      return trimmed;
    }
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
      if (CONTROL_UI_TAB_PATHS.has(candidate)) {
        const prefix = segments.slice(0, index);
        return prefix.length > 0 ? `/${prefix.join("/")}` : "";
      }
    }
    return `/${segments.join("/")}`;
  };

  const buildSettingsStorageKey = (gatewayUrl) =>
    `openclaw.control.settings.v1:${normalizeGatewayScope(gatewayUrl)}`;

  const persistControlUiSession = (sessionKey) => {
    const normalizedSessionKey = normalizeTenantValue(sessionKey);
    if (!normalizedSessionKey) {
      return;
    }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const basePath = inferBasePathFromPathname(location.pathname);
    const gatewayScopeUrl = `${proto}://${location.host}${basePath}`;
    const rootScope = normalizeGatewayScope(`${proto}://${location.host}`);
    const scope = normalizeGatewayScope(gatewayScopeUrl);
    const storage = safeStorage(window.localStorage);
    if (!storage) {
      return;
    }
    const key = buildSettingsStorageKey(gatewayScopeUrl);
    const existing = readJson(storage, key) || {};
    const sessionsByGateway =
      existing.sessionsByGateway && typeof existing.sessionsByGateway === "object"
        ? { ...existing.sessionsByGateway }
        : {};
    sessionsByGateway[rootScope] = {
      ...(sessionsByGateway[rootScope] && typeof sessionsByGateway[rootScope] === "object"
        ? sessionsByGateway[rootScope]
        : {}),
      sessionKey: normalizedSessionKey,
      lastActiveSessionKey: normalizedSessionKey,
    };
    sessionsByGateway[scope] = {
      ...(sessionsByGateway[scope] && typeof sessionsByGateway[scope] === "object"
        ? sessionsByGateway[scope]
        : {}),
      sessionKey: normalizedSessionKey,
      lastActiveSessionKey: normalizedSessionKey,
    };
    const next = {
      ...existing,
      gatewayUrl: existing.gatewayUrl || gatewayScopeUrl,
      sessionKey: normalizedSessionKey,
      lastActiveSessionKey: normalizedSessionKey,
      sessionsByGateway,
    };
    storage.setItem(key, JSON.stringify(next));
    window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = basePath;
  };

  const resolveMemberRouteUrl = (urlLike, baseHref = window.location.href) => {
    const url = new URL(urlLike, baseHref);
    if (normalizePath(url.pathname) !== "/chat") {
      return url;
    }
    const tenantSession = readTenantSession();
    if (tenantSession?.session?.role !== "member") {
      return url;
    }
    const selectedAgent = readSelectedTenantAgent(url.href);
    const tenantAgentId = String(selectedAgent?.id || "").trim();
    if (!tenantAgentId) {
      return url;
    }

    url.searchParams.set("tenantAgentId", tenantAgentId);

    const querySessionKey = String(url.searchParams.get("session") || "").trim();
    const sessionKey = isTenantMemberSessionKey(querySessionKey, tenantSession, selectedAgent)
      ? normalizeTenantValue(querySessionKey)
      : readCachedMemberSessionKey(tenantSession, selectedAgent);

    if (sessionKey) {
      url.searchParams.set("session", sessionKey);
      persistControlUiSession(sessionKey);
    } else {
      url.searchParams.delete("session");
    }
    return url;
  };

  const persistRouteState = (url) => {
    const candidate = url instanceof URL ? url : new URL(url, window.location.href);
    if (normalizePath(candidate.pathname) !== "/chat") {
      return;
    }
    const tenantSession = readTenantSession();
    const selectedAgent = readSelectedTenantAgent(candidate.href);
    const sessionKey = String(candidate.searchParams.get("session") || "").trim();
    if (!isTenantMemberSessionKey(sessionKey, tenantSession, selectedAgent)) {
      return;
    }
    persistControlUiSession(sessionKey);
    writeCachedMemberSessionKey(tenantSession, selectedAgent, sessionKey);
  };

  document.documentElement.setAttribute("data-oc-tenant-preboot", "true");

  const normalizedCurrent = resolveMemberRouteUrl(window.location.href, window.location.href);
  persistControlUiSession(normalizedCurrent.searchParams.get("session") || "");

  if (!window.__OPENCLAW_TENANT_PREBOOT_HISTORY_PATCHED__) {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalPushState = window.history.pushState.bind(window.history);

    const wrap =
      (original) =>
      (state, unused, url) => {
        if (url == null) {
          return original(state, unused, url);
        }
        const normalized = resolveMemberRouteUrl(url, window.location.href);
        persistRouteState(normalized);
        return original(state, unused, normalized.toString());
      };

    window.history.replaceState = wrap(originalReplaceState);
    window.history.pushState = wrap(originalPushState);
    window.__OPENCLAW_TENANT_PREBOOT_HISTORY_PATCHED__ = true;
  }
})();

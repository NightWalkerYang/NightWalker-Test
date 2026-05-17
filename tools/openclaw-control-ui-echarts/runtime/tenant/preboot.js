(() => {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof location === "undefined"
  ) {
    return;
  }

  const TENANT_SESSION_STORAGE_KEY = "openclaw:tenant-platform:tenant-session:v1";
  const TENANT_SELECTED_AGENT_STORAGE_KEY = "openclaw:tenant-platform:selected-agent:v1";
  const MEMBER_LAST_SESSION_STORAGE_KEY = "openclaw:tenant-platform:member-chat:last-session:v1";
  const MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY =
    "openclaw:tenant-platform:member-chat:draft-route-lock:v1";
  const TENANT_VIEW_QUERY_KEY = "ocTenantView";
  const TENANT_BOOT_LOCK_ATTR = "data-oc-tenant-boot-lock";
  const TENANT_BOOT_LOCK_WINDOW_KEY = "__OPENCLAW_TENANT_BOOT_LOCK__";
  const TENANT_BOOT_LOCK_TIMEOUT_MS = 15000;
  const LOGIN_VIEW = "login";
  const TENANT_AGENT_SELECTOR_VIEW = "tenant-agent-selector";
  const ROOT_ONLY_TENANT_VIEWS = new Set([
    "platform-tenants",
    "platform-agent-assignment",
    "platform-data-sources",
    "platform-nodes",
    "tenant-members",
    "tenant-agent-assignment",
    "tenant-owned-agents",
    "tenant-usage-stats",
    "tenant-statistics-overview",
    "tenant-wallet",
    "tenant-wallet-orders",
    "tenant-wallet-ledger",
    "tenant-wallet-flow",
  ]);
  const RESPONSIVENESS_WARNINGS = new Set([
    "[openclaw] control-ui.long-animation-frame",
    "[openclaw] control-ui.longtask",
  ]);
  const DEBUG_WARNINGS = new Set(["[openclaw] control-ui.rpc"]);
  const RESPONSIVENESS_WARN_STATE_KEY = "__openclawControlUiResponsivenessWarnCounts";
  const DEBUG_WARN_STATE_KEY = "__openclawControlUiDebugWarnCounts";
  const RESPONSIVENESS_WARN_PATCH_FLAG = "__OPENCLAW_TENANT_PREBOOT_WARN_PATCHED__";
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

  const patchResponsivenessWarnings = () => {
    if (window[RESPONSIVENESS_WARN_PATCH_FLAG]) {
      return;
    }
    const originalWarn = console?.warn;
    if (typeof originalWarn !== "function") {
      return;
    }

    const counts =
      window[RESPONSIVENESS_WARN_STATE_KEY] &&
      typeof window[RESPONSIVENESS_WARN_STATE_KEY] === "object"
        ? window[RESPONSIVENESS_WARN_STATE_KEY]
        : Object.create(null);
    window[RESPONSIVENESS_WARN_STATE_KEY] = counts;
    const debugCounts =
      window[DEBUG_WARN_STATE_KEY] && typeof window[DEBUG_WARN_STATE_KEY] === "object"
        ? window[DEBUG_WARN_STATE_KEY]
        : Object.create(null);
    window[DEBUG_WARN_STATE_KEY] = debugCounts;

    try {
      const shouldSuppressRepeatedWarning = (message, store) => {
        const nextCount = Number(store[message] || 0) + 1;
        store[message] = nextCount;
        return nextCount > 1;
      };
      console.warn = (...args) => {
        const message = typeof args[0] === "string" ? args[0].trim() : "";
        if (RESPONSIVENESS_WARNINGS.has(message)) {
          if (shouldSuppressRepeatedWarning(message, counts)) {
            return;
          }
        }
        if (DEBUG_WARNINGS.has(message) && shouldSuppressRepeatedWarning(message, debugCounts)) {
          return;
        }
        return originalWarn.apply(console, args);
      };
      window[RESPONSIVENESS_WARN_PATCH_FLAG] = true;
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
    return { id: tenantAgentId };
  };

  const hasResolvedSelectedAgent = (agent) => {
    const tenantAgentId = String(agent?.id || "").trim();
    const agentId = String(agent?.agentId || agent?.baseAgentId || "").trim();
    return Boolean(tenantAgentId && agentId);
  };

  const isSelectorHostPath = (pathname) => {
    const normalized = normalizePath(pathname);
    return normalized === "/" || normalized.endsWith("/index.html");
  };

  const isTenantLoginRoute = (href = window.location.href) => {
    const url = new URL(href, document.baseURI);
    const view = (url.searchParams.get(TENANT_VIEW_QUERY_KEY)?.trim() || "").toLowerCase();
    return normalizePath(url.pathname) === "/login" || view === LOGIN_VIEW;
  };

  const isBootLockedRootView = (view) => ROOT_ONLY_TENANT_VIEWS.has(String(view || "").trim());

  const resolveTenantBootLockRouteKind = (href = window.location.href) => {
    try {
      const url = href instanceof URL ? href : new URL(href, document.baseURI);
      const pathname = normalizePath(url.pathname);
      const tenantSession = readTenantSession();
      const view = (url.searchParams.get(TENANT_VIEW_QUERY_KEY)?.trim() || "").toLowerCase();
      if (isTenantLoginRoute(url.href)) {
        return "login";
      }
      if (isMemberSelectorRoute(url.href, tenantSession)) {
        return "member-selector";
      }
      if (pathname === "/chat" && tenantSession?.session?.role === "member") {
        const selectedAgent = readSelectedTenantAgent(url.href);
        if (String(selectedAgent?.id || "").trim()) {
          return "member-chat";
        }
      }
      if (isSelectorHostPath(pathname) && isBootLockedRootView(view)) {
        return view;
      }
    } catch {
      return "";
    }
    return "";
  };

  const releaseTenantBootLock = (reason = "runtime-ready") => {
    const controller = window[TENANT_BOOT_LOCK_WINDOW_KEY];
    if (controller?.timeoutId) {
      window.clearTimeout(controller.timeoutId);
    }
    if (controller?.routeKind) {
      document.documentElement.removeAttribute(TENANT_BOOT_LOCK_ATTR);
    }
    window[TENANT_BOOT_LOCK_WINDOW_KEY] = {
      routeKind: "",
      timeoutId: 0,
      reason: String(reason || "runtime-ready").trim() || "runtime-ready",
      release: releaseTenantBootLock,
    };
  };

  const applyTenantBootLock = (href = window.location.href) => {
    const routeKind = resolveTenantBootLockRouteKind(href);
    if (!routeKind) {
      releaseTenantBootLock("route-not-locked");
      return "";
    }
    const previous = window[TENANT_BOOT_LOCK_WINDOW_KEY];
    if (previous?.timeoutId) {
      window.clearTimeout(previous.timeoutId);
    }
    document.documentElement.setAttribute(TENANT_BOOT_LOCK_ATTR, routeKind);
    const timeoutId = window.setTimeout(() => {
      releaseTenantBootLock("failsafe-timeout");
    }, TENANT_BOOT_LOCK_TIMEOUT_MS);
    window[TENANT_BOOT_LOCK_WINDOW_KEY] = {
      routeKind,
      timeoutId,
      release: releaseTenantBootLock,
    };
    return routeKind;
  };

  const isMemberSelectorRoute = (
    href = window.location.href,
    tenantSession = readTenantSession(),
  ) => {
    if (tenantSession?.session?.role !== "member") {
      return false;
    }
    const url = new URL(href, document.baseURI);
    return (
      isSelectorHostPath(url.pathname) &&
      (url.searchParams.get(TENANT_VIEW_QUERY_KEY)?.trim() || "") === TENANT_AGENT_SELECTOR_VIEW
    );
  };

  const buildMemberSelectorRouteUrl = () =>
    new URL(`./?${TENANT_VIEW_QUERY_KEY}=${TENANT_AGENT_SELECTOR_VIEW}`, document.baseURI);

  const buildTenantLoginRouteUrl = () =>
    new URL(`./?${TENANT_VIEW_QUERY_KEY}=${LOGIN_VIEW}`, document.baseURI);

  const buildRootTenantViewRouteUrl = (view) =>
    new URL(
      `./?${TENANT_VIEW_QUERY_KEY}=${encodeURIComponent(String(view || "").trim())}`,
      document.baseURI,
    );

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

  const normalizeSessionTitleValue = (value) => String(value ?? "").trim();

  const isGeneratedTimestampTitle = (value) => {
    const normalized = normalizeSessionTitleValue(value);
    if (!normalized) {
      return false;
    }
    return (
      /^\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized) ||
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(normalized)
    );
  };

  const isProvisionalSessionTitle = (value) => {
    const normalized = normalizeSessionTitleValue(value);
    if (!normalized) {
      return true;
    }
    return normalized === "新会话" || isGeneratedTimestampTitle(normalized);
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

  const readMemberDraftRouteLock = (session, selectedAgent) => {
    const cacheId = buildMemberSessionCacheId(session, selectedAgent);
    if (!cacheId) {
      return "";
    }
    const locks = readJson(safeStorage(window.sessionStorage), MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
    const candidate = locks && typeof locks === "object" ? locks[cacheId] : "";
    return isTenantMemberSessionKey(candidate, session, selectedAgent)
      ? normalizeTenantValue(candidate)
      : "";
  };

  const clearMemberDraftRouteLock = (session, selectedAgent) => {
    const cacheId = buildMemberSessionCacheId(session, selectedAgent);
    if (!cacheId) {
      return;
    }
    const storage = safeStorage(window.sessionStorage);
    const locks = readJson(storage, MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
    if (!locks || typeof locks !== "object" || !(cacheId in locks)) {
      return;
    }
    const next = { ...locks };
    delete next[cacheId];
    if (Object.keys(next).length > 0) {
      writeJson(storage, MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY, next);
    } else {
      storage?.removeItem(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
    }
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

  const readRegisteredMemberSessions = (session, selectedAgent) => {
    if (typeof XMLHttpRequest !== "function") {
      return [];
    }
    const tenantAgentId = String(selectedAgent?.id || "").trim();
    const token = String(session?.token || "").trim();
    if (!tenantAgentId || !token) {
      return [];
    }
    try {
      const request = new XMLHttpRequest();
      const url = new URL("/tenant-platform-api/v1/member/sessions", document.baseURI);
      url.searchParams.set("tenantAgentId", tenantAgentId);
      request.open("GET", url.toString(), false);
      request.setRequestHeader("Accept", "application/json");
      request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.send(null);
      if (request.status < 200 || request.status >= 300) {
        return [];
      }
      const payload = JSON.parse(String(request.responseText || "{}"));
      return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  };

  const readRegisteredMemberSessionKey = (session, selectedAgent, registeredRows = null) => {
    const rows = Array.isArray(registeredRows)
      ? registeredRows
      : readRegisteredMemberSessions(session, selectedAgent);
    try {
      const candidates = rows
        .filter((row) => !row?.hiddenAt)
        .map((row) => ({
          key: String(row?.openclawSessionKey || "").trim(),
          title: normalizeSessionTitleValue(row?.title),
          updatedAt: Date.parse(String(row?.updatedAt || "")) || 0,
        }))
        .filter(
          (row) =>
            row.key &&
            isTenantMemberSessionKey(row.key, session, selectedAgent) &&
            !isProvisionalSessionTitle(row.title),
        )
        .sort((left, right) => right.updatedAt - left.updatedAt);
      return candidates[0]?.key ? normalizeTenantValue(candidates[0].key) : "";
    } catch {
      return "";
    }
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

  const clearPersistedControlUiSession = (routeLike = window.location.href) => {
    const routeUrl =
      routeLike instanceof URL ? routeLike : new URL(routeLike, window.location.href);
    const proto = routeUrl.protocol === "https:" ? "wss" : "ws";
    const rootGatewayUrl = `${proto}://${routeUrl.host}`;
    const basePath = inferBasePathFromPathname(routeUrl.pathname);
    const gatewayScopeUrl = `${proto}://${routeUrl.host}${basePath}`;
    const rootScope = normalizeGatewayScope(rootGatewayUrl);
    const scope = normalizeGatewayScope(gatewayScopeUrl);
    const storage = safeStorage(window.localStorage);
    if (!storage) {
      return;
    }
    for (const key of new Set([
      buildSettingsStorageKey(rootGatewayUrl),
      buildSettingsStorageKey(gatewayScopeUrl),
    ])) {
      const existing = readJson(storage, key);
      if (!existing || typeof existing !== "object") {
        continue;
      }
      const next = { ...existing };
      delete next.sessionKey;
      delete next.lastActiveSessionKey;
      if (next.sessionsByGateway && typeof next.sessionsByGateway === "object") {
        const sessionsByGateway = { ...next.sessionsByGateway };
        for (const sessionScope of new Set([rootScope, scope])) {
          const scopedValue = sessionsByGateway[sessionScope];
          if (!scopedValue || typeof scopedValue !== "object") {
            continue;
          }
          const nextScopedValue = { ...scopedValue };
          delete nextScopedValue.sessionKey;
          delete nextScopedValue.lastActiveSessionKey;
          if (Object.keys(nextScopedValue).length > 0) {
            sessionsByGateway[sessionScope] = nextScopedValue;
          } else {
            delete sessionsByGateway[sessionScope];
          }
        }
        if (Object.keys(sessionsByGateway).length > 0) {
          next.sessionsByGateway = sessionsByGateway;
        } else {
          delete next.sessionsByGateway;
        }
      }
      if (Object.keys(next).length > 0) {
        storage.setItem(key, JSON.stringify(next));
      } else {
        storage.removeItem(key);
      }
    }
  };

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
    const normalizedPath = normalizePath(url.pathname);
    const targetTenantView = url.searchParams.get(TENANT_VIEW_QUERY_KEY)?.trim() || "";
    if (normalizedPath === "/chat" && targetTenantView === LOGIN_VIEW) {
      return buildTenantLoginRouteUrl();
    }
    if (normalizedPath === "/chat" && ROOT_ONLY_TENANT_VIEWS.has(targetTenantView)) {
      return buildRootTenantViewRouteUrl(targetTenantView);
    }
    if (normalizedPath !== "/chat") {
      return url;
    }
    const tenantSession = readTenantSession();
    const targetTenantAgentId = String(url.searchParams.get("tenantAgentId") || "").trim();
    if (tenantSession?.session?.role !== "member") {
      if (targetTenantAgentId) {
        return buildTenantLoginRouteUrl();
      }
      return url;
    }
    if (targetTenantView === TENANT_AGENT_SELECTOR_VIEW) {
      return buildMemberSelectorRouteUrl();
    }
    if (isMemberSelectorRoute(baseHref, tenantSession) && !targetTenantAgentId) {
      return buildMemberSelectorRouteUrl();
    }
    const selectedAgent = readSelectedTenantAgent(url.href);
    const tenantAgentId = String(selectedAgent?.id || "").trim();
    if (targetTenantAgentId && !hasResolvedSelectedAgent(selectedAgent)) {
      return buildMemberSelectorRouteUrl();
    }
    if (!tenantAgentId) {
      return url;
    }
    url.searchParams.set("tenantAgentId", tenantAgentId);
    if (targetTenantView === TENANT_AGENT_SELECTOR_VIEW) {
      url.searchParams.delete(TENANT_VIEW_QUERY_KEY);
    }
    const registeredRows = readRegisteredMemberSessions(tenantSession, selectedAgent);
    const querySessionKey = String(url.searchParams.get("session") || "").trim();
    const matchedRegisteredRow = registeredRows.find((row) => {
      const rowKey = normalizeTenantValue(row?.openclawSessionKey);
      return rowKey && rowKey === normalizeTenantValue(querySessionKey);
    });
    const shouldDiscardProvisionalQuerySession =
      matchedRegisteredRow &&
      !matchedRegisteredRow?.hiddenAt &&
      isProvisionalSessionTitle(matchedRegisteredRow?.title);
    if (shouldDiscardProvisionalQuerySession) {
      url.searchParams.delete("session");
    }
    if (!hasResolvedSelectedAgent(selectedAgent)) {
      url.searchParams.delete("session");
      return url;
    }
    const draftRouteLock = readMemberDraftRouteLock(tenantSession, selectedAgent);
    if (draftRouteLock) {
      const effectiveQuerySessionKey = String(url.searchParams.get("session") || "").trim();
      const normalizedQuerySessionKey = normalizeTenantValue(effectiveQuerySessionKey);
      if (!effectiveQuerySessionKey || normalizedQuerySessionKey === draftRouteLock) {
        url.searchParams.delete("session");
        return url;
      }
      clearMemberDraftRouteLock(tenantSession, selectedAgent);
    }
    const effectiveQuerySessionKey = String(url.searchParams.get("session") || "").trim();
    const shouldRespectBlankRuntimeSession =
      window.__openclawMemberChatSurfaceBooted === true &&
      !effectiveQuerySessionKey &&
      normalizePath(url.pathname) === "/chat";
    if (shouldRespectBlankRuntimeSession) {
      return url;
    }
    const sessionKey = isTenantMemberSessionKey(
      effectiveQuerySessionKey,
      tenantSession,
      selectedAgent,
    )
      ? normalizeTenantValue(effectiveQuerySessionKey)
      : readCachedMemberSessionKey(tenantSession, selectedAgent) ||
        readRegisteredMemberSessionKey(tenantSession, selectedAgent, registeredRows);

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

  patchResponsivenessWarnings();
  document.documentElement.setAttribute("data-oc-tenant-preboot", "true");

  const currentHref = new URL(window.location.href, window.location.href);
  const normalizedCurrent = resolveMemberRouteUrl(currentHref, currentHref.href);
  if (normalizedCurrent.href !== currentHref.href) {
    window.history.replaceState({}, "", normalizedCurrent.toString());
  }
  if (isMemberSelectorRoute(normalizedCurrent, readTenantSession())) {
    clearPersistedControlUiSession(normalizedCurrent);
  }
  persistRouteState(normalizedCurrent);
  applyTenantBootLock(normalizedCurrent);

  if (!window.__OPENCLAW_TENANT_PREBOOT_HISTORY_PATCHED__) {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalPushState = window.history.pushState.bind(window.history);

    const wrap = (original) => (state, unused, url) => {
      if (url == null) {
        const result = original(state, unused, url);
        applyTenantBootLock(window.location.href);
        return result;
      }
      const normalized = resolveMemberRouteUrl(url, window.location.href);
      if (isMemberSelectorRoute(normalized, readTenantSession())) {
        clearPersistedControlUiSession(normalized);
      }
      persistRouteState(normalized);
      const result = original(state, unused, normalized.toString());
      applyTenantBootLock(normalized);
      return result;
    };

    window.history.replaceState = wrap(originalReplaceState);
    window.history.pushState = wrap(originalPushState);
    window.__OPENCLAW_TENANT_PREBOOT_HISTORY_PATCHED__ = true;
  }

  if (!window.__OPENCLAW_TENANT_PREBOOT_POPSTATE_PATCHED__) {
    const syncBootLockFromLocation = () => {
      applyTenantBootLock(window.location.href);
    };
    window.addEventListener("popstate", syncBootLockFromLocation);
    window.addEventListener("hashchange", syncBootLockFromLocation);
    window.__OPENCLAW_TENANT_PREBOOT_POPSTATE_PATCHED__ = true;
  }
})();

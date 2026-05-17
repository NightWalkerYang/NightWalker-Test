import { navigateTenantRoute } from "./route-sync.js";

const PLATFORM_SESSION_STORAGE_KEY = "openclaw:tenant-platform:platform-session:v1";
const TENANT_SESSION_STORAGE_KEY = "openclaw:tenant-platform:tenant-session:v1";
const API_BASE_STORAGE_KEY = "openclaw:tenant-platform:api-base:v1";
const TENANT_SELECTED_AGENT_STORAGE_KEY = "openclaw:tenant-platform:selected-agent:v1";
const TENANT_VIEW_QUERY_KEY = "ocTenantView";
const TENANT_BOOT_LOCK_GLOBAL_KEY = "__OPENCLAW_TENANT_BOOT_LOCK__";
export const TENANT_BOOT_LOCK_ATTR = "data-oc-tenant-boot-lock";
const LOGIN_PATHNAME = "/login";
export const LOGIN_VIEW = "login";
export const PLATFORM_LOGIN_VIEW = "platform-login";
export const TENANT_LOGIN_VIEW = "tenant-login";
export const PLATFORM_TENANTS_VIEW = "platform-tenants";
// Keep the older name as an alias so newer/older tenant runtime modules can coexist
// without breaking the whole zero-intrusive module graph during incremental upgrades.
export const PLATFORM_TENANT_MANAGEMENT_VIEW = PLATFORM_TENANTS_VIEW;
export const PLATFORM_AGENT_ASSIGNMENT_VIEW = "platform-agent-assignment";
export const PLATFORM_DATA_SOURCES_VIEW = "platform-data-sources";
export const PLATFORM_NODE_MANAGEMENT_VIEW = "platform-nodes";
export const PLATFORM_SKILLS_VIEW = "platform-skills";
export const TENANT_MEMBERS_VIEW = "tenant-members";
export const TENANT_AGENT_ASSIGNMENT_VIEW = "tenant-agent-assignment";
export const TENANT_OWNED_AGENTS_VIEW = "tenant-owned-agents";
export const TENANT_USAGE_STATS_VIEW = "tenant-usage-stats";
export const TENANT_STATISTICS_OVERVIEW_VIEW = "tenant-statistics-overview";
export const TENANT_WALLET_VIEW = "tenant-wallet";
export const TENANT_WALLET_ORDERS_VIEW = "tenant-wallet-orders";
export const TENANT_WALLET_LEDGER_VIEW = "tenant-wallet-ledger";
export const TENANT_WALLET_FLOW_VIEW = "tenant-wallet-flow";
export const TENANT_SKILLS_MARKET_VIEW = "tenant-skills-market";
export const TENANT_SKILLS_OWNED_VIEW = "tenant-skills-owned";
export const TENANT_SKILLS_WORKBENCH_VIEW = "tenant-skills-workbench";
export const TENANT_SKILLS_ENTITLEMENTS_VIEW = "tenant-skills-entitlements";
export const TENANT_SKILLS_ASSIGNMENTS_VIEW = "tenant-skills-assignments";
export const TENANT_AGENT_SELECTOR_VIEW = "tenant-agent-selector";
export const TENANT_WALLET_SUMMARY_EVENT = "openclaw:tenant-wallet-summary";
export const LOGIN_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${LOGIN_VIEW}`;
export const PLATFORM_LOGIN_ROUTE = LOGIN_ROUTE;
export const TENANT_LOGIN_ROUTE = LOGIN_ROUTE;
export const PLATFORM_TENANT_MANAGEMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_TENANTS_VIEW}`;
export const PLATFORM_AGENT_ASSIGNMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`;
export const PLATFORM_DATA_SOURCES_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_DATA_SOURCES_VIEW}`;
export const PLATFORM_NODE_MANAGEMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_NODE_MANAGEMENT_VIEW}`;
export const PLATFORM_SKILLS_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_SKILLS_VIEW}`;
export const TENANT_MEMBER_MANAGEMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_MEMBERS_VIEW}`;
export const TENANT_AGENT_ASSIGNMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_AGENT_ASSIGNMENT_VIEW}`;
export const TENANT_OWNED_AGENTS_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_OWNED_AGENTS_VIEW}`;
export const TENANT_USAGE_STATS_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_USAGE_STATS_VIEW}`;
export const TENANT_STATISTICS_OVERVIEW_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_STATISTICS_OVERVIEW_VIEW}`;
export const TENANT_WALLET_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_WALLET_VIEW}`;
export const TENANT_WALLET_ORDERS_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_WALLET_ORDERS_VIEW}`;
export const TENANT_WALLET_LEDGER_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_WALLET_LEDGER_VIEW}`;
export const TENANT_WALLET_FLOW_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_WALLET_FLOW_VIEW}`;
export const TENANT_SKILLS_MARKET_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_SKILLS_MARKET_VIEW}`;
export const TENANT_SKILLS_OWNED_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_SKILLS_OWNED_VIEW}`;
export const TENANT_SKILLS_WORKBENCH_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_SKILLS_WORKBENCH_VIEW}`;
export const TENANT_SKILLS_ENTITLEMENTS_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_SKILLS_ENTITLEMENTS_VIEW}`;
export const TENANT_SKILLS_ASSIGNMENTS_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_SKILLS_ASSIGNMENTS_VIEW}`;
export const TENANT_AGENT_SELECTOR_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_AGENT_SELECTOR_VIEW}`;

function normalizeTenantSessionValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredSession(key) {
  try {
    const raw = safeStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(key, session) {
  safeStorage()?.setItem(key, JSON.stringify(session));
}

function clearStoredSession(key) {
  safeStorage()?.removeItem(key);
}

function readTenantBootLockController() {
  const controller = window[TENANT_BOOT_LOCK_GLOBAL_KEY];
  return controller && typeof controller === "object" ? controller : null;
}

export function readPlatformSession() {
  return readStoredSession(PLATFORM_SESSION_STORAGE_KEY);
}

export function readTenantSession() {
  return readStoredSession(TENANT_SESSION_STORAGE_KEY);
}

export function isTenantShellRole(role) {
  return role === "platform_admin" || role === "tenant_admin" || role === "member";
}

export function normalizeTenantPathname(pathname = window.location.pathname) {
  const raw = String(pathname ?? "").trim() || "/";
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutIndex = prefixed.replace(/\/index\.html$/i, "");
  if (withoutIndex.length > 1 && withoutIndex.endsWith("/")) {
    return withoutIndex.slice(0, -1);
  }
  return withoutIndex;
}

export function isTenantPathActive(expectedPath, pathname = window.location.pathname) {
  const normalizedExpected = normalizeTenantPathname(expectedPath);
  const normalizedCurrent = normalizeTenantPathname(pathname);
  return normalizedCurrent === normalizedExpected || normalizedCurrent.endsWith(normalizedExpected);
}

export function readSessionForCurrentView(locationHref = window.location.href) {
  const view = readTenantView(locationHref);
  if (view === LOGIN_VIEW) {
    return readPlatformSession() || readTenantSession();
  }
  if (
    view === PLATFORM_LOGIN_VIEW ||
    view === PLATFORM_TENANTS_VIEW ||
    view === PLATFORM_AGENT_ASSIGNMENT_VIEW ||
    view === PLATFORM_DATA_SOURCES_VIEW ||
    view === PLATFORM_NODE_MANAGEMENT_VIEW ||
    view === PLATFORM_SKILLS_VIEW
  ) {
    return readPlatformSession();
  }
  if (view === TENANT_LOGIN_VIEW) {
    return readTenantSession();
  }
  if (
    view === TENANT_MEMBERS_VIEW ||
    view === TENANT_AGENT_ASSIGNMENT_VIEW ||
    view === TENANT_OWNED_AGENTS_VIEW ||
    view === TENANT_USAGE_STATS_VIEW ||
    view === TENANT_STATISTICS_OVERVIEW_VIEW ||
    view === TENANT_WALLET_VIEW ||
    view === TENANT_WALLET_ORDERS_VIEW ||
    view === TENANT_WALLET_LEDGER_VIEW ||
    view === TENANT_WALLET_FLOW_VIEW ||
    view === TENANT_SKILLS_MARKET_VIEW ||
    view === TENANT_SKILLS_OWNED_VIEW ||
    view === TENANT_SKILLS_WORKBENCH_VIEW ||
    view === TENANT_SKILLS_ENTITLEMENTS_VIEW ||
    view === TENANT_SKILLS_ASSIGNMENTS_VIEW ||
    view === TENANT_AGENT_SELECTOR_VIEW
  ) {
    return readTenantSession();
  }
  return readPlatformSession() || readTenantSession();
}

export function readTenantShellContext(locationHref = window.location.href) {
  const view = readTenantView(locationHref);
  const session = readSessionForCurrentView(locationHref);
  const role = String(session?.session?.role || "").trim();
  return {
    view,
    session,
    role,
    isAuthView: isTenantLoginView(view),
    isShellRole: isTenantShellRole(role),
  };
}

export function writeTenantSession(session) {
  if (session?.session?.role === "platform_admin") {
    writeStoredSession(PLATFORM_SESSION_STORAGE_KEY, session);
    return;
  }
  writeStoredSession(TENANT_SESSION_STORAGE_KEY, session);
}

export function clearTenantSession() {
  clearStoredSession(TENANT_SESSION_STORAGE_KEY);
}

export function clearPlatformSession() {
  clearStoredSession(PLATFORM_SESSION_STORAGE_KEY);
}

export function releaseTenantBootLock(reason = "runtime-ready") {
  const normalizedReason = String(reason || "runtime-ready").trim() || "runtime-ready";
  const controller = readTenantBootLockController();
  if (typeof controller?.release === "function") {
    controller.release(normalizedReason);
    return;
  }
  document.documentElement.removeAttribute(TENANT_BOOT_LOCK_ATTR);
}

function normalizeTenantApiBaseOverride(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\/$/, "");
  if (!normalized) {
    return "";
  }
  try {
    const url = new URL(normalized, document.baseURI);
    // Older proxy-fronted builds could persist a direct sidecar base such as
    // http://host:18801 or http://host:18801/tenant-platform-api/v1. Keep healing
    // that stale state so browsers stop retrying a CSP-blocked cross-port path
    // on proxy-fronted deployments and fall back to the working same-origin
    // proxy route.
    if (
      url.port === "18801" &&
      (!url.pathname ||
        url.pathname === "/" ||
        /^\/tenant-platform-api\/v1(?:\/.*)?$/i.test(url.pathname))
    ) {
      return "";
    }
  } catch {
    return normalized;
  }
  return normalized;
}

export function readTenantApiBaseOverride() {
  const storage = safeStorage();
  const raw = storage?.getItem(API_BASE_STORAGE_KEY) || "";
  const normalized = normalizeTenantApiBaseOverride(raw);
  if (raw && !normalized) {
    storage?.removeItem(API_BASE_STORAGE_KEY);
  }
  if (raw && normalized && raw !== normalized) {
    storage?.setItem(API_BASE_STORAGE_KEY, normalized);
  }
  return normalized;
}

export function writeTenantApiBaseOverride(value) {
  const normalized = normalizeTenantApiBaseOverride(value);
  if (!normalized) {
    safeStorage()?.removeItem(API_BASE_STORAGE_KEY);
    return;
  }
  safeStorage()?.setItem(API_BASE_STORAGE_KEY, normalized);
}

export function resolveTenantApiBaseUrl() {
  return resolveTenantApiBaseCandidates()[0] || "/tenant-platform-api/v1";
}

export function resolveTenantApiBaseCandidates() {
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (value) => {
    const normalized = String(value || "")
      .trim()
      .replace(/\/$/, "");
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  const fromStorage = readTenantApiBaseOverride();
  if (fromStorage) {
    pushCandidate(fromStorage);
  }

  const meta = document.querySelector('meta[name="oc-tenant-api-base"]');
  const fromMeta = meta?.getAttribute("content")?.trim();
  if (fromMeta) {
    pushCandidate(fromMeta);
  }

  // Proxy-fronted deployments must stay same-origin here. Guessing cross-port
  // sidecar URLs causes browser CSP connect-src violations before we ever reach
  // the working `/tenant-platform-api/v1` proxy path.
  pushCandidate("/tenant-platform-api/v1");
  return candidates;
}

function normalizePathname(pathname) {
  const normalized = String(pathname || "").trim();
  if (!normalized) {
    return "/";
  }
  return normalized.replace(/\/+$/, "") || "/";
}

function normalizeGatewayScope(gatewayUrl) {
  const trimmed = String(gatewayUrl || "").trim();
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

function inferBasePathFromPathname(pathname) {
  let normalized = normalizeTenantPathname(pathname);
  if (normalized === "/") {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
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
  for (let index = 0; index < segments.length; index += 1) {
    const candidate = `/${segments.slice(index).join("/")}`.toLowerCase();
    if (controlUiTabPaths.has(candidate)) {
      const prefix = segments.slice(0, index);
      return prefix.length > 0 ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

function buildSettingsStorageKey(gatewayUrl) {
  return `openclaw.control.settings.v1:${normalizeGatewayScope(gatewayUrl)}`;
}

export function readTenantView(locationHref = window.location.href) {
  const url = new URL(locationHref, document.baseURI);
  if (normalizePathname(url.pathname) === LOGIN_PATHNAME) {
    return LOGIN_VIEW;
  }
  return url.searchParams.get(TENANT_VIEW_QUERY_KEY)?.trim() || "";
}

export function clearTenantViewFromHref(href) {
  const url = new URL(href, document.baseURI);
  url.searchParams.delete(TENANT_VIEW_QUERY_KEY);
  return url.href;
}

export function routeForRole(role) {
  if (role === "platform_admin") {
    return PLATFORM_TENANT_MANAGEMENT_ROUTE;
  }
  if (role === "tenant_admin") {
    return TENANT_STATISTICS_OVERVIEW_ROUTE;
  }
  return TENANT_AGENT_SELECTOR_ROUTE;
}

export function readSelectedTenantAgent(locationHref = window.location.href) {
  const url = new URL(locationHref, document.baseURI);
  const tenantAgentId = url.searchParams.get("tenantAgentId")?.trim() || "";
  const stored = readStoredSession(TENANT_SELECTED_AGENT_STORAGE_KEY);
  if (!tenantAgentId) {
    return stored;
  }
  if (stored?.id === tenantAgentId) {
    return stored;
  }
  if (stored && typeof stored === "object") {
    return {
      ...stored,
      id: tenantAgentId,
    };
  }
  return { id: tenantAgentId };
}

export function hasResolvedSelectedTenantAgent(agent) {
  const tenantAgentId = String(agent?.id || "").trim();
  const agentId = String(agent?.agentId || agent?.baseAgentId || "").trim();
  return Boolean(tenantAgentId && agentId);
}

export function readSelectedTenantAgentId(locationHref = window.location.href) {
  return readSelectedTenantAgent(locationHref)?.id?.trim() || "";
}

export function writeSelectedTenantAgent(agent) {
  if (!agent || typeof agent !== "object") {
    clearStoredSession(TENANT_SELECTED_AGENT_STORAGE_KEY);
    return;
  }
  writeStoredSession(TENANT_SELECTED_AGENT_STORAGE_KEY, {
    id: String(agent.id || "").trim(),
    agentId: String(agent.agentId || "").trim(),
    baseAgentId: String(agent.baseAgentId || agent.agentId || "").trim(),
    agentName: String(agent.agentName || "").trim(),
    balancePoints: Number(agent.balancePoints || 0),
    status: String(agent.status || "").trim(),
    avatar: agent.avatar || null,
    emoji: agent.emoji || null,
    description: String(agent.description || "").trim(),
  });
}

export function clearSelectedTenantAgent() {
  clearStoredSession(TENANT_SELECTED_AGENT_STORAGE_KEY);
}

export function clearPersistedControlUiSession(routeLike = window.location.href) {
  const routeUrl = routeLike instanceof URL ? routeLike : new URL(routeLike, window.location.href);
  const proto = routeUrl.protocol === "https:" ? "wss" : "ws";
  const rootGatewayUrl = `${proto}://${routeUrl.host}`;
  const basePath = inferBasePathFromPathname(routeUrl.pathname);
  const gatewayScopeUrl = `${proto}://${routeUrl.host}${basePath}`;
  const rootScope = normalizeGatewayScope(rootGatewayUrl);
  const scope = normalizeGatewayScope(gatewayScopeUrl);
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  for (const key of new Set([
    buildSettingsStorageKey(rootGatewayUrl),
    buildSettingsStorageKey(gatewayScopeUrl),
  ])) {
    const existing = readStoredSession(key);
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
      safeStorage()?.setItem(key, JSON.stringify(next));
    } else {
      safeStorage()?.removeItem(key);
    }
  }
}

export function clearOpenClawChatState(app) {
  if (!(app instanceof HTMLElement)) {
    return false;
  }
  app.sessionKey = "";
  app.chatMessages = [];
  app.chatQueue = [];
  app.chatLoading = false;
  app.chatRunId = null;
  app.chatStream = null;
  app.chatStreamStartedAt = null;
  app.lastError = null;
  app.chatToolMessages = [];
  app.chatStreamSegments = [];
  app.chatSending = false;
  delete app.__ocPinnedSessionKey;
  delete app.__ocPinnedSessionHydratedKey;
  delete app.__ocPinnedSessionHydratingKey;
  if (typeof app.resetToolStream === "function") {
    app.resetToolStream();
  }
  if (typeof app.resetChatScroll === "function") {
    app.resetChatScroll();
  }
  if (typeof app.requestUpdate === "function") {
    app.requestUpdate();
  }
  return true;
}

export function buildTenantMemberChatRoute(tenantAgentId, sessionKey = "") {
  const url = new URL("./chat", document.baseURI);
  const normalized = String(tenantAgentId || "").trim();
  if (normalized) {
    url.searchParams.set("tenantAgentId", normalized);
  }
  const normalizedSessionKey = String(sessionKey || "").trim();
  if (normalizedSessionKey) {
    url.searchParams.set("session", normalizedSessionKey);
  }
  return url.href;
}

export function buildTenantMemberLegacySessionKey(selectedAgent) {
  const agentId = resolveTenantSessionAgentIds(selectedAgent)[0];
  const tenantAgentId = normalizeTenantSessionValue(selectedAgent?.id);
  if (!agentId || !tenantAgentId) {
    return "";
  }
  return `agent:${agentId}:tenant-${tenantAgentId}`;
}

export function buildTenantMemberLegacySessionKeys(selectedAgent) {
  const tenantAgentId = normalizeTenantSessionValue(selectedAgent?.id);
  if (!tenantAgentId) {
    return [];
  }
  return resolveTenantSessionAgentIds(selectedAgent).map(
    (agentId) => `agent:${agentId}:tenant-${tenantAgentId}`,
  );
}

function resolveTenantSessionAgentIds(selectedAgent) {
  const primary = normalizeTenantSessionValue(selectedAgent?.agentId);
  const base = normalizeTenantSessionValue(selectedAgent?.baseAgentId);
  const values = [];
  if (primary) {
    values.push(primary);
  }
  if (base && base !== primary) {
    values.push(base);
  }
  return values;
}

export function buildTenantMemberSessionPrefix(session, selectedAgent, explicitAgentId = "") {
  const agentId =
    normalizeTenantSessionValue(explicitAgentId) || resolveTenantSessionAgentIds(selectedAgent)[0];
  const tenantId = normalizeTenantSessionValue(session?.session?.tenantId);
  const userId = normalizeTenantSessionValue(session?.session?.userId);
  const tenantAgentId = normalizeTenantSessionValue(selectedAgent?.id);
  if (!agentId || !tenantId || !userId || !tenantAgentId) {
    return "";
  }
  return `agent:${agentId}:tenant:${tenantId}:tenant-agent:${tenantAgentId}:user:${userId}:chat:`;
}

export function isTenantMemberSessionKey(sessionKey, session, selectedAgent) {
  const normalizedSessionKey = normalizeTenantSessionValue(sessionKey);
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
}

export function createTenantMemberSessionKey(session, selectedAgent) {
  const prefix = buildTenantMemberSessionPrefix(session, selectedAgent);
  if (!prefix) {
    return "";
  }
  const randomPart =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID().toLowerCase()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}${randomPart}`;
}

export function isLocalEditionSession(session) {
  return session?.session?.edition === "local";
}

export function isManagedNodeSession(session) {
  return session?.session?.nodeRole === "managed-node";
}

export function isReadonlySession(session) {
  return Boolean(session?.session?.readonly);
}

export function isTenantLoginView(view = readTenantView()) {
  return view === LOGIN_VIEW || view === PLATFORM_LOGIN_VIEW || view === TENANT_LOGIN_VIEW;
}

export function redirectToRoleHome(session) {
  navigateTenantRoute(routeForRole(session?.role), { replace: true });
}

export function requireTenantSession(allowedRoles, options = {}) {
  const expectPlatformOnly =
    Array.isArray(allowedRoles) &&
    allowedRoles.length === 1 &&
    allowedRoles[0] === "platform_admin";
  const session = expectPlatformOnly ? readPlatformSession() : readTenantSession();
  const loginHref =
    options.loginHref || (expectPlatformOnly ? PLATFORM_LOGIN_ROUTE : TENANT_LOGIN_ROUTE);
  if (!session?.token || !session?.session?.role) {
    navigateTenantRoute(loginHref, { replace: true });
    return null;
  }
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.session.role)) {
    navigateTenantRoute(routeForRole(session.session.role), { replace: true });
    return null;
  }
  return session;
}

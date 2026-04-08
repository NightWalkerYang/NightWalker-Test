const PLATFORM_SESSION_STORAGE_KEY = "openclaw:tenant-platform:platform-session:v1";
const TENANT_SESSION_STORAGE_KEY = "openclaw:tenant-platform:tenant-session:v1";
const API_BASE_STORAGE_KEY = "openclaw:tenant-platform:api-base:v1";
const TENANT_SELECTED_AGENT_STORAGE_KEY = "openclaw:tenant-platform:selected-agent:v1";
const TENANT_VIEW_QUERY_KEY = "ocTenantView";
export const PLATFORM_LOGIN_VIEW = "platform-login";
export const TENANT_LOGIN_VIEW = "tenant-login";
export const PLATFORM_TENANTS_VIEW = "platform-tenants";
// Keep the older name as an alias so newer/older tenant runtime modules can coexist
// without breaking the whole zero-intrusive module graph during incremental upgrades.
export const PLATFORM_TENANT_MANAGEMENT_VIEW = PLATFORM_TENANTS_VIEW;
export const PLATFORM_AGENT_ASSIGNMENT_VIEW = "platform-agent-assignment";
export const TENANT_MEMBERS_VIEW = "tenant-members";
export const TENANT_AGENT_ASSIGNMENT_VIEW = "tenant-agent-assignment";
export const TENANT_AGENT_SELECTOR_VIEW = "tenant-agent-selector";
export const PLATFORM_LOGIN_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_LOGIN_VIEW}`;
export const TENANT_LOGIN_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_LOGIN_VIEW}`;
export const PLATFORM_TENANT_MANAGEMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_TENANTS_VIEW}`;
export const PLATFORM_AGENT_ASSIGNMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`;
export const TENANT_MEMBER_MANAGEMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_MEMBERS_VIEW}`;
export const TENANT_AGENT_ASSIGNMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_AGENT_ASSIGNMENT_VIEW}`;
export const TENANT_AGENT_SELECTOR_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_AGENT_SELECTOR_VIEW}`;

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

export function readPlatformSession() {
  return readStoredSession(PLATFORM_SESSION_STORAGE_KEY);
}

export function readTenantSession() {
  return readStoredSession(TENANT_SESSION_STORAGE_KEY);
}

export function readSessionForCurrentView(pathname = window.location.pathname) {
  const view = readTenantView();
  if (
    view === PLATFORM_LOGIN_VIEW ||
    view === PLATFORM_TENANTS_VIEW ||
    view === PLATFORM_AGENT_ASSIGNMENT_VIEW
  ) {
    return readPlatformSession();
  }
  if (view === TENANT_LOGIN_VIEW) {
    return readTenantSession();
  }
  if (
    view === TENANT_MEMBERS_VIEW ||
    view === TENANT_AGENT_ASSIGNMENT_VIEW ||
    view === TENANT_AGENT_SELECTOR_VIEW
  ) {
    return readTenantSession();
  }
  return readPlatformSession() || readTenantSession();
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

export function readTenantApiBaseOverride() {
  return safeStorage()?.getItem(API_BASE_STORAGE_KEY)?.trim() || "";
}

export function writeTenantApiBaseOverride(value) {
  const normalized = String(value || "").trim();
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
    const normalized = String(value || "").trim().replace(/\/$/, "");
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

  if (window.location.protocol === "http:" && window.location.port === "18789") {
    pushCandidate(`${window.location.protocol}//${window.location.hostname}:18801/tenant-platform-api/v1`);
    pushCandidate(`${window.location.protocol}//127.0.0.1:18801/tenant-platform-api/v1`);
    pushCandidate(`${window.location.protocol}//localhost:18801/tenant-platform-api/v1`);
  }

  pushCandidate("/tenant-platform-api/v1");
  return candidates;
}

export function readTenantView(locationHref = window.location.href) {
  const url = new URL(locationHref, document.baseURI);
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
    return TENANT_MEMBER_MANAGEMENT_ROUTE;
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
  return {
    ...(stored && typeof stored === "object" ? stored : {}),
    id: tenantAgentId,
  };
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

export function buildTenantMemberChatRoute(tenantAgentId) {
  const url = new URL("./chat", document.baseURI);
  const normalized = String(tenantAgentId || "").trim();
  if (normalized) {
    url.searchParams.set("tenantAgentId", normalized);
  }
  return url.href;
}

export function isLocalEditionSession(session) {
  return session?.session?.edition === "local";
}

export function isReadonlySession(session) {
  return Boolean(session?.session?.readonly);
}

export function redirectToRoleHome(session) {
  window.location.href = routeForRole(session?.role);
}

export function requireTenantSession(allowedRoles, options = {}) {
  const expectPlatformOnly =
    Array.isArray(allowedRoles) &&
    allowedRoles.length === 1 &&
    allowedRoles[0] === "platform_admin";
  const session = expectPlatformOnly ? readPlatformSession() : readTenantSession();
  const loginHref = options.loginHref || (expectPlatformOnly ? PLATFORM_LOGIN_ROUTE : TENANT_LOGIN_ROUTE);
  if (!session?.token || !session?.session?.role) {
    window.location.href = loginHref;
    return null;
  }
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.session.role)) {
    window.location.href = routeForRole(session.session.role);
    return null;
  }
  return session;
}

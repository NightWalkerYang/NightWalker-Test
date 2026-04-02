const SESSION_STORAGE_KEY = "openclaw:tenant-platform:session:v1";
const API_BASE_STORAGE_KEY = "openclaw:tenant-platform:api-base:v1";
const TENANT_VIEW_QUERY_KEY = "ocTenantView";
export const PLATFORM_LOGIN_VIEW = "platform-login";
export const TENANT_LOGIN_VIEW = "tenant-login";
export const PLATFORM_TENANTS_VIEW = "platform-tenants";
// Keep the older name as an alias so newer/older tenant runtime modules can coexist
// without breaking the whole zero-intrusive module graph during incremental upgrades.
export const PLATFORM_TENANT_MANAGEMENT_VIEW = PLATFORM_TENANTS_VIEW;
export const PLATFORM_AGENT_ASSIGNMENT_VIEW = "platform-agent-assignment";
export const PLATFORM_LOGIN_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_LOGIN_VIEW}`;
export const TENANT_LOGIN_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${TENANT_LOGIN_VIEW}`;
export const PLATFORM_TENANT_MANAGEMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_TENANTS_VIEW}`;
export const PLATFORM_AGENT_ASSIGNMENT_ROUTE = `./?${TENANT_VIEW_QUERY_KEY}=${PLATFORM_AGENT_ASSIGNMENT_VIEW}`;

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTenantSession() {
  try {
    const raw = safeStorage()?.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeTenantSession(session) {
  safeStorage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearTenantSession() {
  safeStorage()?.removeItem(SESSION_STORAGE_KEY);
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
  const fromStorage = readTenantApiBaseOverride();
  if (fromStorage) {
    return fromStorage;
  }

  const meta = document.querySelector('meta[name="oc-tenant-api-base"]');
  const fromMeta = meta?.getAttribute("content")?.trim();
  if (fromMeta) {
    return fromMeta;
  }

  if (window.location.protocol === "http:" && window.location.port === "18789") {
    return `${window.location.protocol}//${window.location.hostname}:18801/tenant-platform-api/v1`;
  }

  return "/tenant-platform-api/v1";
}

export function readTenantView(locationHref = window.location.href) {
  const url = new URL(locationHref, document.baseURI);
  return url.searchParams.get(TENANT_VIEW_QUERY_KEY)?.trim() || "";
}

export function routeForRole(role) {
  if (role === "platform_admin") {
    return PLATFORM_TENANT_MANAGEMENT_ROUTE;
  }
  if (role === "tenant_admin") {
    return "./tenant-admin.html";
  }
  return "./tenant-agent-selector.html";
}

export function redirectToRoleHome(session) {
  window.location.href = routeForRole(session?.role);
}

export function requireTenantSession(allowedRoles, options = {}) {
  const session = readTenantSession();
  const loginHref = options.loginHref || TENANT_LOGIN_ROUTE;
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

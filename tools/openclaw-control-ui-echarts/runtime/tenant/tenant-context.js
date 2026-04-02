const SESSION_STORAGE_KEY = "openclaw:tenant-platform:session:v1";
const API_BASE_STORAGE_KEY = "openclaw:tenant-platform:api-base:v1";
export const PLATFORM_LOGIN_ROUTE = "./platform-login.html";
export const TENANT_LOGIN_ROUTE = "./tenant-login.html";

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

export function routeForRole(role) {
  if (role === "platform_admin") {
    return "./platform-tenant-console.html";
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

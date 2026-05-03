import { mountTenantLoginPage } from "./login-page.js";
import { bootTenantRouteSync, navigateTenantRoute, onTenantRouteChange } from "./route-sync.js";
import {
  buildTenantMemberChatRoute,
  isTenantLoginView,
  isTenantMemberSessionKey,
  readPlatformSession,
  readSelectedTenantAgent,
  readTenantSession,
  readTenantView,
  routeForRole,
} from "./tenant-context.js";

const ROOT_ATTR = "data-oc-tenant-auth-root";
const ACTIVE_ATTR = "data-oc-tenant-auth-active";
const STYLE_ATTR = "data-oc-tenant-auth-style";

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./auth-surface.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function ensureRoot() {
  let root = document.querySelector(`[${ROOT_ATTR}]`);
  if (root instanceof HTMLElement) {
    root.replaceChildren();
    return root;
  }
  root = document.createElement("main");
  root.setAttribute(ROOT_ATTR, "true");
  root.className = "oc-tenant-auth-root";
  document.body.append(root);
  return root;
}

function clearAuthSurface() {
  document.body.removeAttribute(ACTIVE_ATTR);
  document.querySelector(`[${ROOT_ATTR}]`)?.remove();
  document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
}

function normalizePathname(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function recoverAuthenticatedChatRoute(view = readTenantView()) {
  if (!isTenantLoginView(view) || normalizePathname() !== "/chat") {
    return false;
  }
  const tenantSession = readTenantSession();
  if (tenantSession?.token && tenantSession?.session?.role === "member") {
    const selectedAgent = readSelectedTenantAgent(window.location.href);
    if (selectedAgent?.id) {
      const url = new URL(window.location.href);
      const rawSessionKey = String(url.searchParams.get("session") || "").trim();
      const sessionKey = isTenantMemberSessionKey(rawSessionKey, tenantSession, selectedAgent)
        ? rawSessionKey
        : "";
      navigateTenantRoute(buildTenantMemberChatRoute(selectedAgent.id, sessionKey), {
        replace: true,
      });
    } else {
      navigateTenantRoute(routeForRole("member"), { replace: true });
    }
    return true;
  }
  if (tenantSession?.token && tenantSession?.session?.role) {
    navigateTenantRoute(routeForRole(tenantSession.session.role), { replace: true });
    return true;
  }
  const platformSession = readPlatformSession();
  if (platformSession?.token && platformSession?.session?.role === "platform_admin") {
    navigateTenantRoute(routeForRole(platformSession.session.role), { replace: true });
    return true;
  }
  return false;
}

let authSurfaceSyncing = false;
let authSurfaceSyncQueued = false;
let authSurfaceRouteCleanup = null;

async function syncTenantAuthSurface() {
  if (authSurfaceSyncing) {
    authSurfaceSyncQueued = true;
    return null;
  }
  authSurfaceSyncing = true;
  try {
    const view = readTenantView();
    if (!isTenantLoginView(view)) {
      clearAuthSurface();
      return null;
    }
    if (recoverAuthenticatedChatRoute(view)) {
      clearAuthSurface();
      return null;
    }

    document.body.setAttribute(ACTIVE_ATTR, "true");
    ensureStyle();
    const root = ensureRoot();
    const result = await mountTenantLoginPage(root);
    if (!isTenantLoginView(readTenantView())) {
      clearAuthSurface();
      return null;
    }
    return result;
  } finally {
    authSurfaceSyncing = false;
    if (authSurfaceSyncQueued) {
      authSurfaceSyncQueued = false;
      window.setTimeout(() => {
        void syncTenantAuthSurface();
      }, 0);
    }
  }
}

export async function bootTenantAuthSurface() {
  bootTenantRouteSync();
  const initial = await syncTenantAuthSurface();
  if (window.__openclawTenantAuthSurfaceBooted) {
    return initial;
  }
  window.__openclawTenantAuthSurfaceBooted = true;
  authSurfaceRouteCleanup = onTenantRouteChange(() => {
    void syncTenantAuthSurface();
  });
  return initial;
}

export function resetTenantAuthSurfaceForTests() {
  authSurfaceSyncing = false;
  authSurfaceSyncQueued = false;
  if (typeof authSurfaceRouteCleanup === "function") {
    authSurfaceRouteCleanup();
  }
  authSurfaceRouteCleanup = null;
  clearAuthSurface();
  delete window.__openclawTenantAuthSurfaceBooted;
}

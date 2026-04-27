import { mountTenantLoginPage } from "./login-page.js";
import { navigateTenantRoute } from "./route-sync.js";
import {
  buildTenantMemberChatRoute,
  isTenantLoginView,
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
      const sessionKey = String(url.searchParams.get("session") || "").trim();
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

export async function bootTenantAuthSurface() {
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
  return mountTenantLoginPage(root);
}

import {
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_AGENT_SELECTOR_VIEW,
  LOGIN_ROUTE,
  TENANT_MEMBERS_VIEW,
  clearPlatformSession,
  isTenantLoginView,
  readSelectedTenantAgentId,
  routeForRole,
  readPlatformSession,
  readTenantSession,
  readTenantView,
} from "./tenant-context.js";
import { isLufengPublicPath } from "../lufeng/context.js";
import { createTenantApiClient } from "./api-client.js";

export function isNativeControlUiPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  if (normalized === "/" || normalized.endsWith("/index.html")) {
    return true;
  }
  return !/\.html$/i.test(normalized);
}

export function resolvePlatformAccessDecision({
  pathname = window.location.pathname,
  href = window.location.href,
  edition = "cloud",
  platformSession = readPlatformSession(),
  tenantSession = readTenantSession(),
} = {}) {
  const view = readTenantView(href);
  const selectedTenantAgentId = readSelectedTenantAgentId(href);
  if (isTenantLoginView(view)) {
    return "skip";
  }
  if (isLufengPublicPath(pathname)) {
    return "skip";
  }
  if (!isNativeControlUiPath(pathname)) {
    return "skip";
  }
  if (platformSession?.token && platformSession?.session?.role === "platform_admin") {
    return "allow";
  }
  if (
    tenantSession?.token &&
    tenantSession?.session?.role === "tenant_admin" &&
    (view === TENANT_MEMBERS_VIEW || view === TENANT_AGENT_ASSIGNMENT_VIEW)
  ) {
    return "allow";
  }
  if (
    tenantSession?.token &&
    tenantSession?.session?.role === "member" &&
    view === TENANT_AGENT_SELECTOR_VIEW
  ) {
    return "allow";
  }
  if (
    tenantSession?.token &&
    tenantSession?.session?.role === "member" &&
    selectedTenantAgentId &&
    String(pathname || "").trim() === "/chat"
  ) {
    return "allow";
  }
  if (tenantSession?.token && tenantSession?.session?.role === "member") {
    return "redirect-member";
  }
  if (tenantSession?.token && tenantSession?.session?.role === "tenant_admin") {
    return "redirect-tenant";
  }
  return edition === "local" ? "redirect-tenant-login" : "redirect";
}

let bootstrapPromise = null;

async function readTenantPlatformEdition() {
  if (!bootstrapPromise) {
    bootstrapPromise = createTenantApiClient()
      .bootstrap()
      .then((bootstrap) => String(bootstrap?.edition || "cloud").trim().toLowerCase() || "cloud")
      .catch(() => "cloud");
  }
  return bootstrapPromise;
}

export function resetPlatformAccessGuardBootstrapForTests() {
  bootstrapPromise = null;
}

export async function bootPlatformAccessGuard() {
  if (window.__openclawPlatformAccessGuardBooted) {
    return;
  }
  window.__openclawPlatformAccessGuardBooted = true;

  const view = readTenantView();
  if (isTenantLoginView(view)) {
    return;
  }
  if (isLufengPublicPath(window.location.pathname) || !isNativeControlUiPath(window.location.pathname)) {
    return;
  }

  const platformSession = readPlatformSession();
  const tenantSession = readTenantSession();
  const edition = await readTenantPlatformEdition();
  if (edition === "local" && platformSession?.session?.role === "platform_admin") {
    clearPlatformSession();
  }
  const decision = resolvePlatformAccessDecision({
    edition,
    platformSession: edition === "local" ? null : platformSession,
    tenantSession,
  });
  if (decision === "redirect") {
    window.location.href = LOGIN_ROUTE;
  } else if (decision === "redirect-tenant-login") {
    window.location.href = LOGIN_ROUTE;
  } else if (decision === "redirect-tenant") {
    window.location.href = routeForRole(tenantSession?.session?.role);
  } else if (decision === "redirect-member") {
    window.location.href = routeForRole("member");
  }
}

import {
  TENANT_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_LOGIN_ROUTE,
  PLATFORM_LOGIN_VIEW,
  TENANT_MEMBERS_VIEW,
  TENANT_LOGIN_VIEW,
  readPlatformSession,
  readTenantSession,
  readTenantView,
} from "./tenant-context.js";
import { isLufengPublicPath } from "../lufeng/context.js";

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
  platformSession = readPlatformSession(),
  tenantSession = readTenantSession(),
} = {}) {
  const view = readTenantView(href);
  if (view === PLATFORM_LOGIN_VIEW || view === TENANT_LOGIN_VIEW) {
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
  if (tenantSession?.token && tenantSession?.session?.role === "tenant_admin") {
    return "redirect-tenant";
  }
  return "redirect";
}

export function bootPlatformAccessGuard() {
  if (window.__openclawPlatformAccessGuardBooted) {
    return;
  }
  window.__openclawPlatformAccessGuardBooted = true;

  const decision = resolvePlatformAccessDecision();
  if (decision === "redirect") {
    window.location.href = PLATFORM_LOGIN_ROUTE;
  } else if (decision === "redirect-tenant") {
    window.location.href = `./?ocTenantView=${TENANT_MEMBERS_VIEW}`;
  }
}

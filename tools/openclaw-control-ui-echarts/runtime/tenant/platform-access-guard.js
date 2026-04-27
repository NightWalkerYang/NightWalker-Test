import { isEchartsViewPublicPath } from "../echarts-view/context.js";
import { isLufengPublicPath } from "../lufeng/context.js";
import { createTenantApiClient } from "./api-client.js";
import {
  buildTenantMemberChatRoute,
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_OWNED_AGENTS_VIEW,
  TENANT_AGENT_SELECTOR_VIEW,
  LOGIN_ROUTE,
  TENANT_MEMBERS_VIEW,
  TENANT_STATISTICS_OVERVIEW_VIEW,
  TENANT_USAGE_STATS_VIEW,
  clearPlatformSession,
  isTenantLoginView,
  isTenantMemberSessionKey,
  readSelectedTenantAgent,
  readSelectedTenantAgentId,
  routeForRole,
  readPlatformSession,
  readTenantSession,
  readTenantView,
} from "./tenant-context.js";

export function isNativeControlUiPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  if (normalized === "/" || normalized.endsWith("/index.html")) {
    return true;
  }
  return !/\.html$/i.test(normalized);
}

function isMemberSelectorHostPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized.endsWith("/index.html");
}

export function resolveMemberChatBootstrapHref({
  href = window.location.href,
  pathname = window.location.pathname,
  tenantSession = readTenantSession(),
  selectedAgent = readSelectedTenantAgent(href),
} = {}) {
  const normalizedPathname = String(pathname || "").trim();
  if (normalizedPathname !== "/chat" || tenantSession?.session?.role !== "member") {
    return href;
  }

  const tenantAgentId = String(selectedAgent?.id || "").trim();
  if (!tenantAgentId) {
    return href;
  }

  const currentHref = new URL(href, document.baseURI).href;
  const currentSessionKey = new URL(currentHref).searchParams.get("session")?.trim() || "";
  if (currentSessionKey && isTenantMemberSessionKey(currentSessionKey, tenantSession, selectedAgent)) {
    return currentHref;
  }
  return buildTenantMemberChatRoute(tenantAgentId);
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
  if (isLufengPublicPath(pathname) || isEchartsViewPublicPath(pathname)) {
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
    (view === TENANT_MEMBERS_VIEW ||
      view === TENANT_AGENT_ASSIGNMENT_VIEW ||
      view === TENANT_OWNED_AGENTS_VIEW ||
      view === TENANT_STATISTICS_OVERVIEW_VIEW ||
      view === TENANT_USAGE_STATS_VIEW)
  ) {
    return "allow";
  }
  if (
    tenantSession?.token &&
    tenantSession?.session?.role === "member" &&
    view === TENANT_AGENT_SELECTOR_VIEW &&
    isMemberSelectorHostPath(pathname)
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
      .then(
        (bootstrap) =>
          String(bootstrap?.edition || "cloud")
            .trim()
            .toLowerCase() || "cloud",
      )
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
  if (
    isLufengPublicPath(window.location.pathname) ||
    !isNativeControlUiPath(window.location.pathname)
  ) {
    return;
  }

  const bootstrapHref = resolveMemberChatBootstrapHref();
  if (bootstrapHref !== window.location.href) {
    window.history.replaceState({}, "", bootstrapHref);
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

import {
  observeMountTargets,
  resolveMountState,
  resolveMountStateWithRetry,
} from "../framework/mount-compat.js";
import { bootTenantRouteSync, onTenantRouteChange } from "./route-sync.js";
import { mountTenantConsolePage } from "./tenant-console-page.js";
import {
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_MEMBERS_VIEW,
  TENANT_OWNED_AGENTS_VIEW,
  TENANT_USAGE_STATS_VIEW,
  TENANT_STATISTICS_OVERVIEW_VIEW,
  TENANT_SKILLS_MARKET_VIEW,
  TENANT_SKILLS_WORKBENCH_VIEW,
  TENANT_SKILLS_ENTITLEMENTS_VIEW,
  TENANT_SKILLS_ASSIGNMENTS_VIEW,
  TENANT_WALLET_VIEW,
  TENANT_WALLET_ORDERS_VIEW,
  TENANT_WALLET_LEDGER_VIEW,
  TENANT_WALLET_FLOW_VIEW,
  clearPersistedControlUiSession,
  readTenantSession,
  readTenantView,
} from "./tenant-context.js";

const ROOT_ATTR = "data-oc-tenant-surface-root";
const STYLE_ATTR = "data-oc-tenant-surface-style";
const ACTIVE_ATTR = "data-oc-tenant-surface-active";
const SECTION_ATTR = "data-oc-tenant-section";
const FALLBACK_ATTR = "data-oc-tenant-surface-fallback";
const MOUNT_SOURCE_TAG = "tenant-surface";

function isTenantManagementView(view) {
  return (
    view === TENANT_MEMBERS_VIEW ||
    view === TENANT_AGENT_ASSIGNMENT_VIEW ||
    view === TENANT_OWNED_AGENTS_VIEW ||
    view === TENANT_USAGE_STATS_VIEW ||
    view === TENANT_STATISTICS_OVERVIEW_VIEW ||
    view === TENANT_SKILLS_MARKET_VIEW ||
    view === TENANT_SKILLS_WORKBENCH_VIEW ||
    view === TENANT_SKILLS_ENTITLEMENTS_VIEW ||
    view === TENANT_SKILLS_ASSIGNMENTS_VIEW ||
    view === TENANT_WALLET_VIEW ||
    view === TENANT_WALLET_ORDERS_VIEW ||
    view === TENANT_WALLET_LEDGER_VIEW ||
    view === TENANT_WALLET_FLOW_VIEW
  );
}

function isRootControlPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized.endsWith("/index.html");
}

function isTenantManagementRoute() {
  return isRootControlPath(window.location.pathname) && isTenantManagementView(readTenantView());
}

function sectionForView(view) {
  if (view === TENANT_AGENT_ASSIGNMENT_VIEW) {
    return "agent-assignment";
  }
  if (view === TENANT_USAGE_STATS_VIEW) {
    return "usage-stats";
  }
  if (view === TENANT_OWNED_AGENTS_VIEW) {
    return "owned-agents";
  }
  if (view === TENANT_STATISTICS_OVERVIEW_VIEW) {
    return "statistics-overview";
  }
  if (view === TENANT_SKILLS_MARKET_VIEW) {
    return "skills-market";
  }
  if (view === TENANT_SKILLS_WORKBENCH_VIEW) {
    return "skills-workbench";
  }
  if (view === TENANT_SKILLS_ENTITLEMENTS_VIEW) {
    return "skills-workbench";
  }
  if (view === TENANT_SKILLS_ASSIGNMENTS_VIEW) {
    return "skills-workbench";
  }
  if (view === TENANT_WALLET_VIEW) {
    return "wallet";
  }
  if (view === TENANT_WALLET_ORDERS_VIEW) {
    return "wallet-orders";
  }
  if (view === TENANT_WALLET_LEDGER_VIEW) {
    return "wallet-ledger";
  }
  if (view === TENANT_WALLET_FLOW_VIEW) {
    return "wallet-flow";
  }
  return "members";
}

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./tenant-surface.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function ensureRoot(content) {
  let root = content.querySelector(`[${ROOT_ATTR}]`);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("section");
  root.setAttribute(ROOT_ATTR, "true");
  root.className = "oc-tenant-surface-root";
  content.prepend(root);
  return root;
}

function renderShell(root, section) {
  root.setAttribute(SECTION_ATTR, section);
  root.dataset.ocTenantEmbedded = "true";
  root.innerHTML = `
    <div data-tenant-section-body></div>
  `;
}

function isFallbackContent(content) {
  return content instanceof HTMLElement && content.hasAttribute(FALLBACK_ATTR);
}

function ensureFallbackContent() {
  let content = document.querySelector(`[${FALLBACK_ATTR}]`);
  if (content instanceof HTMLElement) {
    return content;
  }
  const state = resolveMountState(document, {
    featureKind: "tenant-surface",
    sourceTag: MOUNT_SOURCE_TAG,
    createFallback: true,
  });
  content = state.fallbackRoot;
  if (content instanceof HTMLElement) {
    content.setAttribute(FALLBACK_ATTR, "true");
  }
  return content;
}

function removeFallbackContent() {
  document.querySelector(`[${FALLBACK_ATTR}]`)?.remove();
}

function clearMountedSurface(content) {
  document.querySelectorAll(`[${ROOT_ATTR}]`).forEach((node) => node.remove());
  cleanupStateAttributes();
  if (content instanceof HTMLElement && !isFallbackContent(content)) {
    content.removeAttribute(ACTIVE_ATTR);
  }
  removeFallbackContent();
  document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
}

function cleanupStateAttributes() {
  document.body.removeAttribute(ACTIVE_ATTR);
  document
    .querySelectorAll(`[${ACTIVE_ATTR}]`)
    .forEach((node) => node.removeAttribute(ACTIVE_ATTR));
}

async function mountCurrentSurface(state) {
  if (!isTenantManagementRoute()) {
    clearMountedSurface(state?.primary);
    return null;
  }

  const session = readTenantSession();
  if (session?.session?.role !== "tenant_admin") {
    clearMountedSurface(state?.primary);
    return null;
  }

  const host =
    state?.mode === "native" && state.primary instanceof HTMLElement
      ? state.primary
      : ensureFallbackContent();
  if (!(host instanceof HTMLElement)) {
    return null;
  }
  ensureStyle();
  clearPersistedControlUiSession(window.location.href);
  if (isFallbackContent(host)) {
    cleanupStateAttributes();
    document.body.setAttribute(ACTIVE_ATTR, "fallback");
  } else {
    removeFallbackContent();
    cleanupStateAttributes();
    host.setAttribute(ACTIVE_ATTR, "true");
  }
  const root = ensureRoot(host);
  const section = sectionForView(readTenantView());
  if (root.getAttribute(SECTION_ATTR) !== section) {
    renderShell(root, section);
  }
  await mountTenantConsolePage(root, {
    embedded: true,
    section,
  });
  return root;
}

export async function bootTenantSurface() {
  bootTenantRouteSync();

  const shouldReactToMountMutation = () =>
    isTenantManagementRoute() ||
    document.querySelector(`[${ROOT_ATTR}]`) instanceof HTMLElement ||
    document.querySelector(`[${FALLBACK_ATTR}]`) instanceof HTMLElement;

  const scan = async ({ preferNative = false } = {}) => {
    const isActiveRoute = isTenantManagementRoute();
    const isTenantAdmin = readTenantSession()?.session?.role === "tenant_admin";
    if (!isActiveRoute || !isTenantAdmin) {
      return mountCurrentSurface(
        resolveMountState(document, {
          featureKind: "tenant-surface",
          sourceTag: MOUNT_SOURCE_TAG,
        }),
      );
    }
    const allowFallback = true;
    const state = await resolveMountStateWithRetry(document, {
      routeKind: "root-shell",
      featureKind: "tenant-surface",
      sourceTag: MOUNT_SOURCE_TAG,
      allowFallback,
      preferNative,
    });
    return mountCurrentSurface(state);
  };

  if (window.__openclawTenantSurfaceBooted) {
    return scan({ preferNative: true });
  }
  window.__openclawTenantSurfaceBooted = true;

  observeMountTargets(
    document,
    ({ mode, scope }) => {
      if (scope instanceof Element && scope.closest?.(`[${ROOT_ATTR}]`)) {
        return;
      }
      if (!shouldReactToMountMutation()) {
        return;
      }
      void scan({ preferNative: mode !== "native" });
    },
    MOUNT_SOURCE_TAG,
  );

  onTenantRouteChange(() => {
    void scan({ preferNative: true });
  });

  return scan({ preferNative: true });
}

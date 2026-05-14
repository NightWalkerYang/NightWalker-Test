import {
  observeMountTargets,
  resolveMountState,
  resolveMountStateWithRetry,
} from "../framework/mount-compat.js";
import { mountPlatformConsolePage } from "./platform-console-page.js";
import { bootTenantRouteSync, onTenantRouteChange } from "./route-sync.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_DATA_SOURCES_VIEW,
  PLATFORM_NODE_MANAGEMENT_VIEW,
  PLATFORM_SKILLS_VIEW,
  PLATFORM_TENANTS_VIEW,
  clearPersistedControlUiSession,
  readPlatformSession,
  readTenantView,
} from "./tenant-context.js";

const ROOT_ATTR = "data-oc-platform-surface-root";
const STYLE_ATTR = "data-oc-platform-surface-style";
const ACTIVE_ATTR = "data-oc-platform-surface-active";
const SECTION_ATTR = "data-oc-platform-section";
const FALLBACK_ATTR = "data-oc-platform-surface-fallback";
const MOUNT_SOURCE_TAG = "platform-surface";

function isPlatformManagementView(view) {
  return (
    view === PLATFORM_TENANTS_VIEW ||
    view === PLATFORM_AGENT_ASSIGNMENT_VIEW ||
    view === PLATFORM_DATA_SOURCES_VIEW ||
    view === PLATFORM_NODE_MANAGEMENT_VIEW ||
    view === PLATFORM_SKILLS_VIEW
  );
}

function isRootControlPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized.endsWith("/index.html");
}

function isPlatformManagementRoute() {
  return isRootControlPath(window.location.pathname) && isPlatformManagementView(readTenantView());
}

function sectionForView(view) {
  if (view === PLATFORM_AGENT_ASSIGNMENT_VIEW) {
    return "agent-allocation";
  }
  if (view === PLATFORM_DATA_SOURCES_VIEW) {
    return "data-sources";
  }
  if (view === PLATFORM_NODE_MANAGEMENT_VIEW) {
    return "nodes";
  }
  if (view === PLATFORM_SKILLS_VIEW) {
    return "skills";
  }
  return "tenants";
}

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./platform-surface.css", import.meta.url).href;
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
  root.className = "oc-platform-surface-root";
  content.prepend(root);
  return root;
}

function renderShell(root, section) {
  root.setAttribute(SECTION_ATTR, section);
  root.dataset.ocPlatformEmbedded = "true";
  root.innerHTML = `
    <div data-platform-section-body></div>
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
    featureKind: "platform-surface",
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
  if (!isPlatformManagementRoute()) {
    clearMountedSurface(state?.primary);
    return null;
  }

  const session = readPlatformSession();
  if (session?.session?.role !== "platform_admin") {
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
  const view = readTenantView();
  const section = sectionForView(view);
  if (root.getAttribute(SECTION_ATTR) !== section) {
    renderShell(root, section);
  }
  await mountPlatformConsolePage(root, {
    embedded: true,
    section,
  });
  return root;
}

export async function bootPlatformSurface() {
  bootTenantRouteSync();

  const shouldReactToMountMutation = () =>
    isPlatformManagementRoute() ||
    document.querySelector(`[${ROOT_ATTR}]`) instanceof HTMLElement ||
    document.querySelector(`[${FALLBACK_ATTR}]`) instanceof HTMLElement;

  const scan = async ({ preferNative = false } = {}) => {
    const isActiveRoute = isPlatformManagementRoute();
    const isPlatformAdmin = readPlatformSession()?.session?.role === "platform_admin";
    if (!isActiveRoute || !isPlatformAdmin) {
      return mountCurrentSurface(
        resolveMountState(document, {
          featureKind: "platform-surface",
          sourceTag: MOUNT_SOURCE_TAG,
        }),
      );
    }
    const allowFallback = true;
    const state = await resolveMountStateWithRetry(document, {
      routeKind: "root-shell",
      featureKind: "platform-surface",
      sourceTag: MOUNT_SOURCE_TAG,
      allowFallback,
      preferNative,
    });
    return mountCurrentSurface(state);
  };

  if (window.__openclawPlatformSurfaceBooted) {
    return scan({ preferNative: true });
  }
  window.__openclawPlatformSurfaceBooted = true;
  observeMountTargets(
    document,
    ({ mode, scope: nextScope }) => {
      if (nextScope instanceof Element && nextScope.closest?.(`[${ROOT_ATTR}]`)) {
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

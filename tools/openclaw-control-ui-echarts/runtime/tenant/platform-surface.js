import {
  ensureFallbackMountRoot,
  observeMountTargets,
  resolvePrimaryMountRoot,
} from "../framework/mount-compat.js";
import { mountPlatformConsolePage } from "./platform-console-page.js";
import { bootTenantRouteSync, onTenantRouteChange } from "./route-sync.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_DATA_SOURCES_VIEW,
  PLATFORM_NODE_MANAGEMENT_VIEW,
  PLATFORM_TENANTS_VIEW,
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
    view === PLATFORM_NODE_MANAGEMENT_VIEW
  );
}

function isRootControlPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized === "/chat" || normalized.endsWith("/index.html");
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
  content = ensureFallbackMountRoot(document, "platform-surface", MOUNT_SOURCE_TAG);
  if (content instanceof HTMLElement) {
    content.setAttribute(FALLBACK_ATTR, "true");
  }
  return content;
}

function removeFallbackContent() {
  document.querySelector(`[${FALLBACK_ATTR}]`)?.remove();
}

function clearMountedSurface(content) {
  if (content instanceof HTMLElement && !isFallbackContent(content)) {
    content.removeAttribute(ACTIVE_ATTR);
    content.querySelector(`[${ROOT_ATTR}]`)?.remove();
  }
  removeFallbackContent();
  document.body.removeAttribute(ACTIVE_ATTR);
  document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
}

async function mountCurrentSurface(content) {
  if (!isPlatformManagementRoute()) {
    clearMountedSurface(content);
    return null;
  }

  const session = readPlatformSession();
  if (session?.session?.role !== "platform_admin") {
    clearMountedSurface(content);
    return null;
  }

  const host = content instanceof HTMLElement ? content : ensureFallbackContent();
  if (!(host instanceof HTMLElement)) {
    return null;
  }
  ensureStyle();
  if (isFallbackContent(host)) {
    document.body.setAttribute(ACTIVE_ATTR, "fallback");
  } else {
    removeFallbackContent();
    document.body.removeAttribute(ACTIVE_ATTR);
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

  const scan = async (scope = document) => {
    const content = resolvePrimaryMountRoot(scope, "", MOUNT_SOURCE_TAG);
    return mountCurrentSurface(content);
  };

  const initial = await scan(document);
  if (window.__openclawPlatformSurfaceBooted) {
    return initial;
  }
  window.__openclawPlatformSurfaceBooted = true;
  onTenantRouteChange(() => {
    void scan(document);
  });

  observeMountTargets(
    document,
    ({ scope: nextScope }) => {
      if (nextScope instanceof Element && nextScope.closest?.(`[${ROOT_ATTR}]`)) {
        return;
      }
      void scan(nextScope);
    },
    MOUNT_SOURCE_TAG,
  );

  return initial;
}

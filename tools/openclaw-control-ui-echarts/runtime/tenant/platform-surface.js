import { mountPlatformConsolePage } from "./platform-console-page.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_DATA_SOURCES_VIEW,
  PLATFORM_TENANTS_VIEW,
  readPlatformSession,
  readTenantView,
} from "./tenant-context.js";
import {
  bootTenantRouteSync,
  onTenantRouteChange,
} from "./route-sync.js";

const ROOT_ATTR = "data-oc-platform-surface-root";
const STYLE_ATTR = "data-oc-platform-surface-style";
const ACTIVE_ATTR = "data-oc-platform-surface-active";
const SECTION_ATTR = "data-oc-platform-section";
const FALLBACK_ATTR = "data-oc-platform-surface-fallback";
function isPlatformManagementView(view) {
  return (
    view === PLATFORM_TENANTS_VIEW ||
    view === PLATFORM_AGENT_ASSIGNMENT_VIEW ||
    view === PLATFORM_DATA_SOURCES_VIEW
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
  if (!(document.querySelector("openclaw-app") instanceof HTMLElement)) {
    return null;
  }
  let content = document.querySelector(`[${FALLBACK_ATTR}]`);
  if (content instanceof HTMLElement) {
    return content;
  }
  content = document.createElement("main");
  content.className = "content oc-platform-surface-fallback";
  content.setAttribute(FALLBACK_ATTR, "true");
  document.body.append(content);
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
    const content =
      scope instanceof Element && scope.matches(".content")
        ? scope
        : document.querySelector(".content") ||
          document.querySelector(`[${FALLBACK_ATTR}]`);
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

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          if (node.closest?.(`[${ROOT_ATTR}]`)) {
            continue;
          }
          if (node.matches(".content")) {
            void scan(node);
            continue;
          }
          const nestedContent = node.querySelector?.(".content");
          if (nestedContent instanceof Element) {
            void scan(nestedContent);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  return initial;
}

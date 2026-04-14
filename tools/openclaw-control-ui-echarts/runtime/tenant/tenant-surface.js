import { bootTenantRouteSync, onTenantRouteChange } from "./route-sync.js";
import { mountTenantConsolePage } from "./tenant-console-page.js";
import {
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_MEMBERS_VIEW,
  TENANT_USAGE_STATS_VIEW,
  TENANT_STATISTICS_OVERVIEW_VIEW,
  readTenantSession,
  readTenantView,
} from "./tenant-context.js";

const ROOT_ATTR = "data-oc-tenant-surface-root";
const STYLE_ATTR = "data-oc-tenant-surface-style";
const ACTIVE_ATTR = "data-oc-tenant-surface-active";
const SECTION_ATTR = "data-oc-tenant-section";

function isTenantManagementView(view) {
  return (
    view === TENANT_MEMBERS_VIEW ||
    view === TENANT_AGENT_ASSIGNMENT_VIEW ||
    view === TENANT_USAGE_STATS_VIEW ||
    view === TENANT_STATISTICS_OVERVIEW_VIEW
  );
}

function isRootControlPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized === "/chat" || normalized.endsWith("/index.html");
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
  if (view === TENANT_STATISTICS_OVERVIEW_VIEW) {
    return "statistics-overview";
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

async function mountCurrentSurface(content) {
  if (!isTenantManagementRoute()) {
    content.removeAttribute(ACTIVE_ATTR);
    content.querySelector(`[${ROOT_ATTR}]`)?.remove();
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return null;
  }

  const session = readTenantSession();
  if (session?.session?.role !== "tenant_admin") {
    return null;
  }

  ensureStyle();
  content.setAttribute(ACTIVE_ATTR, "true");
  const root = ensureRoot(content);
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

  const scan = async (scope = document) => {
    const content =
      scope instanceof Element && scope.matches(".content")
        ? scope
        : document.querySelector(".content");
    if (!(content instanceof HTMLElement)) {
      return null;
    }
    return mountCurrentSurface(content);
  };

  const initial = await scan(document);
  if (window.__openclawTenantSurfaceBooted) {
    return initial;
  }
  window.__openclawTenantSurfaceBooted = true;

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

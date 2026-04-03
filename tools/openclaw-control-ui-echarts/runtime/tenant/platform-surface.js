import { mountPlatformConsolePage } from "./platform-console-page.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_TENANTS_VIEW,
  readTenantSession,
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
function isPlatformManagementView(view) {
  return view === PLATFORM_TENANTS_VIEW || view === PLATFORM_AGENT_ASSIGNMENT_VIEW;
}

function isRootControlPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized === "/chat" || normalized.endsWith("/index.html");
}

function isPlatformManagementRoute() {
  return isRootControlPath(window.location.pathname) && isPlatformManagementView(readTenantView());
}

function sectionForView(view) {
  return view === PLATFORM_AGENT_ASSIGNMENT_VIEW ? "agent-allocation" : "tenants";
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

    <div class="callout info oc-platform-surface-feedback" data-tenant-feedback>平台租户页已就绪。</div>
  `;
}

async function mountCurrentSurface(content) {
  if (!isPlatformManagementRoute()) {
    content.removeAttribute(ACTIVE_ATTR);
    content.querySelector(`[${ROOT_ATTR}]`)?.remove();
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return null;
  }

  const session = readTenantSession();
  if (session?.session?.role !== "platform_admin") {
    return null;
  }

  ensureStyle();
  content.setAttribute(ACTIVE_ATTR, "true");
  const root = ensureRoot(content);
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
        : document.querySelector(".content");
    if (!(content instanceof HTMLElement)) {
      return null;
    }
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

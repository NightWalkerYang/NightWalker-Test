import { bootTenantRouteSync, onTenantRouteChange } from "../tenant/route-sync.js";
import {
  isEchartsViewPublicPath,
  normalizeEchartsViewRouteUrl,
  extractDashboardRouteParams,
} from "./context.js";

const ROOT_ATTR = "data-oc-echarts-view-root";
const STYLE_ATTR = "data-oc-echarts-view-style";
const ACTIVE_ATTR = "data-oc-echarts-view-active";
const ROUTE_ATTR = "data-oc-echarts-view-route";

let _currentView = null;

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./page.css", import.meta.url).href;
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
  root.className = "oc-echarts-view-root";
  content.prepend(root);
  return root;
}

function normalizeEchartsViewLocation() {
  const normalized = normalizeEchartsViewRouteUrl(window.location.href, window.location.href);
  if (
    normalized.pathname !== window.location.pathname ||
    normalized.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalized.toString());
  }
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function renderPage(root) {
  const params = extractDashboardRouteParams(window.location.pathname);
  const viewKey = `${params.view}:${params.dashboardId || params.publicToken || ""}`;

  if (_currentView === viewKey) {
    return;
  }
  _currentView = viewKey;

  root.innerHTML = "";

  const onNavigate = (path) => {
    _currentView = null;
    navigate(path);
  };

  if (params.view === "list") {
    const { renderDashboardList } = await import("./dashboard-list.js");
    await renderDashboardList(root, { onNavigate });
  } else if (params.view === "editor") {
    const { renderDashboardEditor } = await import("./dashboard-editor.js");
    await renderDashboardEditor(root, { dashboardId: params.dashboardId, onNavigate });
  } else if (params.view === "display") {
    const { renderDashboardDisplay } = await import("./dashboard-display.js");
    await renderDashboardDisplay(root, { dashboardId: params.dashboardId, onNavigate });
  } else if (params.view === "public") {
    const { renderDashboardDisplay } = await import("./dashboard-display.js");
    await renderDashboardDisplay(root, { publicToken: params.publicToken, onNavigate });
  } else {
    root.innerHTML = `<div class="oc-dv-error">未知路由</div>`;
  }
}

async function mountCurrentSurface(content) {
  if (!isEchartsViewPublicPath(window.location.pathname)) {
    content.removeAttribute(ACTIVE_ATTR);
    content.querySelector(`[${ROOT_ATTR}]`)?.remove();
    document.documentElement.removeAttribute(ROUTE_ATTR);
    document.body?.removeAttribute(ROUTE_ATTR);
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    _currentView = null;
    return null;
  }

  ensureStyle();
  normalizeEchartsViewLocation();
  document.documentElement.setAttribute(ROUTE_ATTR, "true");
  document.body?.setAttribute(ROUTE_ATTR, "true");
  content.setAttribute(ACTIVE_ATTR, "true");
  const root = ensureRoot(content);
  await renderPage(root);
  return root;
}

export async function bootEchartsViewSurface() {
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
  if (window.__openclawEchartsViewSurfaceBooted) {
    return initial;
  }
  window.__openclawEchartsViewSurfaceBooted = true;

  onTenantRouteChange(() => {
    void scan(document);
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }
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
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  return initial;
}

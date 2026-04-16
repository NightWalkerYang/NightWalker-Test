import { bootTenantRouteSync, onTenantRouteChange } from "../tenant/route-sync.js";
import { isEchartsViewPublicPath, normalizeEchartsViewRouteUrl } from "./context.js";

const ROOT_ATTR = "data-oc-echarts-view-root";
const STYLE_ATTR = "data-oc-echarts-view-style";
const ACTIVE_ATTR = "data-oc-echarts-view-active";
const ROUTE_ATTR = "data-oc-echarts-view-route";

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

function renderPage(root) {
  root.innerHTML = `
    <section class="oc-echarts-view-card">
      <div class="oc-echarts-view-card__badge">公开路由 · ECharts</div>
      <h1 class="oc-echarts-view-card__title">可视化展示</h1>
      <p class="oc-echarts-view-card__copy">
        这里先写几个字，后续会接入 ECharts 图表和更多数据面板。
      </p>
      <p class="oc-echarts-view-card__hint">
        这个路由可以直接分享访问，不需要登录。
      </p>
    </section>
  `;
}

async function mountCurrentSurface(content) {
  if (!isEchartsViewPublicPath(window.location.pathname)) {
    content.removeAttribute(ACTIVE_ATTR);
    content.querySelector(`[${ROOT_ATTR}]`)?.remove();
    document.documentElement.removeAttribute(ROUTE_ATTR);
    document.body?.removeAttribute(ROUTE_ATTR);
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return null;
  }

  ensureStyle();
  normalizeEchartsViewLocation();
  document.documentElement.setAttribute(ROUTE_ATTR, "true");
  document.body?.setAttribute(ROUTE_ATTR, "true");
  content.setAttribute(ACTIVE_ATTR, "true");
  const root = ensureRoot(content);
  renderPage(root);
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

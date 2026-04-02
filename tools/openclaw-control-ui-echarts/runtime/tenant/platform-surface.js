import { mountPlatformConsolePage } from "./platform-console-page.js";
import {
  PLATFORM_AGENT_ASSIGNMENT_ROUTE,
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_TENANT_MANAGEMENT_ROUTE,
  PLATFORM_TENANTS_VIEW,
  readTenantSession,
  readTenantView,
} from "./tenant-context.js";
import {
  bootTenantRouteSync,
  navigateTenantRoute,
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

function currentSectionHref(section) {
  return section === "agent-allocation"
    ? PLATFORM_AGENT_ASSIGNMENT_ROUTE
    : PLATFORM_TENANT_MANAGEMENT_ROUTE;
}

function sectionForView(view) {
  return view === PLATFORM_AGENT_ASSIGNMENT_VIEW ? "agent-allocation" : "tenants";
}

function titleForSection(section) {
  return section === "agent-allocation" ? "Agent 分配" : "租户管理";
}

function subtitleForSection(section) {
  return section === "agent-allocation"
    ? "平台管理员将现有 OpenClaw Agent 下发到目标租户，并配置租户侧描述、倍率和预算。"
    : "平台管理员在这里创建租户、查看租户状态，并管理平台级成员与资源边界。";
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

function updateSectionLinks(root, section) {
  const sectionLinks = root.querySelectorAll("[href]");
  for (const link of sectionLinks) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }
    const href = link.getAttribute("href") || "";
    if (href === currentSectionHref("tenants")) {
      link.classList.toggle("active", section === "tenants");
    }
    if (href === currentSectionHref("agent-allocation")) {
      link.classList.toggle("active", section === "agent-allocation");
    }
  }
}

function ensureRootHandlers(root) {
  if (!(root instanceof HTMLElement) || root.dataset.ocPlatformRootHandlers === "true") {
    return;
  }
  root.dataset.ocPlatformRootHandlers = "true";
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const link = target.closest(
      'a[href^="./?ocTenantView="], a[href^="/?ocTenantView="], a[href*="?ocTenantView="]',
    );
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    event.preventDefault();
    navigateTenantRoute(link.href);
  });
}

function renderShell(root, section) {
  root.setAttribute(SECTION_ATTR, section);
  root.dataset.ocPlatformEmbedded = "true";
  root.innerHTML = `
    <header class="content-header">
      <div>
        <h1 class="page-title">${titleForSection(section)}</h1>
        <p class="page-sub">${subtitleForSection(section)}</p>
      </div>
      <div class="page-meta">
        <a class="btn btn--ghost" href="${PLATFORM_TENANT_MANAGEMENT_ROUTE}">租户管理</a>
        <a class="btn btn--ghost" href="${PLATFORM_AGENT_ASSIGNMENT_ROUTE}">Agent 分配</a>
      </div>
    </header>

    <section class="card">
      <div class="oc-platform-surface-topbar">
        <div>
          <div class="card-title">平台管理台</div>
          <div class="card-sub">平台管理员统一管理租户、成员上限与 Agent 资源编排。</div>
        </div>
        <div class="oc-platform-surface-meta">
          <span class="pill"><span>当前角色</span><span class="mono">platform_admin</span></span>
          <span class="pill"><span>当前登录</span><span class="mono" data-platform-username>platform-admin</span></span>
          <button class="btn btn--ghost" type="button" data-platform-logout>退出登录</button>
        </div>
      </div>
    </section>

    <section class="stat-grid" data-platform-metrics></section>

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
  ensureRootHandlers(root);
  updateSectionLinks(root, section);
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

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
  return normalized === "/" || normalized.endsWith("/index.html");
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
          <div class="card-sub">平台管理员统一管理租户、成员上限和 Agent 下发。</div>
        </div>
        <div class="oc-platform-surface-meta">
          <span class="pill"><span>当前角色</span><span class="mono">platform_admin</span></span>
          <span class="pill"><span>当前登录</span><span class="mono" data-platform-username>platform-admin</span></span>
          <button class="btn btn--ghost" type="button" data-platform-logout>退出登录</button>
        </div>
      </div>
    </section>

    <section class="stat-grid" data-platform-metrics></section>

    <section class="oc-platform-surface-grid">
      <article class="card">
        <div class="card-title">租户目录</div>
        <div class="card-sub">点击某个租户，右侧会切换到该租户的成员与 Agent 详情。</div>
        <div style="margin-top: 16px" data-platform-tenant-list></div>
      </article>

      <div class="oc-platform-surface-stack">
        <article class="card">
          <div class="card-title">创建租户</div>
          <div class="card-sub">创建租户时同时创建唯一的租户管理员账号。</div>
          <form class="oc-platform-surface-form" data-platform-tenant-form style="margin-top: 16px">
            <label class="field">
              <span>租户编码</span>
              <input name="code" type="text" required />
            </label>
            <label class="field">
              <span>租户名称</span>
              <input name="name" type="text" required />
            </label>
            <label class="field">
              <span>管理员账号</span>
              <input name="adminUsername" type="text" required />
            </label>
            <label class="field">
              <span>管理员密码</span>
              <input name="adminPassword" type="password" required />
            </label>
            <label class="field">
              <span>人数上限</span>
              <input name="memberLimit" type="number" min="1" value="5" required />
            </label>
            <label class="field">
              <span>部署模式</span>
              <select name="deploymentMode">
                <option value="cloud">公有云</option>
                <option value="local">本地部署</option>
              </select>
            </label>
            <label class="field">
              <span>到期日期（可选）</span>
              <input name="licenseExpiresAt" type="datetime-local" />
            </label>
            <label class="field">
              <span>续期码（可选）</span>
              <input name="renewalCode" type="text" />
            </label>
            <div class="oc-platform-surface-actions">
              <button class="btn primary" type="submit">创建租户</button>
            </div>
          </form>
        </article>

        <article class="card">
          <div class="card-title">Agent 分配</div>
          <div class="card-sub">平台管理员负责把已有 OpenClaw Agent 下发到目标租户。</div>
          <form class="oc-platform-surface-form" data-platform-agent-form style="margin-top: 16px">
            <label class="field">
              <span>目标租户</span>
              <select name="tenantId"></select>
            </label>
            <label class="field">
              <span>OpenClaw Agent</span>
              <select name="agentId"></select>
            </label>
            <label class="field">
              <span>租户侧简短描述</span>
              <input name="description" type="text" placeholder="显示在成员 Agent 卡片上的描述" />
            </label>
            <label class="field">
              <span>计费倍率</span>
              <input name="rateMultiplier" type="number" step="0.01" value="1" />
            </label>
            <label class="field">
              <span>初始积分</span>
              <input name="balancePoints" type="number" step="0.01" value="0" />
            </label>
            <div class="oc-platform-surface-actions">
              <button class="btn primary" type="submit">下发到租户</button>
            </div>
          </form>
        </article>
      </div>
    </section>

    <section class="oc-platform-surface-grid oc-platform-surface-grid--detail">
      <article class="card">
        <div class="card-title">当前租户详情</div>
        <div class="card-sub">显示当前选中租户的成员、人数和钱包信息。</div>
        <div style="margin-top: 16px" data-platform-selected-tenant></div>
        <div style="margin-top: 20px" class="card-title">租户成员</div>
        <div class="card-sub">平台管理员只看成员概况，不进入租户代操作。</div>
        <div class="oc-platform-surface-list" style="margin-top: 16px" data-platform-tenant-members></div>
      </article>

      <article class="card">
        <div class="card-title">已下发 Agent</div>
        <div class="card-sub">这里显示平台已经下发到当前租户的 Agent、预算和倍率。</div>
        <div class="oc-platform-surface-list" style="margin-top: 16px" data-platform-tenant-agents></div>
      </article>
    </section>

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
          void scan(node);
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

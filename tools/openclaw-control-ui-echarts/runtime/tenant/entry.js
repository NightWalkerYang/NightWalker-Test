import {
  PLATFORM_LOGIN_VIEW,
  PLATFORM_LOGIN_ROUTE,
  PLATFORM_AGENT_ASSIGNMENT_ROUTE,
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_TENANT_MANAGEMENT_ROUTE,
  PLATFORM_TENANT_MANAGEMENT_VIEW,
  TENANT_AGENT_ASSIGNMENT_ROUTE,
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_AGENT_SELECTOR_ROUTE,
  TENANT_AGENT_SELECTOR_VIEW,
  TENANT_LOGIN_VIEW,
  TENANT_LOGIN_ROUTE,
  TENANT_MEMBER_MANAGEMENT_ROUTE,
  TENANT_MEMBERS_VIEW,
  clearSelectedTenantAgent,
  clearTenantViewFromHref,
  readSessionForCurrentView,
  readTenantView,
} from "./tenant-context.js";
import { createTenantApiClient } from "./api-client.js";
import { isLufengPublicPath } from "../lufeng/context.js";
import {
  bootTenantRouteSync,
  navigateTenantRoute,
  onTenantRouteChange,
} from "./route-sync.js";

const SIDEBAR_NAV_SELECTOR = ".sidebar-nav";
const SIDEBAR_UTILITY_SELECTOR = ".sidebar-utility-group";
const MANAGEMENT_SECTION_CLASS = "oc-platform-management-section";
const TOPBAR_SEARCH_SELECTOR = ".topbar-search";
const TOPBAR_META_STYLE_ATTR = "data-oc-platform-topbar-style";
const TOPBAR_META_MODE_ATTR = "data-oc-platform-search-mode";
const TOPBAR_META_ORIGINAL_ATTR = "data-oc-platform-search-original";
const TOPBAR_META_ROLE_ATTR = "data-oc-platform-role";
const TOPBAR_META_USER_ATTR = "data-oc-platform-user";
const TOPBAR_HIDDEN_ATTR = "data-oc-platform-search-hidden";
const TOPBAR_META_ROOT_SELECTOR = "[data-oc-platform-topbar-meta]";
const TOPBAR_PROFILE_SELECTOR = "[data-oc-platform-profile]";
const TOPBAR_LOGOUT_SELECTOR = "[data-oc-platform-logout]";
const TOPBAR_PROFILE_DIALOG_SELECTOR = "[data-oc-platform-profile-dialog]";
const TOPBAR_LOGOUT_DIALOG_SELECTOR = "[data-oc-platform-logout-dialog]";
const TOPBAR_DIALOG_CLOSE_SELECTOR = "[data-oc-platform-dialog-close]";
const TOPBAR_DIALOG_CONFIRM_LOGOUT_SELECTOR = "[data-oc-platform-confirm-logout]";
const TENANT_ROLE_CONTEXT_ATTR = "data-oc-tenant-role-context";

const ICONS = {
  tenants: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.3 12 3l8 4.3v1.4H4ZM6.1 10h2v6.2h-2Zm4.9 0H13v6.2h-2Zm4.9 0h2v6.2h-2ZM4 19h16v2H4Z"></path>
    </svg>
  `,
  agentAllocation: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.8 5.2a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Zm8.4 0a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM7.8 13.6a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Zm8.4 1h-4.4v-1.8h4.4Zm-6.2-5.2h4.4v1.8H10Zm2 7.8h4.2v1.8H12Z"></path>
    </svg>
  `,
  tenant: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4 7.4v1.4h16V7.4Zm-5.8 7.4h1.9v6.1H6.2Zm4.9 0H13v6.1h-1.9Zm4.8 0h1.9v6.1H16Zm-11.8 8H20V21H4Z"></path>
    </svg>
  `,
  chevronDown: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `,
  members: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.1a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Zm8 0a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6ZM4.5 17.9c0-2.4 2-4.1 4.9-4.1s4.9 1.7 4.9 4.1V19H4.5Zm10.6 1.1v-1.1c0-1.1-.3-2.1-.9-2.9 2.1.1 4 .9 4 2.9V19Z"></path>
    </svg>
  `,
};

function createSectionLabel(text = "管理") {
  const label = document.createElement("button");
  label.type = "button";
  label.className = "nav-section__label";
  label.innerHTML = `
    <span class="nav-section__label-text">${text}</span>
    <span class="nav-section__chevron" aria-hidden="true">${ICONS.chevronDown}</span>
  `;
  return label;
}

function createNavItem({ className, href, title, text, icon }) {
  const link = document.createElement("a");
  link.className = `nav-item ${className}`;
  link.href = href;
  link.title = title;
  link.innerHTML = `
    <span class="nav-item__icon" aria-hidden="true">${icon}</span>
    <span class="nav-item__text">${text}</span>
  `;
  return link;
}

function getSectionConfigForSession(session) {
  const role = session?.session?.role || "";
  if (role === "platform_admin") {
    return {
      label: "管理",
      links: [
        {
          className: "oc-tenant-management-link",
          href: PLATFORM_TENANT_MANAGEMENT_ROUTE,
          title: "租户管理",
          text: "租户管理",
          icon: ICONS.tenants,
          activeView: PLATFORM_TENANT_MANAGEMENT_VIEW,
        },
        {
          className: "oc-platform-agent-link",
          href: PLATFORM_AGENT_ASSIGNMENT_ROUTE,
          title: "Agent 分配",
          text: "Agent 分配",
          icon: ICONS.agentAllocation,
          activeView: PLATFORM_AGENT_ASSIGNMENT_VIEW,
        },
      ],
    };
  }
  if (role === "tenant_admin") {
    return {
      label: "管理",
      links: [
        {
          className: "oc-tenant-members-link",
          href: TENANT_MEMBER_MANAGEMENT_ROUTE,
          title: "成员管理",
          text: "成员管理",
          icon: ICONS.members,
          activeView: TENANT_MEMBERS_VIEW,
        },
        {
          className: "oc-tenant-agent-link",
          href: TENANT_AGENT_ASSIGNMENT_ROUTE,
          title: "Agent 分配",
          text: "Agent 分配",
          icon: ICONS.agentAllocation,
          activeView: TENANT_AGENT_ASSIGNMENT_VIEW,
        },
      ],
    };
  }
  if (role === "member") {
    return {
      label: "Agent",
      links: [
        {
          className: "oc-member-agent-selector-link",
          href: TENANT_AGENT_SELECTOR_ROUTE,
          title: "Agent 选择",
          text: "Agent选择",
          icon: ICONS.agentAllocation,
          activeView: TENANT_AGENT_SELECTOR_VIEW,
        },
      ],
    };
  }
  return { label: "管理", links: [] };
}

function updateManagementSectionState(section) {
  if (!(section instanceof HTMLElement)) {
    return;
  }
  const activeView = readTenantView();
  for (const item of section.querySelectorAll(".nav-item")) {
    const expectedView = item.getAttribute("data-oc-platform-view")?.trim() || "";
    item.classList.toggle("nav-item--active", expectedView === activeView);
  }
}

function isTenantAuthViewActive() {
  const activeView = readTenantView();
  return activeView === PLATFORM_LOGIN_VIEW || activeView === TENANT_LOGIN_VIEW;
}

function ensureManagementSectionHandlers(section) {
  if (!(section instanceof HTMLElement) || section.dataset.ocPlatformHandlers === "true") {
    return;
  }
  section.dataset.ocPlatformHandlers = "true";
  section.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const link = target.closest(".nav-item[href]");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    if (!link.closest(`.${MANAGEMENT_SECTION_CLASS}`)) {
      return;
    }
    event.preventDefault();
    navigateTenantRoute(link.href);
  });
}

function isManagementViewActive() {
  const activeView = readTenantView();
  return (
    activeView === PLATFORM_TENANT_MANAGEMENT_VIEW ||
    activeView === PLATFORM_AGENT_ASSIGNMENT_VIEW ||
    activeView === TENANT_MEMBERS_VIEW ||
    activeView === TENANT_AGENT_ASSIGNMENT_VIEW ||
    activeView === TENANT_AGENT_SELECTOR_VIEW
  );
}

function ensureSidebarRouteHandlers(container) {
  if (!(container instanceof HTMLElement) || container.dataset.ocTenantSidebarHandlers === "true") {
    return;
  }
  container.dataset.ocTenantSidebarHandlers = "true";
  container.addEventListener(
    "click",
    (event) => {
      if (!isManagementViewActive()) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const link = target.closest(".nav-item[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      if (link.closest(`.${MANAGEMENT_SECTION_CLASS}`)) {
        return;
      }
      const destination = new URL(link.href, document.baseURI);
      if (destination.origin !== window.location.origin || !destination.pathname.startsWith("/")) {
        return;
      }
      event.preventDefault();
      navigateTenantRoute(clearTenantViewFromHref(destination.href));
    },
    true,
  );
}

function createManagementSection(session) {
  const section = document.createElement("section");
  section.className = `nav-section ${MANAGEMENT_SECTION_CLASS}`;
  section.setAttribute("data-oc-management-role", String(session?.session?.role || ""));

  const config = getSectionConfigForSession(session);
  const label = createSectionLabel(config.label);
  const items = document.createElement("div");
  items.className = "nav-section__items";
  const links = config.links;
  const activeView = readTenantView();
  for (const link of links) {
    const item = createNavItem({
      className: link.className,
      href: new URL(link.href, document.baseURI).href,
      title: link.title,
      text: link.text,
      icon: link.icon,
    });
    item.setAttribute("data-oc-platform-view", link.activeView);
    item.classList.toggle("nav-item--active", activeView === link.activeView);
    items.append(item);
  }

  label.addEventListener("click", () => {
    section.classList.toggle("nav-section--collapsed");
    label.setAttribute(
      "aria-expanded",
      String(!section.classList.contains("nav-section--collapsed")),
    );
  });
  label.setAttribute("aria-expanded", "true");

  section.append(label, items);
  ensureManagementSectionHandlers(section);
  return section;
}

function ensureManagementSection(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const session = readSessionForCurrentView();
  const role = String(session?.session?.role || "");
  const config = getSectionConfigForSession(session);
  const links = config.links;
  const existing = container.querySelector(`.${MANAGEMENT_SECTION_CLASS}`);
  if (!links.length) {
    existing?.remove();
    return;
  }
  if (existing instanceof HTMLElement) {
    const labelText =
      existing.querySelector(".nav-section__label-text")?.textContent?.trim() || "";
    if (
      existing.getAttribute("data-oc-management-role") !== role ||
      labelText !== config.label
    ) {
      existing.remove();
    } else {
      updateManagementSectionState(existing);
      return;
    }
  }

  const section = createManagementSection(session);
  const siblings = [...container.querySelectorAll(":scope > .nav-section")];
  const insertBefore = siblings[0] ?? null;
  container.insertBefore(section, insertBefore);
}

function ensureTenantUtilityLink(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.querySelector(".oc-tenant-user-link")) {
    return;
  }
  container.append(
    createNavItem({
      className: "sidebar-utility-link oc-tenant-user-link",
      href: new URL(TENANT_LOGIN_ROUTE, document.baseURI).href,
      title: "租户登录入口",
      text: "租户登录",
      icon: ICONS.tenant,
    }),
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
}

function syncSidebarNavForRole(container, role) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const shouldTenantHideNativeSections = role === "tenant_admin" || role === "member";
  for (const section of container.querySelectorAll(":scope > .nav-section")) {
    if (!(section instanceof HTMLElement)) {
      continue;
    }
    if (section.classList.contains(MANAGEMENT_SECTION_CLASS)) {
      section.hidden = false;
      continue;
    }
    section.hidden = shouldTenantHideNativeSections;
  }
}

function shouldHideUtilityItem(item, role) {
  if (!(item instanceof HTMLElement)) {
    return false;
  }
  if (!role) {
    return false;
  }
  const text = normalizeText(item.textContent);
  const isTenantLogin =
    item.querySelector(".oc-tenant-user-link") instanceof Element ||
    text.includes("租户登录");
  const isKnowledgeGraph =
    item.querySelector(".oc-knowledge-graph-link") instanceof Element ||
    text.includes("知识图谱");
  const isDocs = text.includes("文档");
  const isVersion = text.includes("版本");

  if (role === "tenant_admin" || role === "member") {
    return !isVersion;
  }

  if (isTenantLogin || isKnowledgeGraph) {
    return role === "platform_admin" || role === "tenant_admin";
  }
  if (isDocs) {
    return role === "tenant_admin";
  }
  return false;
}

function syncSidebarUtilityForRole(container, role) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  for (const child of container.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    child.hidden = shouldHideUtilityItem(child, role);
  }
}

function ensureTopbarMetaStyle() {
  let link = document.head.querySelector(`[${TOPBAR_META_STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./topbar-meta.css", import.meta.url).href;
  link.setAttribute(TOPBAR_META_STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function showDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      dialog.showModal();
    }
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.close === "function") {
    if (dialog.open) {
      dialog.close();
      return;
    }
  }
  dialog.removeAttribute("open");
}

function ensureTopbarMetaRoot(search) {
  const parent = search.parentElement;
  if (!(parent instanceof HTMLElement)) {
    return null;
  }
  let root = parent.querySelector(TOPBAR_META_ROOT_SELECTOR);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("div");
  root.className = "oc-platform-topbar-meta";
  root.setAttribute("data-oc-platform-topbar-meta", "true");
  search.insertAdjacentElement("afterend", root);
  return root;
}

function ensureTopbarDialogs() {
  let root = document.body.querySelector("[data-oc-platform-dialog-root]");
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("div");
  root.setAttribute("data-oc-platform-dialog-root", "true");
  root.innerHTML = `
    <dialog class="oc-platform-topbar-dialog" data-oc-platform-profile-dialog>
      <div class="oc-platform-topbar-dialog__panel">
        <header class="oc-platform-topbar-dialog__header">
          <h3 class="oc-platform-topbar-dialog__title">当前登录</h3>
          <button class="btn" type="button" data-oc-platform-dialog-close="profile">关闭</button>
        </header>
        <div class="oc-platform-topbar-dialog__body" data-oc-platform-profile-content></div>
      </div>
    </dialog>
    <dialog class="oc-platform-topbar-dialog" data-oc-platform-logout-dialog>
      <div class="oc-platform-topbar-dialog__panel">
        <header class="oc-platform-topbar-dialog__header">
          <h3 class="oc-platform-topbar-dialog__title">确认退出</h3>
          <button class="btn" type="button" data-oc-platform-dialog-close="logout">关闭</button>
        </header>
        <div class="oc-platform-topbar-dialog__body">
          <p class="oc-platform-topbar-dialog__text">确认退出当前登录状态吗？</p>
        </div>
        <footer class="oc-platform-topbar-dialog__actions">
          <button class="btn" type="button" data-oc-platform-dialog-close="logout">取消</button>
          <button class="btn primary" type="button" data-oc-platform-confirm-logout>确认退出</button>
        </footer>
      </div>
    </dialog>
  `;
  document.body.append(root);
  return root;
}

function renderProfileDialog(session) {
  const content = document.body.querySelector("[data-oc-platform-profile-content]");
  if (!(content instanceof HTMLElement)) {
    return;
  }
  const role = String(session?.session?.role || "").trim();
  const username = String(session?.session?.username || "").trim();
  content.innerHTML = `
    <dl class="oc-platform-topbar-dialog__meta">
      <div>
        <dt>当前角色</dt>
        <dd>${role}</dd>
      </div>
      <div>
        <dt>当前登录</dt>
        <dd>${username}</dd>
      </div>
    </dl>
  `;
}

function syncPlatformTopbarMeta(session) {
  const search = document.querySelector(TOPBAR_SEARCH_SELECTOR);
  if (!(search instanceof HTMLElement)) {
    return;
  }
  ensureTopbarMetaStyle();
  ensureTopbarDialogs();
  const root = ensureTopbarMetaRoot(search);
  if (!(root instanceof HTMLElement)) {
    return;
  }
  const role = String(session?.session?.role || "").trim();
  const username = String(session?.session?.username || "").trim();
  if (
    root.getAttribute(TOPBAR_META_MODE_ATTR) === "meta" &&
    root.getAttribute(TOPBAR_META_ROLE_ATTR) === role &&
    root.getAttribute(TOPBAR_META_USER_ATTR) === username
  ) {
    return;
  }
  search.setAttribute(TOPBAR_HIDDEN_ATTR, "true");
  root.setAttribute(TOPBAR_META_MODE_ATTR, "meta");
  root.setAttribute(TOPBAR_META_ROLE_ATTR, role);
  root.setAttribute(TOPBAR_META_USER_ATTR, username);
  root.innerHTML = `
    <span class="pill"><span>当前角色</span><span class="mono">${role}</span></span>
    <button class="btn btn--ghost" type="button" data-oc-platform-profile>当前登录<span class="mono">${username}</span></button>
    <button class="btn btn--ghost" type="button" data-oc-platform-logout>退出登录</button>
  `;
  renderProfileDialog(session);
}

function clearPlatformTopbarMeta() {
  const search = document.querySelector(TOPBAR_SEARCH_SELECTOR);
  if (!(search instanceof HTMLElement)) {
    return;
  }
  search.removeAttribute(TOPBAR_HIDDEN_ATTR);
  const root = document.querySelector(TOPBAR_META_ROOT_SELECTOR);
  if (root instanceof HTMLElement) {
    root.remove();
  }
  for (const dialog of document.querySelectorAll(
    `${TOPBAR_PROFILE_DIALOG_SELECTOR}, ${TOPBAR_LOGOUT_DIALOG_SELECTOR}`,
  )) {
    closeDialog(dialog);
  }
}

function syncTenantRoleContext(role) {
  if (role === "platform_admin" || role === "tenant_admin" || role === "member") {
    document.documentElement.setAttribute(TENANT_ROLE_CONTEXT_ATTR, role);
    return;
  }
  document.documentElement.removeAttribute(TENANT_ROLE_CONTEXT_ATTR);
}

function ensureTopbarLogoutHandler() {
  if (document.documentElement.dataset.ocPlatformLogoutHandler === "true") {
    return;
  }
  document.documentElement.dataset.ocPlatformLogoutHandler = "true";
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const closeButton = target.closest(TOPBAR_DIALOG_CLOSE_SELECTOR);
    if (closeButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      const dialogType = closeButton.dataset.ocPlatformDialogClose || "";
      if (dialogType === "profile") {
        closeDialog(document.querySelector(TOPBAR_PROFILE_DIALOG_SELECTOR));
      }
      if (dialogType === "logout") {
        closeDialog(document.querySelector(TOPBAR_LOGOUT_DIALOG_SELECTOR));
      }
      return;
    }

    const profileButton = target.closest(TOPBAR_PROFILE_SELECTOR);
    if (profileButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      const session = readSessionForCurrentView();
      renderProfileDialog(session);
      showDialog(document.querySelector(TOPBAR_PROFILE_DIALOG_SELECTOR));
      return;
    }

    const logoutButton = target.closest(TOPBAR_LOGOUT_SELECTOR);
    if (logoutButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      showDialog(document.querySelector(TOPBAR_LOGOUT_DIALOG_SELECTOR));
      return;
    }

    const confirmButton = target.closest(TOPBAR_DIALOG_CONFIRM_LOGOUT_SELECTOR);
    if (!(confirmButton instanceof HTMLButtonElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const session = readSessionForCurrentView();
    const isPlatformAdmin = session?.session?.role === "platform_admin";
    const apiClient = createTenantApiClient();
    try {
      await apiClient.logout(isPlatformAdmin ? "platform" : "tenant");
    } catch {
      // Local session is cleared in the API client before the request, so redirect anyway.
    }
    if (!isPlatformAdmin) {
      clearSelectedTenantAgent();
    }
    closeDialog(document.querySelector(TOPBAR_LOGOUT_DIALOG_SELECTOR));
    clearPlatformTopbarMeta();
    window.location.href = isPlatformAdmin ? PLATFORM_LOGIN_ROUTE : TENANT_LOGIN_ROUTE;
  });
}

export function bootTenantEntry() {
  if (window.__openclawTenantEntryBooted) {
    return;
  }
  if (isLufengPublicPath()) {
    return;
  }
  window.__openclawTenantEntryBooted = true;
  bootTenantRouteSync();
  ensureTopbarLogoutHandler();

  const scan = (root = document) => {
    const session = readSessionForCurrentView();
    const role = String(session?.session?.role || "");
    const scope = root instanceof Element || root instanceof Document ? root : document;
    syncTenantRoleContext(role);
    if (isTenantAuthViewActive()) {
      clearPlatformTopbarMeta();
    } else if (role === "platform_admin" || role === "tenant_admin" || role === "member") {
      syncPlatformTopbarMeta(session);
    } else {
      clearPlatformTopbarMeta();
    }
    if (
      !isTenantAuthViewActive() &&
      (role === "platform_admin" || role === "tenant_admin" || role === "member")
    ) {
      if (scope instanceof Element && scope.matches(SIDEBAR_NAV_SELECTOR)) {
        ensureSidebarRouteHandlers(scope);
        ensureManagementSection(scope);
        syncSidebarNavForRole(scope, role);
      }
      for (const container of scope.querySelectorAll(SIDEBAR_NAV_SELECTOR)) {
        ensureSidebarRouteHandlers(container);
        ensureManagementSection(container);
        syncSidebarNavForRole(container, role);
      }
    }

    if (scope instanceof Element && scope.matches(SIDEBAR_UTILITY_SELECTOR)) {
      if (!role) {
        ensureTenantUtilityLink(scope);
      }
      syncSidebarUtilityForRole(scope, role);
    }
    for (const container of scope.querySelectorAll(SIDEBAR_UTILITY_SELECTOR)) {
      if (!role) {
        ensureTenantUtilityLink(container);
      }
      syncSidebarUtilityForRole(container, role);
    }
  };

  let scheduled = false;
  const scheduleScan = (root = document) => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      scan(root);
    });
  };

  scan(document);
  onTenantRouteChange(() => {
    scan(document);
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          const relevantRoot =
            node.closest?.(SIDEBAR_NAV_SELECTOR) ||
            node.closest?.(SIDEBAR_UTILITY_SELECTOR) ||
            node.closest?.(TOPBAR_SEARCH_SELECTOR) ||
            node.querySelector?.(SIDEBAR_NAV_SELECTOR) ||
            node.querySelector?.(SIDEBAR_UTILITY_SELECTOR) ||
            node.querySelector?.(TOPBAR_SEARCH_SELECTOR);
          if (relevantRoot instanceof Element) {
            scheduleScan(document);
            return;
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
}

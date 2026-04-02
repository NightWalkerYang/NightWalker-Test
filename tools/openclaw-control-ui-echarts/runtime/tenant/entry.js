import {
  PLATFORM_AGENT_ASSIGNMENT_ROUTE,
  PLATFORM_AGENT_ASSIGNMENT_VIEW,
  PLATFORM_TENANT_MANAGEMENT_ROUTE,
  PLATFORM_TENANT_MANAGEMENT_VIEW,
  TENANT_LOGIN_ROUTE,
  readTenantView,
  readTenantSession,
} from "./tenant-context.js";
import { isLufengPublicPath } from "../lufeng/context.js";

const SIDEBAR_NAV_SELECTOR = ".sidebar-nav";
const SIDEBAR_UTILITY_SELECTOR = ".sidebar-utility-group";
const MANAGEMENT_SECTION_CLASS = "oc-platform-management-section";

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
};

function createSectionLabel() {
  const label = document.createElement("button");
  label.type = "button";
  label.className = "nav-section__label";
  label.innerHTML = `
    <span class="nav-section__label-text">管理</span>
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

function createManagementSection() {
  const section = document.createElement("section");
  section.className = `nav-section ${MANAGEMENT_SECTION_CLASS}`;

  const label = createSectionLabel();
  const items = document.createElement("div");
  items.className = "nav-section__items";
  const links = [
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
  ];
  const activeView = readTenantView();
  for (const link of links) {
    const item = createNavItem({
      className: link.className,
      href: new URL(link.href, document.baseURI).href,
      title: link.title,
      text: link.text,
      icon: link.icon,
    });
    if (activeView === link.activeView) {
      item.classList.add("nav-item--active");
    }
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
  return section;
}

function ensureManagementSection(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.querySelector(`.${MANAGEMENT_SECTION_CLASS}`)) {
    return;
  }

  const section = createManagementSection();
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

export function bootTenantEntry() {
  if (window.__openclawTenantEntryBooted) {
    return;
  }
  if (isLufengPublicPath()) {
    return;
  }
  window.__openclawTenantEntryBooted = true;

  const scan = (root = document) => {
    const session = readTenantSession();
    const scope = root instanceof Element || root instanceof Document ? root : document;
    if (session?.session?.role === "platform_admin") {
      if (scope instanceof Element && scope.matches(SIDEBAR_NAV_SELECTOR)) {
        ensureManagementSection(scope);
      }
      for (const container of scope.querySelectorAll(SIDEBAR_NAV_SELECTOR)) {
        ensureManagementSection(container);
      }
    }

    if (scope instanceof Element && scope.matches(SIDEBAR_UTILITY_SELECTOR)) {
      ensureTenantUtilityLink(scope);
    }
    for (const container of scope.querySelectorAll(SIDEBAR_UTILITY_SELECTOR)) {
      ensureTenantUtilityLink(container);
    }
  };

  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          scan(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
}

import { PLATFORM_LOGIN_ROUTE, TENANT_LOGIN_ROUTE } from "./tenant-context.js";

const SIDEBAR_UTILITY_SELECTOR = ".sidebar-utility-group";

const ICONS = {
  platform: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.4A2.4 2.4 0 0 1 6.4 3h11.2A2.4 2.4 0 0 1 20 5.4v13.2a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 18.6Zm2.2.2v2.8h11.6V5.6Zm0 5v7.8h4.6v-7.8Zm6.2 0v3.2h5.4v-3.2Zm0 4.8v3h5.4v-3Z"></path>
    </svg>
  `,
  tenant: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4 7.4v1.4h16V7.4Zm-5.8 7.4h1.9v6.1H6.2Zm4.9 0H13v6.1h-1.9Zm4.8 0h1.9v6.1H16Zm-11.8 8H20V21H4Z"></path>
    </svg>
  `,
};

function createUtilityLink({ className, href, title, text, icon }) {
  const link = document.createElement("a");
  link.className = `nav-item sidebar-utility-link ${className}`;
  link.href = href;
  link.title = title;
  link.innerHTML = `
    <span class="nav-item__icon" aria-hidden="true">${icon}</span>
    <span class="nav-item__text">${text}</span>
  `;
  return link;
}

function ensureUtilityLink(container, options) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.querySelector(`.${options.className}`)) {
    return;
  }
  container.append(
    createUtilityLink({
      className: options.className,
      href: new URL(options.href, document.baseURI).href,
      title: options.title,
      text: options.text,
      icon: options.icon,
    }),
  );
}

export function bootTenantEntry() {
  if (window.__openclawTenantEntryBooted) {
    return;
  }
  window.__openclawTenantEntryBooted = true;

  const links = [
    {
      className: "oc-platform-admin-link",
      href: PLATFORM_LOGIN_ROUTE,
      title: "平台管理入口",
      text: "平台管理",
      icon: ICONS.platform,
    },
    {
      className: "oc-tenant-user-link",
      href: TENANT_LOGIN_ROUTE,
      title: "租户登录入口",
      text: "租户登录",
      icon: ICONS.tenant,
    },
  ];

  const scan = (root = document) => {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const applyLinks = (container) => {
      for (const link of links) {
        ensureUtilityLink(container, link);
      }
    };
    if (scope instanceof Element && scope.matches(SIDEBAR_UTILITY_SELECTOR)) {
      applyLinks(scope);
    }
    for (const container of scope.querySelectorAll(SIDEBAR_UTILITY_SELECTOR)) {
      applyLinks(container);
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

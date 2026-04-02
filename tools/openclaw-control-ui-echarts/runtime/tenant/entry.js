const LINK_SELECTOR = ".oc-tenant-platform-link";
const SIDEBAR_UTILITY_SELECTOR = ".sidebar-utility-group";
const TENANT_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7.2 12 3l8 4.2v1.3H4Z"></path>
    <path d="M6.2 9.6h1.9v6.4H6.2Zm4.8 0H13v6.4h-2Zm4.9 0h1.9v6.4h-1.9Z"></path>
    <path d="M4 18.2h16V21H4Z"></path>
  </svg>
`;

function resolveTenantHref() {
  return new URL("./tenant-login.html", document.baseURI).href;
}

function createTenantLink() {
  const link = document.createElement("a");
  link.className = "nav-item sidebar-utility-link oc-tenant-platform-link";
  link.href = resolveTenantHref();
  link.title = "租户平台";
  link.innerHTML = `
    <span class="nav-item__icon" aria-hidden="true">${TENANT_ICON}</span>
    <span class="nav-item__text">租户平台</span>
  `;
  return link;
}

function ensureTenantLink(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.querySelector(LINK_SELECTOR)) {
    return;
  }
  container.append(createTenantLink());
}

export function bootTenantEntry() {
  if (window.__openclawTenantEntryBooted) {
    return;
  }
  window.__openclawTenantEntryBooted = true;

  const scan = (root = document) => {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    if (scope instanceof Element && scope.matches(SIDEBAR_UTILITY_SELECTOR)) {
      ensureTenantLink(scope);
    }
    for (const container of scope.querySelectorAll(SIDEBAR_UTILITY_SELECTOR)) {
      ensureTenantLink(container);
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


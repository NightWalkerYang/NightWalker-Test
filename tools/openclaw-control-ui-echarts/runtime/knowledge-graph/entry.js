import { readSessionForCurrentView } from "../tenant/tenant-context.js";

const LINK_SELECTOR = ".oc-brand-settings-link";
const SIDEBAR_UTILITY_SELECTOR = ".sidebar-utility-group";
const BRAND_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5a3.5 3.5 0 0 1 3.47 3H19a1 1 0 1 1 0 2h-3.53A3.5 3.5 0 1 1 12 3.5Zm-6 8A3.5 3.5 0 0 1 9.47 15H19a1 1 0 1 1 0 2H9.47A3.5 3.5 0 1 1 6 11.5Z"></path>
  </svg>
`;

function createBrandSettingsLink() {
  const link = document.createElement("a");
  link.className = "nav-item sidebar-utility-link oc-brand-settings-link";
  link.href = "#";
  link.title = "更改品牌";
  link.innerHTML = `
    <span class="nav-item__icon" aria-hidden="true">${BRAND_ICON}</span>
    <span class="nav-item__text">更改品牌</span>
  `;
  return link;
}

function ensureBrandSettingsLink(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const session = readSessionForCurrentView();
  if (String(session?.session?.role || "") !== "platform_admin") {
    container.querySelector(LINK_SELECTOR)?.remove();
    return;
  }
  if (container.querySelector(LINK_SELECTOR)) {
    return;
  }
  container.append(createBrandSettingsLink());
}

export function bootKnowledgeGraphEntry() {
  if (window.__openclawKnowledgeGraphEntryBooted) {
    return;
  }
  window.__openclawKnowledgeGraphEntryBooted = true;

  const scan = (root = document) => {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    if (scope instanceof Element && scope.matches(SIDEBAR_UTILITY_SELECTOR)) {
      ensureBrandSettingsLink(scope);
    }
    for (const container of scope.querySelectorAll(SIDEBAR_UTILITY_SELECTOR)) {
      ensureBrandSettingsLink(container);
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

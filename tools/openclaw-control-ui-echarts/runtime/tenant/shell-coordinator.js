import {
  findBreadcrumb,
  findContentRoot,
  findSidebar,
  findSidebarUtilityGroup,
  findTopbarSearch,
} from "../framework/dom-compat.js";

const EMPTY_SHELL_READY = Object.freeze({
  sidebar: false,
  topbar: false,
  breadcrumb: false,
  content: false,
});
const TENANT_SHELL_EXCLUDED_SELECTOR =
  "[data-oc-member-canvas-annotation-root], [data-oc-member-canvas-annotation-drawer]";

function getRoot(context) {
  if (context?.root instanceof Document || context?.root instanceof Element) {
    return context.root;
  }
  return document;
}

export function findTenantShellSidebar(scope = document) {
  const compatSidebar = findSidebar(scope);
  if (compatSidebar instanceof HTMLElement) {
    return compatSidebar;
  }
  if (!(scope instanceof Element || scope instanceof Document)) {
    return null;
  }
  return scope.querySelector(".sidebar-nav, aside[aria-label*='navigation' i], nav") ?? null;
}

export function listTenantShellSidebarRoots(scope = document) {
  if (!(scope instanceof Element || scope instanceof Document)) {
    return [];
  }
  const roots = new Set();
  const direct = findTenantShellSidebar(scope);
  if (direct instanceof HTMLElement) {
    roots.add(direct);
  }
  for (const candidate of scope.querySelectorAll(
    ".sidebar-nav, aside[aria-label*='navigation' i], nav",
  )) {
    if (!(candidate instanceof HTMLElement)) {
      continue;
    }
    if (candidate.closest(TENANT_SHELL_EXCLUDED_SELECTOR)) {
      continue;
    }
    const resolved = findTenantShellSidebar(candidate);
    if (resolved instanceof HTMLElement && resolved === candidate) {
      roots.add(candidate);
    }
  }
  return Array.from(roots);
}

export function findTenantShellUtility(scope = document) {
  const compatUtility = findSidebarUtilityGroup(scope);
  if (compatUtility instanceof HTMLElement) {
    return compatUtility;
  }
  if (!(scope instanceof Element || scope instanceof Document)) {
    return null;
  }
  return scope.querySelector(".sidebar-utility-group, .sidebar-shell__footer, footer") ?? null;
}

export function listTenantShellUtilityRoots(scope = document) {
  if (!(scope instanceof Element || scope instanceof Document)) {
    return [];
  }
  const roots = new Set();
  const direct = findTenantShellUtility(scope);
  if (direct instanceof HTMLElement && direct === scope) {
    roots.add(direct);
  }
  for (const candidate of scope.querySelectorAll("div, footer, section")) {
    if (!(candidate instanceof HTMLElement)) {
      continue;
    }
    if (findTenantShellUtility(candidate) === candidate) {
      roots.add(candidate);
    }
  }
  return Array.from(roots);
}

export function findTenantShellTopbar(scope = document) {
  const compatSearch = findTopbarSearch(scope);
  if (compatSearch instanceof HTMLElement) {
    return compatSearch;
  }
  if (!(scope instanceof Element || scope instanceof Document)) {
    return null;
  }
  return (
    scope.querySelector(".topbar-search, [role='search'], button[aria-label*='搜索' i]") ?? null
  );
}

export function isRelevantTenantShellNode(node) {
  if (!(node instanceof Element)) {
    return false;
  }
  if (node.closest?.(TENANT_SHELL_EXCLUDED_SELECTOR)) {
    return false;
  }
  return Boolean(
    node.closest?.(".sidebar-nav, aside[aria-label*='navigation' i], nav") ||
    findTenantShellUtility(node) ||
    findTenantShellTopbar(node) ||
    node.querySelector?.(".sidebar-nav, aside[aria-label*='navigation' i], nav") ||
    node.querySelector?.(".sidebar-utility-group, .sidebar-shell__footer, footer") ||
    node.querySelector?.(".topbar-search, [role='search'], button[aria-label*='搜索' i]"),
  );
}

function toShellReady(anchors) {
  return {
    sidebar: Boolean(anchors.sidebar),
    topbar: Boolean(anchors.topbar),
    breadcrumb: Boolean(anchors.breadcrumb),
    content: Boolean(anchors.content),
  };
}

function createSnapshot(shellReady) {
  return {
    shellReady: {
      ...shellReady,
    },
  };
}

function applyShellReadyState(store, shellReady) {
  if (!store?.setState || !store?.getState) {
    return createSnapshot(shellReady);
  }

  const snapshot = store.getState();
  store.setState({
    ...snapshot,
    shellReady,
  });
  return store.getState();
}

export function createTenantShellCoordinator({ context, store, lifecycle } = {}) {
  const root = getRoot(context);
  let active = true;

  function resolveAnchors() {
    return {
      sidebar: findTenantShellSidebar(root),
      topbar: findTenantShellTopbar(root),
      breadcrumb: findBreadcrumb(root),
      content: findContentRoot(root),
    };
  }

  function forEachShellSection(scope, handlers = {}) {
    if (!active) {
      return;
    }
    const normalizedScope = scope instanceof Element || scope instanceof Document ? scope : root;
    if (typeof handlers.onSidebar === "function") {
      for (const container of listTenantShellSidebarRoots(normalizedScope)) {
        handlers.onSidebar(container);
      }
    }
    if (typeof handlers.onUtility === "function") {
      for (const container of listTenantShellUtilityRoots(normalizedScope)) {
        handlers.onUtility(container);
      }
    }
  }

  function sync() {
    if (!active) {
      return store?.getState?.() ?? createSnapshot(EMPTY_SHELL_READY);
    }

    const anchors = resolveAnchors();
    return applyShellReadyState(store, toShellReady(anchors));
  }

  function cleanup() {
    if (!active) {
      return store?.getState?.() ?? createSnapshot(EMPTY_SHELL_READY);
    }
    active = false;
    return applyShellReadyState(store, EMPTY_SHELL_READY);
  }

  lifecycle?.addCleanup?.(cleanup);

  return {
    forEachShellSection,
    isRelevantNode: isRelevantTenantShellNode,
    resolveAnchors,
    sync,
    cleanup,
  };
}

import {
  findBreadcrumb,
  findContentRoot,
  findSidebar,
  findTopbarSearch,
} from "../framework/dom-compat.js";

const EMPTY_SHELL_READY = Object.freeze({
  sidebar: false,
  topbar: false,
  breadcrumb: false,
  content: false,
});

function getRoot(context) {
  if (context?.root instanceof Document || context?.root instanceof Element) {
    return context.root;
  }
  return document;
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
      sidebar: findSidebar(root),
      topbar: findTopbarSearch(root),
      breadcrumb: findBreadcrumb(root),
      content: findContentRoot(root),
    };
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
    resolveAnchors,
    sync,
    cleanup,
  };
}

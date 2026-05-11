import {
  findBreadcrumb,
  findChatSurface,
  findSidebar,
  findTopbarSearch,
} from "../framework/dom-compat.js";

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

function applyShellReadyState(store, shellReady) {
  if (!store?.setState || !store?.getState) {
    return shellReady;
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
      content: findChatSurface(root),
    };
  }

  function sync() {
    if (!active) {
      return store?.getState?.() ?? {
        shellReady: {
          sidebar: false,
          topbar: false,
          breadcrumb: false,
          content: false,
        },
      };
    }

    const anchors = resolveAnchors();
    return applyShellReadyState(store, toShellReady(anchors));
  }

  function cleanup() {
    if (!active) {
      return store?.getState?.();
    }
    active = false;
    return applyShellReadyState(store, {
      sidebar: false,
      topbar: false,
      breadcrumb: false,
      content: false,
    });
  }

  lifecycle?.addCleanup?.(cleanup);

  return {
    resolveAnchors,
    sync,
    cleanup,
  };
}

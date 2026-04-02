const ROUTE_EVENT = "openclaw:tenant-route-change";
const PATCHED_ATTR = "__ocTenantRouteSyncPatched";

function dispatchRouteChange() {
  window.dispatchEvent(
    new CustomEvent(ROUTE_EVENT, {
      detail: {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
      },
    }),
  );
}

export function bootTenantRouteSync() {
  if (window.__openclawTenantRouteSyncBooted) {
    return;
  }
  window.__openclawTenantRouteSyncBooted = true;

  for (const method of ["pushState", "replaceState"]) {
    const original = window.history[method];
    if (typeof original !== "function" || original[PATCHED_ATTR]) {
      continue;
    }
    const patched = function patchedHistoryState(...args) {
      const result = original.apply(this, args);
      dispatchRouteChange();
      return result;
    };
    patched[PATCHED_ATTR] = true;
    window.history[method] = patched;
  }

  window.addEventListener("popstate", dispatchRouteChange);
  window.addEventListener("hashchange", dispatchRouteChange);
}

export function onTenantRouteChange(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  const wrapped = (event) => {
    listener(event?.detail ?? null);
  };
  window.addEventListener(ROUTE_EVENT, wrapped);
  return () => window.removeEventListener(ROUTE_EVENT, wrapped);
}

export function dispatchTenantRouteChange() {
  dispatchRouteChange();
}

export function navigateTenantRoute(href, { replace = false } = {}) {
  const target = new URL(href, document.baseURI);
  const current = new URL(window.location.href);
  if (current.href === target.href) {
    dispatchRouteChange();
    return;
  }
  window.history[replace ? "replaceState" : "pushState"]({}, "", target.href);
}

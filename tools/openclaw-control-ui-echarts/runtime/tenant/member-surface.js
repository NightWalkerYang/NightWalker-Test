import { observeMountTargets, resolvePrimaryMountRoot } from "../framework/mount-compat.js";
import { mountMemberConsolePage } from "./member-console-page.js";
import { bootTenantRouteSync, onTenantRouteChange } from "./route-sync.js";
import { TENANT_AGENT_SELECTOR_VIEW, readTenantSession, readTenantView } from "./tenant-context.js";

const ROOT_ATTR = "data-oc-member-surface-root";
const STYLE_ATTR = "data-oc-member-surface-style";
const ACTIVE_ATTR = "data-oc-member-surface-active";
let memberSurfaceScanToken = 0;
const MOUNT_SOURCE_TAG = "member-surface";

function isRootControlPath(pathname = window.location.pathname) {
  const normalized = String(pathname || "/").trim() || "/";
  return normalized === "/" || normalized.endsWith("/index.html");
}

function isMemberAgentRoute() {
  return (
    isRootControlPath(window.location.pathname) && readTenantView() === TENANT_AGENT_SELECTOR_VIEW
  );
}

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./member-surface.css", import.meta.url).href;
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
  root.className = "oc-member-surface-root";
  content.prepend(root);
  return root;
}

async function mountCurrentSurface(content) {
  if (!isMemberAgentRoute()) {
    content.removeAttribute(ACTIVE_ATTR);
    content.querySelector(`[${ROOT_ATTR}]`)?.remove();
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return null;
  }

  const session = readTenantSession();
  if (session?.session?.role !== "member") {
    return null;
  }

  ensureStyle();
  content.setAttribute(ACTIVE_ATTR, "true");
  const root = ensureRoot(content);
  await mountMemberConsolePage(root);
  return root;
}

export async function bootMemberSurface() {
  bootTenantRouteSync();

  const scan = async (scope = document) => {
    const scanToken = ++memberSurfaceScanToken;
    const content = resolvePrimaryMountRoot(scope, "", MOUNT_SOURCE_TAG);
    if (!(content instanceof HTMLElement)) {
      return null;
    }
    const result = await mountCurrentSurface(content);
    if (scanToken !== memberSurfaceScanToken) {
      return null;
    }
    if (!isMemberAgentRoute()) {
      content.removeAttribute(ACTIVE_ATTR);
      content.querySelector(`[${ROOT_ATTR}]`)?.remove();
      document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
      return null;
    }
    return result;
  };

  if (window.__openclawMemberSurfaceBooted) {
    return scan(document);
  }
  window.__openclawMemberSurfaceBooted = true;

  onTenantRouteChange(() => {
    void scan(document);
  });

  observeMountTargets(
    document,
    ({ scope }) => {
      if (scope instanceof Element && scope.closest?.(`[${ROOT_ATTR}]`)) {
        return;
      }
      void scan(scope);
    },
    MOUNT_SOURCE_TAG,
  );

  return scan(document);
}

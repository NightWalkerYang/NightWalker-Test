import { mountPlatformLoginPage } from "./platform-login-page.js";
import { mountTenantLoginPage } from "./login-page.js";
import { PLATFORM_LOGIN_VIEW, TENANT_LOGIN_VIEW, readTenantView } from "./tenant-context.js";

const ROOT_ATTR = "data-oc-tenant-auth-root";
const ACTIVE_ATTR = "data-oc-tenant-auth-active";
const STYLE_ATTR = "data-oc-tenant-auth-style";

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./auth-surface.css", import.meta.url).href;
  link.setAttribute(STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function ensureRoot() {
  let root = document.querySelector(`[${ROOT_ATTR}]`);
  if (root instanceof HTMLElement) {
    root.replaceChildren();
    return root;
  }
  root = document.createElement("main");
  root.setAttribute(ROOT_ATTR, "true");
  root.className = "oc-tenant-auth-root";
  document.body.append(root);
  return root;
}

export async function bootTenantAuthSurface() {
  const view = readTenantView();
  if (view !== PLATFORM_LOGIN_VIEW && view !== TENANT_LOGIN_VIEW) {
    document.body.removeAttribute(ACTIVE_ATTR);
    document.querySelector(`[${ROOT_ATTR}]`)?.remove();
    document.head.querySelector(`[${STYLE_ATTR}]`)?.remove();
    return null;
  }

  document.body.setAttribute(ACTIVE_ATTR, "true");
  ensureStyle();
  const root = ensureRoot();
  if (view === PLATFORM_LOGIN_VIEW) {
    return mountPlatformLoginPage(root);
  }
  return mountTenantLoginPage(root);
}

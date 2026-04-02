import { requireTenantSession } from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-tenant-wallet-page]";

export function bootTenantWalletPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["tenant_admin"]);
  if (!session) {
    return null;
  }
  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootTenantWalletPage();
  });
} else {
  bootTenantWalletPage();
}

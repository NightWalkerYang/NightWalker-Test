import { createTenantApiClient } from "./api-client.js";
import { requireTenantSession } from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-tenant-console-page]";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.textContent = text;
  feedback.classList.toggle("tenant-feedback--danger", isError);
}

function renderTenantList(root, tenants) {
  const container = root.querySelector("[data-tenant-list]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!tenants.length) {
    container.innerHTML = `<div class="tenant-empty">当前还没有租户，请先创建第一家租户。</div>`;
    return;
  }
  container.innerHTML = tenants
    .map(
      (tenant) => `
        <article class="tenant-item">
          <div class="tenant-item__row">
            <div class="tenant-item__title">${escapeHtml(tenant.name)}</div>
            <span class="tenant-chip">${escapeHtml(tenant.code)}</span>
            <span class="tenant-chip">${escapeHtml(tenant.deploymentMode === "local" ? "本地部署" : "公有云")}</span>
            <span class="tenant-chip">${escapeHtml(tenant.status)}</span>
          </div>
          <div class="tenant-item__row" style="margin-top:12px;">
            <span>成员 ${tenant.memberCount}</span>
            <span>Agent ${tenant.agentCount}</span>
            <span>钱包 ${tenant.walletBalance ?? 0} 积分</span>
            <span>人数上限 ${tenant.memberLimit ?? "-"}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

export async function bootPlatformTenantConsolePage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const session = requireTenantSession(["platform_admin"]);
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();

  async function refresh() {
    try {
      const tenants = await apiClient.listPlatformTenants();
      renderTenantList(root, tenants);
      setFeedback(root, "平台租户数据已刷新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  }

  root.querySelector("[data-platform-tenant-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await apiClient.createTenant(payload);
      form.reset();
      await refresh();
      setFeedback(root, "租户已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-platform-logout]")?.addEventListener("click", async () => {
    await apiClient.logout();
    window.location.href = "./tenant-login.html";
  });

  await refresh();
  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootPlatformTenantConsolePage();
  });
} else {
  void bootPlatformTenantConsolePage();
}


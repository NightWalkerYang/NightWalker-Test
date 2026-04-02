import { createTenantApiClient } from "./api-client.js";
import {
  TENANT_LOGIN_ROUTE,
  clearTenantSession,
  readTenantApiBaseOverride,
  redirectToRoleHome,
  readTenantSession,
  writeTenantApiBaseOverride,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-login-page]";

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.textContent = text;
  feedback.classList.toggle("tenant-feedback--danger", isError);
}

function toggleSetup(root, initialized) {
  root.querySelector("[data-tenant-setup-card]")?.toggleAttribute("hidden", initialized);
  root.querySelector("[data-tenant-login-card]")?.toggleAttribute("hidden", !initialized);
}

export async function bootPlatformLoginPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const session = readTenantSession();
  if (session?.session?.role === "platform_admin") {
    redirectToRoleHome(session.session);
    return null;
  }

  const apiBaseInput = root.querySelector('[name="apiBase"]');
  if (apiBaseInput instanceof HTMLInputElement) {
    apiBaseInput.value = readTenantApiBaseOverride();
  }

  try {
    const bootstrap = await apiClient.bootstrap();
    toggleSetup(root, bootstrap.initialized);
    setFeedback(
      root,
      bootstrap.initialized ? "请输入平台管理员账号密码登录。" : "当前还没有平台管理员，请先完成初始化。",
    );
  } catch (error) {
    toggleSetup(root, false);
    setFeedback(root, `租户平台 API 暂不可用：${error instanceof Error ? error.message : String(error)}`, true);
  }

  root.querySelector("[data-tenant-api-base-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (apiBaseInput instanceof HTMLInputElement) {
      writeTenantApiBaseOverride(apiBaseInput.value);
      window.location.reload();
    }
  });

  root.querySelector("[data-tenant-setup-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiClient.setupPlatformAdmin(payload);
      apiClient.persistSession(result);
      redirectToRoleHome(result.session);
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-tenant-login-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiClient.login(payload);
      if (result?.session?.role !== "platform_admin") {
        clearTenantSession();
        setFeedback(root, "当前入口仅允许平台管理员登录。", true);
        return;
      }
      apiClient.persistSession(result);
      redirectToRoleHome(result.session);
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-tenant-login-link]")?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = TENANT_LOGIN_ROUTE;
  });

  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootPlatformLoginPage();
  });
} else {
  void bootPlatformLoginPage();
}

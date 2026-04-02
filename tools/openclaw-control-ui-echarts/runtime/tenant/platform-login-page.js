import { createTenantApiClient } from "./api-client.js";
import { renderTenantAuthLayout } from "./auth-layout.js";
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

  renderTenantAuthLayout(root, {
    mode: "platform",
    eyebrow: "Platform Console",
    title: "平台管理员登录",
    subtitle: "平台管理员从这里完成初始化、租户创建、租户管理员创建、Agent 下发与平台级运营管理。",
    switchHref: TENANT_LOGIN_ROUTE,
    switchLabel: "租户登录入口",
    switchAttr: 'data-tenant-login-link',
    highlights: [
      "首次进入时，在这里初始化平台管理员账号。",
      "一个租户只允许一个租户管理员账号。",
      "平台管理员负责把已有 OpenClaw Agent 下发到租户。",
    ],
    loginEyebrow: "Platform Login",
    loginTitle: "平台管理员登录",
    loginSubtitle: "只有平台管理员可以从这个入口进入系统。",
    loginSubmitLabel: "进入平台管理台",
    setup: {
      eyebrow: "Bootstrap",
      title: "初始化平台管理员",
      subtitle: "当前系统还没有平台管理员，请先完成首次初始化。",
      usernameLabel: "平台管理员账号",
      passwordLabel: "平台管理员密码",
      submitLabel: "完成初始化",
    },
  });

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

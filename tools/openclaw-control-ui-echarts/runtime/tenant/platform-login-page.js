import { createTenantApiClient } from "./api-client.js";
import { renderTenantAuthLayout } from "./auth-layout.js";
import {
  TENANT_LOGIN_ROUTE,
  readPlatformSession,
  clearTenantSession,
  redirectToRoleHome,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-platform-login-page]";

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.hidden = !text;
  feedback.textContent = text;
  feedback.classList.remove("danger", "info");
  feedback.classList.add(isError ? "danger" : "info");
}

function showSetupMode(root, showSetup) {
  const setupForm = root.querySelector("[data-tenant-setup-form]");
  const loginForm = root.querySelector("[data-tenant-login-form]");
  if (setupForm instanceof HTMLElement) {
    if (showSetup) {
      setupForm.removeAttribute("hidden");
    } else {
      setupForm.setAttribute("hidden", "");
    }
  }
  if (loginForm instanceof HTMLElement) {
    if (showSetup) {
      loginForm.setAttribute("hidden", "");
    } else {
      loginForm.removeAttribute("hidden");
    }
  }
}

export async function mountPlatformLoginPage(root) {
  renderTenantAuthLayout(root, {
    title: "平台管理员登录",
    subtitle: "平台管理员从这里进入平台控制台，完成租户创建、Agent 下发和平台级运营管理。",
    switchHref: TENANT_LOGIN_ROUTE,
    switchLabel: "租户登录入口",
    switchAttr: 'data-tenant-login-link',
    loginTitle: "账号密码登录",
    loginSubtitle: "仅限平台管理员使用。",
    loginSubmitLabel: "登录",
    setup: {
      title: "初始化平台管理员",
      subtitle: "当前系统还没有平台管理员，请先完成首次初始化。",
      usernameLabel: "平台管理员账号",
      passwordLabel: "平台管理员密码",
      submitLabel: "完成初始化",
    },
  });

  const apiClient = createTenantApiClient();
  const session = readPlatformSession();
  if (session?.session?.role === "platform_admin") {
    redirectToRoleHome(session.session);
    return null;
  }

  try {
    const bootstrap = await apiClient.bootstrap();
    const initialized = Boolean(bootstrap.initialized);
    showSetupMode(root, !initialized);
    setFeedback(root, initialized ? "请输入平台管理员账号密码登录。" : "当前还没有平台管理员，请先完成初始化。");
  } catch (error) {
    showSetupMode(root, true);
    setFeedback(root, `租户平台 API 暂不可用：${error instanceof Error ? error.message : String(error)}`, true);
  }

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

export async function bootPlatformLoginPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  return mountPlatformLoginPage(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootPlatformLoginPage();
  });
} else {
  void bootPlatformLoginPage();
}

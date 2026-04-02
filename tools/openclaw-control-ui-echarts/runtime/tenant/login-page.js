import { createTenantApiClient } from "./api-client.js";
import { renderTenantAuthLayout } from "./auth-layout.js";
import {
  PLATFORM_LOGIN_ROUTE,
  clearTenantSession,
  readTenantApiBaseOverride,
  redirectToRoleHome,
  readTenantSession,
  writeTenantApiBaseOverride,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-tenant-login-page]";

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.textContent = text;
  feedback.classList.toggle("tenant-feedback--danger", isError);
}

export async function bootTenantLoginPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  renderTenantAuthLayout(root, {
    mode: "tenant",
    eyebrow: "Tenant Workspace",
    title: "租户登录",
    subtitle: "租户管理员与租户成员从这里进入系统，进入后再按角色进入租户管理台或 Agent 选择页。",
    switchHref: PLATFORM_LOGIN_ROUTE,
    switchLabel: "平台管理员入口",
    switchAttr: 'data-platform-login-link',
    highlights: [
      "租户管理员可创建成员，并给成员分配已下发到本租户的 Agent。",
      "租户成员登录后先进入 Agent 选择页，再进入对应聊天页。",
      "平台管理员不从该入口登录。",
    ],
    loginEyebrow: "Tenant Login",
    loginTitle: "账号密码登录",
    loginSubtitle: "仅租户管理员和租户成员可使用该入口。",
    loginSubmitLabel: "进入租户工作台",
    setup: null,
  });

  const apiClient = createTenantApiClient();
  const session = readTenantSession();
  if (session?.session?.role) {
    redirectToRoleHome(session.session);
    return null;
  }

  const apiBaseInput = root.querySelector('[name="apiBase"]');
  if (apiBaseInput instanceof HTMLInputElement) {
    apiBaseInput.value = readTenantApiBaseOverride();
  }

  try {
    const bootstrap = await apiClient.bootstrap();
    if (!bootstrap.initialized) {
      setFeedback(root, "平台管理员尚未初始化，请先从平台管理入口完成初始化。", true);
    } else {
      setFeedback(root, "请输入租户管理员或租户成员账号密码。");
    }
  } catch (error) {
    setFeedback(root, `租户平台 API 暂不可用：${error instanceof Error ? error.message : String(error)}`, true);
  }

  root.querySelector("[data-tenant-api-base-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (apiBaseInput instanceof HTMLInputElement) {
      writeTenantApiBaseOverride(apiBaseInput.value);
      window.location.reload();
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
      if (result?.session?.role === "platform_admin") {
        clearTenantSession();
        setFeedback(root, "平台管理员请使用平台管理入口登录。", true);
        return;
      }
      apiClient.persistSession(result);
      redirectToRoleHome(result.session);
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  root.querySelector("[data-platform-login-link]")?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = PLATFORM_LOGIN_ROUTE;
  });

  return { root };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootTenantLoginPage();
  });
} else {
  void bootTenantLoginPage();
}

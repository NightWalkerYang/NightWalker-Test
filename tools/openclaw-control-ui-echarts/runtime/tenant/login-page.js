import { createTenantApiClient } from "./api-client.js";
import { renderTenantAuthLayout } from "./auth-layout.js";
import {
  PLATFORM_LOGIN_ROUTE,
  clearTenantSession,
  redirectToRoleHome,
  readTenantSession,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-tenant-login-page]";

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

export async function mountTenantLoginPage(root) {
  renderTenantAuthLayout(root, {
    title: "租户登录",
    subtitle: "租户管理员和租户成员从这里登录，成功后进入各自的使用入口。",
    switchHref: PLATFORM_LOGIN_ROUTE,
    switchLabel: "平台管理员入口",
    switchAttr: 'data-platform-login-link',
    loginTitle: "账号密码登录",
    loginSubtitle: "仅限租户管理员和租户成员使用。",
    loginSubmitLabel: "登录",
    setup: null,
  });

  const apiClient = createTenantApiClient();
  const session = readTenantSession();
  if (session?.session?.role && session.session.role !== "platform_admin") {
    redirectToRoleHome(session.session);
    return null;
  }

  root.querySelector("[data-tenant-login-form]")?.removeAttribute("hidden");

  try {
    const bootstrap = await apiClient.bootstrap();
    if (!bootstrap.initialized) {
      setFeedback(root, "平台管理员尚未初始化，请先从平台管理员入口完成初始化。", true);
    } else {
      setFeedback(root, "请输入账号密码登录。");
    }
  } catch (error) {
    setFeedback(root, `租户平台 API 暂不可用：${error instanceof Error ? error.message : String(error)}`, true);
  }

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
        setFeedback(root, "平台管理员请使用平台管理员入口登录。", true);
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

export async function bootTenantLoginPage() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  return mountTenantLoginPage(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootTenantLoginPage();
  });
} else {
  void bootTenantLoginPage();
}

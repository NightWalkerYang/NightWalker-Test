import { createTenantApiClient } from "./api-client.js";
import { renderTenantAuthLayout } from "./auth-layout.js";
import {
  PLATFORM_LOGIN_ROUTE,
  clearTenantSession,
  redirectToRoleHome,
  readTenantSession,
} from "./tenant-context.js";

const PAGE_SELECTOR = "[data-oc-tenant-login-page]";

function describeLocalLicense(localLicense) {
  if (!localLicense || localLicense.edition !== "local") {
    return "";
  }
  if (localLicense.status === "active") {
    return `本地部署版当前授权有效，到期时间：${localLicense.expiresAt || "-"}`;
  }
  if (localLicense.status === "expired") {
    return `本地授权已到期，到期时间：${localLicense.expiresAt || "-"}。当前仅允许只读查看历史和统计。`;
  }
  if (localLicense.status === "missing") {
    return "当前本地部署版尚未导入授权。租户管理员仍可登录以导入授权，成员暂不可登录。";
  }
  return "当前本地授权无效。租户管理员仍可登录以重新导入授权，成员暂不可登录。";
}

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

export async function mountTenantLoginPage(root) {
  const apiClient = createTenantApiClient();
  const session = readTenantSession();
  let bootstrap;
  let isLocalEdition = false;
  try {
    bootstrap = await apiClient.bootstrap();
    isLocalEdition = bootstrap.edition === "local";
  } catch (error) {
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
    root.querySelector("[data-tenant-login-form]")?.removeAttribute("hidden");
    setFeedback(root, `租户平台 API 暂不可用：${error instanceof Error ? error.message : String(error)}`, true);
    return { root };
  }

  renderTenantAuthLayout(root, {
    title: isLocalEdition ? "本地部署登录" : "租户登录",
    subtitle: isLocalEdition
      ? "本地部署版只保留租户管理员和租户成员入口。"
      : "租户管理员和租户成员从这里登录，成功后进入各自的使用入口。",
    switchHref: isLocalEdition ? "" : PLATFORM_LOGIN_ROUTE,
    switchLabel: isLocalEdition ? "" : "平台管理员入口",
    switchAttr: isLocalEdition ? "" : 'data-platform-login-link',
    loginTitle: "账号密码登录",
    loginSubtitle: isLocalEdition
      ? "仅限本地部署版租户管理员和租户成员使用。"
      : "仅限租户管理员和租户成员使用。",
    loginSubmitLabel: "登录",
    setup:
      isLocalEdition && !bootstrap.initialized
        ? {
            title: "初始化租户管理员",
            subtitle: "当前本地部署版还没有租户管理员，请先完成首次初始化。",
            usernameLabel: "租户管理员账号",
            passwordLabel: "租户管理员密码",
            submitLabel: "完成初始化",
          }
        : null,
  });

  if (isLocalEdition && !bootstrap.initialized) {
    clearTenantSession();
    showSetupMode(root, true);
    setFeedback(root, "当前本地部署版还没有租户管理员，请先完成初始化。");
  } else {
    if (session?.session?.role && session.session.role !== "platform_admin") {
      redirectToRoleHome(session.session);
      return null;
    }
    root.querySelector("[data-tenant-login-form]")?.removeAttribute("hidden");
    const localMessage = describeLocalLicense(bootstrap.localLicense);
    if (!bootstrap.initialized) {
      setFeedback(root, "平台管理员尚未初始化，请先从平台管理员入口完成初始化。", true);
    } else {
      setFeedback(
        root,
        localMessage || "请输入账号密码登录。",
        !isLocalEdition &&
          (bootstrap.localLicense?.status === "missing" || bootstrap.localLicense?.status === "invalid"),
      );
    }
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

  root.querySelector("[data-tenant-setup-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiClient.setupLocalTenantAdmin(payload);
      apiClient.persistSession(result);
      redirectToRoleHome(result.session);
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  });

  if (!isLocalEdition) {
    root.querySelector("[data-platform-login-link]")?.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = PLATFORM_LOGIN_ROUTE;
    });
  }

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

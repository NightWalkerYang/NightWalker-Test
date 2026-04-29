import { createTenantApiClient } from "./api-client.js";
import { showTransientFeedbackToast } from "./feedback-toast.js";
import { renderTenantAuthLayout } from "./auth-layout.js";
import {
  clearPlatformSession,
  clearTenantSession,
  redirectToRoleHome,
  readPlatformSession,
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

function describeManagedNodeLease(nodeLease) {
  if (!nodeLease || typeof nodeLease !== "object") {
    return "当前受管节点尚未收到平台授权。租户管理员可只读登录，成员暂不可登录。";
  }
  if (nodeLease.status === "active") {
    return `当前受管节点授权有效，到期时间：${nodeLease.expiresAt || "-"}`;
  }
  if (nodeLease.status === "expired") {
    return `当前受管节点授权已到期，到期时间：${nodeLease.expiresAt || "-"}。当前仅允许只读查看历史和统计。`;
  }
  if (nodeLease.status === "disabled") {
    return "当前受管节点已被平台停用。租户管理员可只读登录，成员暂不可登录。";
  }
  return "当前受管节点尚未收到平台授权。租户管理员可只读登录，成员暂不可登录。";
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

async function redirectIfAuthenticated({ root, apiClient, nodeRole }) {
  const tenantSession = readTenantSession();
  if (tenantSession?.token && tenantSession?.session?.role && tenantSession.session.role !== "platform_admin") {
    try {
      await apiClient.me(tenantSession);
      redirectToRoleHome(tenantSession.session);
      return true;
    } catch (error) {
      if (error?.message === "account_disabled") {
        showTransientFeedbackToast(root, "账号未启用，请联系管理员。", true);
      }
      clearTenantSession();
    }
  }

  const platformSession = readPlatformSession();
  if (nodeRole !== "control-plane") {
    if (platformSession?.session?.role === "platform_admin") {
      clearPlatformSession();
    }
    return false;
  }

  if (platformSession?.token && platformSession?.session?.role === "platform_admin") {
    try {
      await apiClient.me(platformSession);
      redirectToRoleHome(platformSession.session);
      return true;
    } catch (error) {
      if (error?.message === "account_disabled") {
        showTransientFeedbackToast(root, "账号未启用，请联系管理员。", true);
      }
      clearPlatformSession();
    }
  }
  return false;
}

export async function mountTenantLoginPage(root) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./tenant-surface.css", import.meta.url).href;
  document.head.append(link);

  const apiClient = createTenantApiClient();
  let bootstrap;
  let isLocalEdition = false;
  let nodeRole = "control-plane";
  let needsSetup = false;
  let setupMode = "";

  try {
    bootstrap = await apiClient.bootstrap();
    isLocalEdition = bootstrap.edition === "local";
    nodeRole = String(bootstrap.nodeRole || (isLocalEdition ? "standalone-local" : "control-plane")).trim();
  } catch (error) {
    renderTenantAuthLayout(root, {
      title: "统一登录",
      subtitle: "平台管理员、租户管理员和租户成员使用同一入口登录。",
      switchHref: "",
      switchLabel: "",
      switchAttr: "",
      loginTitle: "账号密码登录",
      loginSubtitle: "请输入账号密码登录。",
      loginSubmitLabel: "登录",
      setup: null,
    });
    root.querySelector("[data-tenant-login-form]")?.removeAttribute("hidden");
    setFeedback(root, `租户平台 API 暂不可用：${error instanceof Error ? error.message : String(error)}`, true);
    return { root };
  }

  renderTenantAuthLayout(root, {
    title:
      nodeRole === "managed-node" ? "受管节点登录" : isLocalEdition ? "本地部署登录" : "统一登录",
    subtitle:
      nodeRole === "managed-node"
        ? "当前节点由平台统一授权并下发租户、成员与 Agent 分配。平台管理员不在此登录。"
        : isLocalEdition
          ? "本地部署版只保留租户管理员和租户成员入口。"
          : "平台管理员、租户管理员和租户成员使用同一入口登录。",
    switchHref: "",
    switchLabel: "",
    switchAttr: "",
    loginTitle: "账号密码登录",
    loginSubtitle:
      nodeRole === "managed-node"
        ? "仅限当前节点已同步下发的租户管理员和租户成员使用。"
        : isLocalEdition
          ? "仅限本地部署版租户管理员和租户成员使用。平台管理员不在本地版启用。"
          : "平台管理员、租户管理员和租户成员可使用账号密码登录。",
    loginSubmitLabel: "登录",
    setup: null,
  });

  if (nodeRole !== "control-plane") {
    clearPlatformSession();
  }
  if (await redirectIfAuthenticated({ root, apiClient, nodeRole })) {
    return null;
  }

  needsSetup = nodeRole === "managed-node" ? false : !bootstrap.initialized;
  if (needsSetup) {
    setupMode = isLocalEdition ? "local-tenant-admin" : "platform-admin";
    renderTenantAuthLayout(root, {
      title: isLocalEdition ? "本地部署登录" : "统一登录",
      subtitle: isLocalEdition
        ? "本地部署版只保留租户管理员和租户成员入口。"
        : "平台管理员、租户管理员和租户成员使用同一入口登录。",
      switchHref: "",
      switchLabel: "",
      switchAttr: "",
      loginTitle: "账号密码登录",
      loginSubtitle: isLocalEdition
        ? "仅限本地部署版租户管理员和租户成员使用。平台管理员不在本地版启用。"
        : "平台管理员、租户管理员和租户成员可使用账号密码登录。",
      loginSubmitLabel: "登录",
      setup: isLocalEdition
        ? {
            title: "初始化租户管理员",
            subtitle: "当前本地部署版还没有租户管理员，请先完成首次初始化。",
            usernameLabel: "租户管理员账号",
            passwordLabel: "租户管理员密码",
            submitLabel: "完成初始化",
          }
        : {
            title: "初始化平台管理员",
            subtitle: "当前系统还没有平台管理员，请先完成首次初始化。",
            usernameLabel: "平台管理员账号",
            passwordLabel: "平台管理员密码",
            submitLabel: "完成初始化",
          },
    });
    showSetupMode(root, true);
    clearTenantSession();
    setFeedback(
      root,
      isLocalEdition
        ? "当前本地部署版还没有租户管理员，请先完成初始化。"
        : "当前系统还没有平台管理员，请先完成初始化。",
      false,
    );
  } else {
    if (nodeRole === "managed-node" && !bootstrap.initialized) {
      root.querySelector("[data-tenant-login-form]")?.setAttribute("hidden", "");
      setFeedback(
        root,
        "当前受管节点尚未同步到租户数据，请先在控制面绑定节点并等待同步完成。",
        false,
      );
      return { root };
    }
    root.querySelector("[data-tenant-login-form]")?.removeAttribute("hidden");
    const localMessage =
      nodeRole === "managed-node"
        ? describeManagedNodeLease(bootstrap.nodeLease)
        : describeLocalLicense(bootstrap.localLicense);
    setFeedback(
      root,
      localMessage || "请输入账号密码登录。",
      Boolean(
        (isLocalEdition && bootstrap.localLicense?.status === "invalid") ||
          (nodeRole === "managed-node" &&
            (bootstrap.nodeLease?.status === "disabled" || bootstrap.nodeLease?.status === "missing")),
      ),
    );
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
      if (nodeRole !== "control-plane" && result?.session?.role === "platform_admin") {
        clearPlatformSession();
        setFeedback(root, "当前节点不支持平台管理员登录。", true);
        return;
      }
      apiClient.persistSession(result);
      redirectToRoleHome(result.session);
    } catch (error) {
      if (error?.message === "account_disabled") {
        showTransientFeedbackToast(root, "账号未启用，请联系管理员。", true);
        return;
      }
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
      const result =
        setupMode === "platform-admin"
          ? await apiClient.setupPlatformAdmin(payload)
          : await apiClient.setupLocalTenantAdmin(payload);
      apiClient.persistSession(result);
      redirectToRoleHome(result.session);
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
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

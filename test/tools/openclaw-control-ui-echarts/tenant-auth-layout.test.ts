/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { renderTenantAuthLayout } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/auth-layout.js";

describe("tenant auth layout", () => {
  it("renders native-style platform login card with setup form", () => {
    const root = document.createElement("main");
    renderTenantAuthLayout(root, {
      title: "平台管理员登录",
      subtitle: "平台管理员入口。",
      switchHref: "./?ocTenantView=tenant-login",
      switchLabel: "租户登录入口",
      switchAttr: 'data-tenant-login-link',
      loginTitle: "平台管理员登录",
      loginSubtitle: "仅平台管理员使用。",
      loginSubmitLabel: "登录",
      setup: {
        title: "初始化平台管理员",
        subtitle: "首次初始化。",
        usernameLabel: "平台管理员账号",
        passwordLabel: "平台管理员密码",
        submitLabel: "完成初始化",
      },
    });

    expect(root.querySelector(".login-gate")).not.toBeNull();
    expect(root.querySelectorAll(".login-gate__card")).toHaveLength(1);
    expect(root.querySelector("[data-tenant-login-link]")?.getAttribute("href")).toContain("ocTenantView=tenant-login");
    expect(root.querySelector("[data-tenant-setup-form]")).not.toBeNull();
    expect(root.textContent).toContain("平台管理员登录");
    expect(root.textContent).toContain("完成初始化");
  });

  it("renders native-style tenant login card without setup form", () => {
    const root = document.createElement("main");
    renderTenantAuthLayout(root, {
      title: "租户登录",
      subtitle: "租户入口。",
      switchHref: "./?ocTenantView=platform-login",
      switchLabel: "平台管理员入口",
      switchAttr: 'data-platform-login-link',
      loginTitle: "账号密码登录",
      loginSubtitle: "仅租户账号可用。",
      loginSubmitLabel: "登录",
      setup: null,
    });

    expect(root.querySelector(".login-gate")).not.toBeNull();
    expect(root.querySelectorAll(".login-gate__card")).toHaveLength(1);
    expect(root.querySelector("[data-platform-login-link]")?.getAttribute("href")).toContain("ocTenantView=platform-login");
    expect(root.querySelector("[data-tenant-setup-form]")).toBeNull();
    expect(root.textContent).toContain("账号密码登录");
  });

  it("omits the footer switch when no alternate login entry is provided", () => {
    const root = document.createElement("main");
    renderTenantAuthLayout(root, {
      title: "本地部署登录",
      subtitle: "本地入口。",
      switchHref: "",
      switchLabel: "",
      switchAttr: "",
      loginTitle: "账号密码登录",
      loginSubtitle: "仅租户账号可用。",
      loginSubmitLabel: "登录",
      setup: null,
    });

    expect(root.querySelector(".oc-tenant-login-footer")).toBeNull();
  });
});

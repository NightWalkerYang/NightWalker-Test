/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { renderTenantAuthLayout } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/auth-layout.js";

describe("tenant auth layout", () => {
  it("renders separate platform login affordances with setup panel", () => {
    const root = document.createElement("main");
    renderTenantAuthLayout(root, {
      mode: "platform",
      eyebrow: "Platform Console",
      title: "平台管理员登录",
      subtitle: "平台管理员入口。",
      switchHref: "./tenant-login.html",
      switchLabel: "租户登录入口",
      switchAttr: 'data-tenant-login-link',
      highlights: ["平台管理员负责租户管理。"],
      loginEyebrow: "Platform Login",
      loginTitle: "平台管理员登录",
      loginSubtitle: "仅平台管理员使用。",
      loginSubmitLabel: "进入平台管理台",
      setup: {
        eyebrow: "Bootstrap",
        title: "初始化平台管理员",
        subtitle: "首次初始化。",
        usernameLabel: "平台管理员账号",
        passwordLabel: "平台管理员密码",
        submitLabel: "完成初始化",
      },
    });

    expect(root.querySelector("[data-tenant-login-link]")?.getAttribute("href")).toContain(
      "tenant-login.html",
    );
    expect(root.querySelector("[data-tenant-setup-card]")).not.toBeNull();
    expect(root.textContent).toContain("平台管理员登录");
    expect(root.textContent).toContain("完成初始化");
  });

  it("renders tenant login without setup panel", () => {
    const root = document.createElement("main");
    renderTenantAuthLayout(root, {
      mode: "tenant",
      eyebrow: "Tenant Workspace",
      title: "租户登录",
      subtitle: "租户入口。",
      switchHref: "./platform-login.html",
      switchLabel: "平台管理员入口",
      switchAttr: 'data-platform-login-link',
      highlights: ["租户管理员和成员使用。"],
      loginEyebrow: "Tenant Login",
      loginTitle: "账号密码登录",
      loginSubtitle: "仅租户账号可用。",
      loginSubmitLabel: "进入租户工作台",
      setup: null,
    });

    expect(root.querySelector("[data-platform-login-link]")?.getAttribute("href")).toContain(
      "platform-login.html",
    );
    expect(root.querySelector("[data-tenant-setup-card]")).toBeNull();
    expect(root.textContent).toContain("账号密码登录");
  });
});

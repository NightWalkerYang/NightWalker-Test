/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootTenantEntry } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/entry.js";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawTenantEntryBooted;
  delete window.__openclawTenantRouteSyncBooted;
});

describe("zero-intrusive tenant entry", () => {
  it("injects a native-style management section for platform admins", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
        <section class="nav-section" data-native-group="agent"></section>
        <section class="nav-section" data-native-group="settings"></section>
      </nav>
      <div class="sidebar-utility-group"></div>
    `;

    bootTenantEntry();
    bootTenantEntry();

    const managementSection = document.querySelector(".oc-platform-management-section");
    expect(managementSection).not.toBeNull();
    expect(managementSection?.querySelector(".nav-section__label-text")?.textContent).toContain(
      "管理",
    );

    const items = managementSection?.querySelectorAll(".nav-item") ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("租户管理");
    expect(items[0]?.getAttribute("href")).toContain("ocTenantView=platform-tenants");
    expect(items[1]?.textContent).toContain("Agent 分配");
    expect(items[1]?.getAttribute("href")).toContain("ocTenantView=platform-agent-assignment");

    const chatGroup = document.querySelector('[data-native-group="chat"]');
    expect(managementSection?.nextElementSibling).toBe(chatGroup);
    expect(document.querySelector(".topbar-search")?.getAttribute("data-oc-platform-search-hidden")).toBe("true");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("当前角色");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("platform_admin");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("当前登录");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("platform-root");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("退出登录");
  });

  it("keeps a tenant login shortcut in the sidebar utility area", () => {
    document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;

    bootTenantEntry();

    const tenantLinks = document.querySelectorAll(".oc-tenant-user-link");
    expect(tenantLinks).toHaveLength(1);
    expect(tenantLinks[0]?.textContent).toContain("租户登录");
    expect(tenantLinks[0]?.getAttribute("href")).toContain("ocTenantView=tenant-login");
  });

  it("skips tenant sidebar injection on the public lufeng route", () => {
    window.history.replaceState({}, "", "/lufeng");
    document.body.innerHTML = `
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group"></div>
    `;

    bootTenantEntry();

    expect(document.querySelector(".oc-platform-management-section")).toBeNull();
    expect(document.querySelector(".oc-tenant-user-link")).toBeNull();
  });

  it("switches management views without forcing a full page reload", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
      },
    });
    document.body.innerHTML = `
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
    `;

    bootTenantEntry();

    const agentLink = document.querySelector(".oc-platform-agent-link");
    expect(agentLink).not.toBeNull();
    agentLink?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(window.location.search).toContain("ocTenantView=platform-agent-assignment");
    expect(agentLink?.classList.contains("nav-item--active")).toBe(true);
  });

  it("clears the management query when returning to a native sidebar route", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    window.history.replaceState({}, "", "/chat?ocTenantView=platform-tenants");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat">
          <div class="nav-section__items">
            <a class="nav-item" href="/chat"><span class="nav-item__text">聊天</span></a>
          </div>
        </section>
      </nav>
    `;

    bootTenantEntry();

    const chatLink = document.querySelector('a[href="/chat"]');
    chatLink?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(window.location.pathname).toBe("/chat");
    expect(window.location.search).not.toContain("ocTenantView");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("当前角色");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain("退出登录");
  });

  it("opens the platform profile dialog from the global topbar meta", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
    `;

    bootTenantEntry();

    const profileButton = document.querySelector("[data-oc-platform-profile]");
    expect(profileButton).not.toBeNull();
    profileButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    const dialog = document.querySelector("[data-oc-platform-profile-dialog]");
    expect(dialog?.hasAttribute("open") || dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain("platform-root");
  });

  it("opens the logout confirmation dialog from the global topbar meta", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
    `;

    bootTenantEntry();

    const logoutButton = document.querySelector("[data-oc-platform-logout]");
    expect(logoutButton).not.toBeNull();
    logoutButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    const dialog = document.querySelector("[data-oc-platform-logout-dialog]");
    expect(dialog?.hasAttribute("open") || dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain("确认退出");
  });
});

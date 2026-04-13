/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootTenantEntry } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/entry.js";
import {
  writeSelectedTenantAgent,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

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
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">文档</a>
        <a class="sidebar-utility-link oc-knowledge-graph-link">知识图谱</a>
      </div>
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
    expect(
      document.querySelector(".topbar-search")?.getAttribute("data-oc-platform-search-hidden"),
    ).toBe("true");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "当前角色",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "platform_admin",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "当前登录",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "platform-root",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "退出登录",
    );
    expect(document.querySelector('[data-native-group="chat"]')?.hidden).toBe(false);
    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems.map((item) => item.textContent?.trim())).toEqual(["文档", "知识图谱"]);
    expect(utilityItems[0]?.hidden).toBe(false);
    expect(utilityItems[1]?.hidden).toBe(true);
  });

  it("keeps a tenant login shortcut in the sidebar utility area", () => {
    document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;

    bootTenantEntry();

    const tenantLinks = document.querySelectorAll(".oc-tenant-user-link");
    expect(tenantLinks).toHaveLength(1);
    expect(tenantLinks[0]?.textContent).toContain("租户登录");
    expect(tenantLinks[0]?.getAttribute("href")).toContain("ocTenantView=login");
  });

  it("injects a native-style management section for tenant admins", () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">文档</a>
        <a class="sidebar-utility-link oc-knowledge-graph-link">知识图谱</a>
        <a class="sidebar-utility-link oc-tenant-user-link">租户登录</a>
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();

    const managementSection = document.querySelector(".oc-platform-management-section");
    const managementItems = managementSection?.querySelectorAll(".nav-item") ?? [];
    const statsSection = document.querySelector(".oc-tenant-stats-section");
    const statsItems = statsSection?.querySelectorAll(".nav-item") ?? [];
    expect(managementSection).not.toBeNull();
    expect(managementItems).toHaveLength(2);
    expect(managementItems[0]?.textContent).toContain("成员管理");
    expect(managementItems[0]?.getAttribute("href")).toContain("ocTenantView=tenant-members");
    expect(managementItems[1]?.textContent).toContain("Agent 分配");
    expect(managementItems[1]?.getAttribute("href")).toContain(
      "ocTenantView=tenant-agent-assignment",
    );
    expect(statsSection).not.toBeNull();
    expect(statsItems).toHaveLength(1);
    expect(statsItems[0]?.textContent).toContain("耗量统计");
    expect(statsItems[0]?.getAttribute("href")).toContain("ocTenantView=tenant-usage-stats");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "tenant_admin",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "tenant-admin",
    );
    expect(document.documentElement.getAttribute("data-oc-tenant-role-context")).toBe(
      "tenant_admin",
    );
    expect(document.querySelector('[data-native-group="chat"]')?.hidden).toBe(true);
    expect(document.querySelector('[data-native-group="control"]')?.hidden).toBe(true);
    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems).toHaveLength(4);
    expect(utilityItems[0]?.hidden).toBe(true);
    expect(utilityItems[1]?.hidden).toBe(true);
    expect(utilityItems[2]?.hidden).toBe(true);
    expect(utilityItems[3]?.hidden).toBe(false);
  });

  it("injects an Agent-only sidebar group for tenant members", () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">文档</a>
        <a class="sidebar-utility-link oc-knowledge-graph-link">知识图谱</a>
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();

    const section = document.querySelector(".oc-platform-management-section");
    const items = section?.querySelectorAll(".nav-item") ?? [];
    expect(section).not.toBeNull();
    expect(section?.querySelector(".nav-section__label-text")?.textContent).toContain("Agent");
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Agent选择");
    expect(items[0]?.getAttribute("href")).toContain("ocTenantView=tenant-agent-selector");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "member",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "member-user",
    );
    expect(document.documentElement.getAttribute("data-oc-tenant-role-context")).toBe("member");
    expect(document.querySelector('[data-native-group="chat"]')?.hidden).toBe(true);
    expect(document.querySelector('[data-native-group="control"]')?.hidden).toBe(true);
    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems).toHaveLength(3);
    expect(utilityItems[0] instanceof HTMLElement ? utilityItems[0].hidden : false).toBe(true);
    expect(utilityItems[1] instanceof HTMLElement ? utilityItems[1].hidden : false).toBe(true);
    expect(utilityItems[2] instanceof HTMLElement ? utilityItems[2].hidden : true).toBe(false);
  });

  it("does not keep the Agent selector menu in the sidebar on member chat routes", () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      status: "active",
    });
    window.history.replaceState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">文档</a>
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();

    expect(document.querySelector(".oc-platform-management-section")).toBeNull();
    expect(document.querySelector('[data-native-group="chat"]')?.hidden).toBe(true);
    expect(document.querySelector('[data-native-group="control"]')?.hidden).toBe(true);
  });

  it("prefers the tenant-admin sidebar when both platform and tenant sessions exist on a tenant view", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-members");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
      </nav>
    `;

    bootTenantEntry();

    const managementSection = document.querySelector(".oc-platform-management-section");
    const managementItems = managementSection?.querySelectorAll(".nav-item") ?? [];
    const statsSection = document.querySelector(".oc-tenant-stats-section");
    const statsItems = statsSection?.querySelectorAll(".nav-item") ?? [];
    expect(managementItems).toHaveLength(2);
    expect(managementItems[0]?.textContent).toContain("成员管理");
    expect(managementItems[1]?.textContent).toContain("Agent 分配");
    expect(statsSection).not.toBeNull();
    expect(statsItems).toHaveLength(1);
    expect(statsItems[0]?.textContent).toContain("耗量统计");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "tenant_admin",
    );
    expect(document.documentElement.getAttribute("data-oc-tenant-role-context")).toBe(
      "tenant_admin",
    );
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
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "当前角色",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "退出登录",
    );
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

  it("applies tenant-admin sidebar trimming to utility links added after boot", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();

    const utility = document.querySelector(".sidebar-utility-group");
    utility?.insertAdjacentHTML(
      "beforeend",
      `
        <a class="sidebar-utility-link">文档</a>
        <a class="sidebar-utility-link oc-knowledge-graph-link">知识图谱</a>
        <a class="sidebar-utility-link oc-tenant-user-link">租户登录</a>
      `,
    );

    await Promise.resolve();
    await Promise.resolve();

    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems).toHaveLength(4);
    expect(utilityItems[0] instanceof HTMLElement ? utilityItems[0].hidden : true).toBe(false);
    expect(utilityItems.slice(1).every((item) => item instanceof HTMLElement && item.hidden)).toBe(
      true,
    );
  });

  it("applies tenant-admin topbar meta when the topbar search is added after boot", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    document.body.innerHTML = `
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();

    document.body.insertAdjacentHTML(
      "afterbegin",
      `<button class="topbar-search"><span class="topbar-search__label">搜索</span></button>`,
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent ?? "").toContain(
      "tenant_admin",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent ?? "").toContain(
      "tenant-admin",
    );
    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems).toHaveLength(1);
    expect(utilityItems[0]?.textContent).toContain("版本");
    expect(utilityItems[0] instanceof HTMLElement ? utilityItems[0].hidden : true).toBe(false);
  });
});

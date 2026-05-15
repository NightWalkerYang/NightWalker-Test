/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootTenantEntry,
  resetTenantEntryForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/entry.js";
import {
  resolveTenantApiBaseCandidates,
  writeSelectedTenantAgent,
  writeTenantApiBaseOverride,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

function readRequestUrl(input) {
  if (input instanceof Request) {
    return new URL(input.url, "http://localhost");
  }
  return new URL(String(input || ""), "http://localhost");
}

function jsonResponse(data) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data,
    }),
  };
}

function stubVisualizationFetch(items = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = readRequestUrl(input);
      if (url.pathname.endsWith("/member/visualizations")) {
        return jsonResponse(items);
      }
      if (url.pathname.endsWith("/changelogs")) {
        return jsonResponse([]);
      }
      return jsonResponse([]);
    }),
  );
}

function stubVisualizationFetchSequence(sequence = [[]]) {
  let callCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = readRequestUrl(input);
      if (url.pathname.endsWith("/member/visualizations")) {
        const index = Math.min(callCount, Math.max(0, sequence.length - 1));
        const items = Array.isArray(sequence[index]) ? sequence[index] : [];
        callCount += 1;
        return jsonResponse(items);
      }
      if (url.pathname.endsWith("/changelogs")) {
        return jsonResponse([]);
      }
      return jsonResponse([]);
    }),
  );
}

function stubUpdateLogCrud(initialLogs = []) {
  const state = {
    logs: initialLogs.map((entry) => ({ ...entry })),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, options = {}) => {
      const url = readRequestUrl(input);
      const method = String(options?.method || (input instanceof Request ? input.method : "GET"))
        .trim()
        .toUpperCase();
      if (url.pathname.endsWith("/changelogs") && method === "GET") {
        return jsonResponse(
          [...state.logs].sort((left, right) =>
            String(right.publishedAt || right.createdAt || "").localeCompare(
              String(left.publishedAt || left.createdAt || ""),
            ),
          ),
        );
      }
      if (url.pathname.endsWith("/platform/changelogs") && method === "POST") {
        const payload = JSON.parse(String(options?.body || "{}"));
        const createdAt = "2026-04-23T08:00:00.000Z";
        const next = {
          id: `update-${state.logs.length + 1}`,
          versionLabel: payload.versionLabel,
          title: payload.title,
          content: payload.content,
          excerpt: String(payload.content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40),
          createdByUsername: "platform-root",
          publishedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        };
        state.logs = [next, ...state.logs];
        return jsonResponse(next);
      }
      if (url.pathname.endsWith("/platform/changelogs") && method === "PUT") {
        const payload = JSON.parse(String(options?.body || "{}"));
        state.logs = state.logs.map((entry) =>
          entry.id === payload.id
            ? {
                ...entry,
                versionLabel: payload.versionLabel,
                title: payload.title,
                content: payload.content,
                excerpt: String(payload.content || "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 40),
                updatedAt: "2026-04-23T09:30:00.000Z",
              }
            : entry,
        );
        return jsonResponse(state.logs.find((entry) => entry.id === payload.id) || null);
      }
      if (url.pathname.endsWith("/platform/changelogs") && method === "DELETE") {
        const targetId = url.searchParams.get("id");
        const target = state.logs.find((entry) => entry.id === targetId) || null;
        state.logs = state.logs.filter((entry) => entry.id !== targetId);
        return jsonResponse(target);
      }
      if (url.pathname.endsWith("/member/visualizations")) {
        return jsonResponse([]);
      }
      return jsonResponse([]);
    }),
  );
  return state;
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve,
  };
}

function flushAsync() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  resetTenantEntryForTests();
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  const visualizationPollTimer = window.__openclawMemberVisualizationPollTimer;
  if (typeof visualizationPollTimer === "number") {
    window.clearInterval(visualizationPollTimer);
  }
  delete window.__openclawMemberVisualizationPollTimer;
  document.head.querySelector("[data-oc-update-log-style]")?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("zero-intrusive tenant entry", () => {
  it("defaults tenant API candidates to the same-origin proxy path", () => {
    expect(resolveTenantApiBaseCandidates()).toEqual(["/tenant-platform-api/v1"]);
  });

  it("prefers an explicit tenant API override before the same-origin proxy path", () => {
    writeTenantApiBaseOverride("http://127.0.0.1:19999/tenant-platform-api/v1");

    expect(resolveTenantApiBaseCandidates()).toEqual([
      "http://127.0.0.1:19999/tenant-platform-api/v1",
      "/tenant-platform-api/v1",
    ]);
  });

  it("self-heals a stale direct-sidecar API override", () => {
    window.localStorage.setItem(
      "openclaw:tenant-platform:api-base:v1",
      "http://172.30.31.203:18801/tenant-platform-api/v1",
    );

    expect(resolveTenantApiBaseCandidates()).toEqual(["/tenant-platform-api/v1"]);
    expect(window.localStorage.getItem("openclaw:tenant-platform:api-base:v1")).toBeNull();
  });

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
    expect(items).toHaveLength(5);
    expect(items[0]?.textContent).toContain("租户管理");
    expect(items[0]?.getAttribute("href")).toContain("ocTenantView=platform-tenants");
    expect(items[1]?.textContent).toContain("Agent 分配");
    expect(items[1]?.getAttribute("href")).toContain("ocTenantView=platform-agent-assignment");
    expect(items[2]?.textContent).toContain("节点管理");
    expect(items[2]?.getAttribute("href")).toContain("ocTenantView=platform-nodes");
    expect(items[3]?.textContent).toContain("创建数据源");
    expect(items[3]?.getAttribute("href")).toContain("ocTenantView=platform-data-sources");
    expect(items[4]?.textContent).toContain("Skills");
    expect(items[4]?.getAttribute("href")).toContain("ocTenantView=platform-skills");

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
        edition: "cloud",
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
    const agentSection = document.querySelector(".oc-tenant-agent-section");
    const agentItems = agentSection?.querySelectorAll(".nav-item") ?? [];
    const statsSection = document.querySelector(".oc-tenant-stats-section");
    const statsItems = statsSection?.querySelectorAll(".nav-item") ?? [];
    const toolsSection = document.querySelector(".oc-tenant-tools-section");
    const toolsItems = toolsSection?.querySelectorAll(".nav-item") ?? [];
    const walletSection = document.querySelector(".oc-tenant-wallet-section");
    const walletItems = walletSection?.querySelectorAll(".nav-item") ?? [];
    expect(managementSection).not.toBeNull();
    expect(managementItems).toHaveLength(2);
    expect(managementItems[0]?.textContent).toContain("成员管理");
    expect(managementItems[0]?.getAttribute("href")).toContain("ocTenantView=tenant-members");
    expect(managementItems[1]?.textContent).toContain("Agent 分配");
    expect(managementItems[1]?.getAttribute("href")).toContain(
      "ocTenantView=tenant-agent-assignment",
    );
    expect(agentSection).not.toBeNull();
    expect(agentSection?.querySelector(".nav-section__label-text")?.textContent).toContain("Agent");
    expect(agentItems).toHaveLength(1);
    expect(agentItems[0]?.textContent).toContain("已有Agent");
    expect(agentItems[0]?.getAttribute("href")).toContain("ocTenantView=tenant-owned-agents");
    expect(statsSection).not.toBeNull();
    expect(statsItems).toHaveLength(2);
    expect(statsItems[0]?.textContent).toContain("统计总览");
    expect(statsItems[0]?.getAttribute("href")).toContain(
      "ocTenantView=tenant-statistics-overview",
    );
    expect(statsItems[1]?.textContent).toContain("耗量统计");
    expect(statsItems[1]?.getAttribute("href")).toContain("ocTenantView=tenant-usage-stats");
    expect(toolsSection).not.toBeNull();
    expect(toolsItems).toHaveLength(2);
    expect(toolsItems[0]?.textContent).toContain("市场");
    expect(toolsItems[0]?.getAttribute("href")).toContain("ocTenantView=tenant-skills-market");
    expect(toolsItems[1]?.textContent).toContain("技能分配");
    expect(toolsItems[1]?.getAttribute("href")).toContain("ocTenantView=tenant-skills-workbench");
    expect(walletSection).not.toBeNull();
    expect(walletItems).toHaveLength(4);
    expect(walletItems[0]?.textContent).toContain("钱包充值");
    expect(walletItems[0]?.getAttribute("href")).toContain("ocTenantView=tenant-wallet");
    expect(walletItems[1]?.textContent).toContain("充值订单");
    expect(walletItems[1]?.getAttribute("href")).toContain("ocTenantView=tenant-wallet-orders");
    expect(walletItems[2]?.textContent).toContain("模型耗用");
    expect(walletItems[2]?.getAttribute("href")).toContain("ocTenantView=tenant-wallet-ledger");
    expect(walletItems[3]?.textContent).toContain("钱包流水");
    expect(walletItems[3]?.getAttribute("href")).toContain("ocTenantView=tenant-wallet-flow");
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "tenant_admin",
    );
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "tenant-admin",
    );
    const topbarText = document.querySelector("[data-oc-platform-topbar-meta]")?.textContent ?? "";
    expect(topbarText).toContain("积分余额");
    expect(topbarText.indexOf("积分余额")).toBeLessThan(topbarText.indexOf("当前角色"));
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

  it("keeps tenant skills routes when clicking the tools sidebar links", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
        edition: "cloud",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-members");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();
    await flushAsync();

    const marketLink = document.querySelector(".oc-tenant-skills-market-link");
    expect(marketLink).not.toBeNull();

    marketLink?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    expect(new URL(window.location.href).searchParams.get("ocTenantView")).toBe(
      "tenant-skills-market",
    );
  });

  it("hides the wallet section for local-edition tenant admins", () => {
    writeTenantSession({
      token: "tenant-local-token",
      session: {
        role: "tenant_admin",
        username: "tenant-local-admin",
        edition: "local",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
        <section class="nav-section" data-native-group="control"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    bootTenantEntry();

    expect(document.querySelector(".oc-tenant-wallet-section")).toBeNull();
  });

  it("hides member-management and wallet sections for managed-node tenant admins", () => {
    writeTenantSession({
      token: "tenant-managed-node-token",
      session: {
        role: "tenant_admin",
        username: "tenant-managed-node-admin",
        edition: "cloud",
        nodeRole: "managed-node",
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
    const agentSection = document.querySelector(".oc-tenant-agent-section");
    const agentItems = agentSection?.querySelectorAll(".nav-item") ?? [];
    const statsSection = document.querySelector(".oc-tenant-stats-section");
    const statsItems = statsSection?.querySelectorAll(".nav-item") ?? [];
    const walletSection = document.querySelector(".oc-tenant-wallet-section");
    expect(managementSection).toBeNull();
    expect(agentSection).not.toBeNull();
    expect(agentItems).toHaveLength(1);
    expect(agentItems[0]?.textContent).toContain("已有Agent");
    expect(statsSection).not.toBeNull();
    expect(statsItems).toHaveLength(2);
    expect(statsItems[0]?.textContent).toContain("统计总览");
    expect(statsItems[1]?.textContent).toContain("耗量统计");
    expect(walletSection).toBeNull();
    const topbarText = document.querySelector("[data-oc-platform-topbar-meta]")?.textContent ?? "";
    expect(topbarText).toContain("tenant_admin");
    expect(topbarText).toContain("tenant-managed-node-admin");
    expect(topbarText).toContain("积分余额");
    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems).toHaveLength(4);
    expect(utilityItems[0]?.hidden).toBe(true);
    expect(utilityItems[1]?.hidden).toBe(true);
    expect(utilityItems[2]?.hidden).toBe(true);
    expect(utilityItems[3]?.hidden).toBe(false);
  });

  it("injects a member sidebar group with Agent selection and visualization", async () => {
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
    stubVisualizationFetch([
      {
        id: "tenant-agent-1:销售数据可视化_index.html",
        href: "/echarts-view/?token=member-visualization-token",
        tenantAgentId: "tenant-agent-1",
        agentId: "tenant-agent-1",
        agentName: "苏博泰克财务分析助手",
        visualizationName: "销售数据可视化",
        visualizationFileName: "销售数据可视化_index.html",
        title: "销售数据可视化 · 苏博泰克财务分析助手",
        token: "member-visualization-token",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const section = document.querySelector(".oc-platform-management-section");
    const items = section?.querySelectorAll(".nav-item") ?? [];
    const visualizationSection = document.querySelector(".oc-member-visualization-section");
    const visualizationItems = visualizationSection?.querySelectorAll(".nav-item") ?? [];
    expect(section).not.toBeNull();
    expect(section?.querySelector(".nav-section__label-text")?.textContent).toContain("Agent");
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Agent选择");
    expect(items[0]?.getAttribute("href")).toContain("ocTenantView=tenant-agent-selector");
    expect(visualizationSection).not.toBeNull();
    expect(visualizationSection?.querySelector(".nav-section__label-text")?.textContent).toContain(
      "可视化展示",
    );
    expect(visualizationItems).toHaveLength(1);
    expect(visualizationItems[0]?.textContent).toContain("销售数据可视化");
    expect(visualizationItems[0]?.getAttribute("href")).toContain("echarts-view/?token=");
    expect(visualizationItems[0]?.getAttribute("data-oc-tenant-agent-id")).toBe(
      "tenant-agent-1",
    );
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

  it("keeps the visualization menu in the sidebar on member chat routes", async () => {
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
    stubVisualizationFetch([
      {
        id: "tenant-agent-1:销售数据可视化_index.html",
        href: "/echarts-view/?token=member-visualization-token",
        agentId: "tenant-agent-1",
        agentName: "苏博泰克财务分析助手",
        visualizationName: "销售数据可视化",
        visualizationFileName: "销售数据可视化_index.html",
        title: "销售数据可视化 · 苏博泰克财务分析助手",
        token: "member-visualization-token",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const section = document.querySelector(".oc-platform-management-section");
    const visualizationSection = document.querySelector(".oc-member-visualization-section");
    const items = visualizationSection?.querySelectorAll(".nav-item") ?? [];
    expect(section).toBeNull();
    expect(visualizationSection).not.toBeNull();
    expect(visualizationSection?.querySelector(".nav-section__label-text")?.textContent).toContain(
      "可视化展示",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("销售数据可视化");
    expect(items[0]?.getAttribute("href")).toContain("echarts-view/?token=");
    expect(document.querySelector('[data-native-group="chat"]')?.hidden).toBe(true);
    expect(document.querySelector('[data-native-group="control"]')?.hidden).toBe(true);
  });

  it("updates member shell sections when the tenant route changes", async () => {
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
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;
    stubVisualizationFetch([
      {
        id: "tenant-agent-1:销售数据可视化_index.html",
        href: "/echarts-view/?token=member-visualization-token",
        agentId: "tenant-agent-1",
        agentName: "苏博泰克财务分析助手",
        visualizationName: "销售数据可视化",
        visualizationFileName: "销售数据可视化_index.html",
        title: "销售数据可视化 · 苏博泰克财务分析助手",
        token: "member-visualization-token",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const selectorSection = document.querySelector(".oc-platform-management-section");
    expect(selectorSection?.textContent).toContain("Agent选择");
    expect(selectorSection?.querySelectorAll(".nav-item")).toHaveLength(1);

    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      status: "active",
    });
    window.history.pushState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    await flushAsync();
    await flushAsync();

    expect(document.querySelector(".oc-platform-management-section")).toBeNull();
    const visualizationSection = document.querySelector(".oc-member-visualization-section");
    expect(visualizationSection).not.toBeNull();
    expect(visualizationSection?.textContent).toContain("销售数据可视化");
  });

  it("refreshes member visualizations without a full page reload", async () => {
    vi.useFakeTimers();
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
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;
    stubVisualizationFetchSequence([
      [],
      [
        {
          id: "tenant-agent-1:销售数据可视化_index.html",
          href: "/echarts-view/?token=member-visualization-token",
          agentId: "tenant-agent-1",
          agentName: "苏博泰克财务分析助手",
          visualizationName: "销售数据可视化",
          visualizationFileName: "销售数据可视化_index.html",
          title: "销售数据可视化 · 苏博泰克财务分析助手",
          token: "member-visualization-token",
        },
      ],
    ]);

    bootTenantEntry();
    await flushMicrotasks();

    expect(document.querySelector(".oc-member-visualization-section")).toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    const visualizationSection = document.querySelector(".oc-member-visualization-section");
    const items = visualizationSection?.querySelectorAll(".nav-item") ?? [];
    expect(visualizationSection).not.toBeNull();
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("销售数据可视化");
    expect(items[0]?.getAttribute("href")).toContain("echarts-view/?token=");
  });

  it("deduplicates the visualization menu when concurrent scans finish together", async () => {
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
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </div>
    `;

    const deferred = createDeferred();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => deferred.promise),
    );

    bootTenantEntry();
    await flushMicrotasks();

    document.querySelector(".sidebar-nav")?.append(document.createElement("div"));
    await flushMicrotasks();

    deferred.resolve({
      ok: true,
      json: async () => ({
        ok: true,
        data: [
          {
            id: "tenant-agent-1:销售数据可视化_index.html",
            href: "/echarts-view/?token=member-visualization-token",
            agentId: "tenant-agent-1",
            agentName: "苏博泰克财务分析助手",
            visualizationName: "销售数据可视化",
            visualizationFileName: "销售数据可视化_index.html",
            title: "销售数据可视化 · 苏博泰克财务分析助手",
            token: "member-visualization-token",
          },
        ],
      }),
    });
    await flushAsync();
    await flushMicrotasks();

    const sections = document.querySelectorAll(".oc-member-visualization-section");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.textContent).toContain("销售数据可视化");
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
    const agentSection = document.querySelector(".oc-tenant-agent-section");
    const agentItems = agentSection?.querySelectorAll(".nav-item") ?? [];
    const statsSection = document.querySelector(".oc-tenant-stats-section");
    const statsItems = statsSection?.querySelectorAll(".nav-item") ?? [];
    expect(managementItems).toHaveLength(2);
    expect(managementItems[0]?.textContent).toContain("成员管理");
    expect(managementItems[1]?.textContent).toContain("Agent 分配");
    expect(agentSection).not.toBeNull();
    expect(agentItems).toHaveLength(1);
    expect(agentItems[0]?.textContent).toContain("已有Agent");
    expect(statsSection).not.toBeNull();
    expect(statsItems).toHaveLength(2);
    expect(statsItems[0]?.textContent).toContain("统计总览");
    expect(statsItems[1]?.textContent).toContain("耗量统计");
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

  it("opens the latest update log automatically for tenant admins after login", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
        userId: "tenant-admin-id",
        tenantId: "tenant-alpha",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-statistics-overview");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.23</a>
      </div>
    `;
    stubUpdateLogCrud([
      {
        id: "update-1",
        versionLabel: "v2026.4.23",
        title: "更新日志展示上线",
        content: "1. 登录后自动弹窗。\n2. 支持右下角版本查看历史。",
        excerpt: "1. 登录后自动弹窗。 2. 支持右下角版本查看历史。",
        createdByUsername: "platform-root",
        publishedAt: "2026-04-23T07:00:00.000Z",
        createdAt: "2026-04-23T07:00:00.000Z",
        updatedAt: "2026-04-23T07:00:00.000Z",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const dialog = document.querySelector("[data-oc-update-log-history-dialog]");
    expect(dialog?.hasAttribute("open") || dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain("更新日志展示上线");
    expect(dialog?.textContent).toContain("登录后自动弹窗");
    expect(dialog?.textContent).toContain('点击页面左下角"版本"可打开更新日志');
    const createButton = document.querySelector("[data-oc-update-log-open-create]");
    const manageButton = document.querySelector("[data-oc-update-log-open-manage]");
    expect(createButton instanceof HTMLButtonElement ? createButton.hidden : false).toBe(true);
    expect(manageButton instanceof HTMLButtonElement ? manageButton.hidden : false).toBe(true);
    expect(createButton?.textContent ?? "").toBe("");
    expect(manageButton?.textContent ?? "").toBe("");
  });

  it("keeps update-log management actions hidden for members", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "member-user-id",
        tenantId: "tenant-alpha",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.23</a>
      </div>
    `;
    stubUpdateLogCrud([
      {
        id: "update-1",
        versionLabel: "v2026.4.23",
        title: "更新日志展示上线",
        content: "1. 登录后自动弹窗。\n2. 支持右下角版本查看历史。",
        excerpt: "1. 登录后自动弹窗。 2. 支持右下角版本查看历史。",
        createdByUsername: "platform-root",
        publishedAt: "2026-04-23T07:00:00.000Z",
        createdAt: "2026-04-23T07:00:00.000Z",
        updatedAt: "2026-04-23T07:00:00.000Z",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const versionLink = document.querySelector("[data-oc-utility-version]");
    versionLink?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const dialog = document.querySelector("[data-oc-update-log-history-dialog]");
    expect(dialog?.hasAttribute("open") || dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain('点击页面左下角"版本"可打开更新日志');
    expect(dialog?.textContent).not.toContain("新建更新");
    expect(dialog?.textContent).not.toContain("修改");
    const createButton = document.querySelector("[data-oc-update-log-open-create]");
    const manageButton = document.querySelector("[data-oc-update-log-open-manage]");
    expect(createButton instanceof HTMLButtonElement ? createButton.hidden : false).toBe(true);
    expect(manageButton instanceof HTMLButtonElement ? manageButton.hidden : false).toBe(true);
    expect(createButton?.textContent ?? "").toBe("");
    expect(manageButton?.textContent ?? "").toBe("");
  });

  it("does not inject tenant-entry sidebar sections into the update-log dialog subtree", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
        userId: "tenant-admin-id",
        tenantId: "tenant-alpha",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.23</a>
      </div>
    `;
    stubUpdateLogCrud([
      {
        id: "update-1",
        versionLabel: "v2026.4.23",
        title: "更新日志展示上线",
        content: "1. 登录后自动弹窗。\n2. 支持右下角版本查看历史。",
        excerpt: "1. 登录后自动弹窗。 2. 支持右下角版本查看历史。",
        createdByUsername: "platform-root",
        publishedAt: "2026-04-23T07:00:00.000Z",
        createdAt: "2026-04-23T07:00:00.000Z",
        updatedAt: "2026-04-23T07:00:00.000Z",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const versionLink = document.querySelector("[data-oc-utility-version]");
    versionLink?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const updateLogRoot = document.querySelector("[data-oc-update-log-root]");
    expect(updateLogRoot).not.toBeNull();
    expect(updateLogRoot?.querySelector(".oc-platform-management-section")).toBeNull();
    expect(updateLogRoot?.querySelector(".oc-tenant-agent-section")).toBeNull();
    expect(updateLogRoot?.querySelector(".oc-tenant-stats-section")).toBeNull();
    expect(updateLogRoot?.querySelector(".oc-tenant-wallet-section")).toBeNull();
  });

  it("lets platform admins create, edit, and delete update logs from the version dialog", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
        userId: "platform-root-id",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <nav class="sidebar-nav">
        <section class="nav-section" data-native-group="chat"></section>
      </nav>
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link">版本 v2026.4.23</a>
      </div>
    `;
    const updateLogState = stubUpdateLogCrud([
      {
        id: "update-1",
        versionLabel: "v2026.4.22",
        title: "旧版更新",
        content: "初始版本内容",
        excerpt: "初始版本内容",
        createdByUsername: "platform-root",
        publishedAt: "2026-04-22T07:00:00.000Z",
        createdAt: "2026-04-22T07:00:00.000Z",
        updatedAt: "2026-04-22T07:00:00.000Z",
      },
    ]);

    bootTenantEntry();
    await flushAsync();
    await flushAsync();

    const versionLink = document.querySelector("[data-oc-utility-version]");
    expect(versionLink).not.toBeNull();
    versionLink?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const historyDialog = document.querySelector("[data-oc-update-log-history-dialog]");
    expect(historyDialog?.textContent).toContain("旧版更新");
    expect(historyDialog?.textContent).toContain('点击页面左下角"版本"可打开更新日志');
    expect(historyDialog?.textContent).toContain("新建更新");
    expect(historyDialog?.textContent).toContain("修改");

    const createButton = document.querySelector("[data-oc-update-log-open-create]");
    createButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const editorForm = document.querySelector("[data-oc-update-log-editor-form]");
    expect(editorForm).not.toBeNull();
    const versionLabelInput = editorForm?.querySelector('input[name="versionLabel"]');
    const titleInput = editorForm?.querySelector('input[name="title"]');
    const contentInput = editorForm?.querySelector('textarea[name="content"]');
    if (
      versionLabelInput instanceof HTMLInputElement &&
      titleInput instanceof HTMLInputElement &&
      contentInput instanceof HTMLTextAreaElement
    ) {
      versionLabelInput.value = "v2026.4.23";
      titleInput.value = "新增更新日志中心";
      contentInput.value = "1. 支持平台管理员发布更新。\n2. 租户登录后可看到更新弹窗。";
    }
    editorForm?.dispatchEvent(
      new Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();
    await flushAsync();

    expect(updateLogState.logs[0]?.title).toBe("新增更新日志中心");
    expect(document.querySelector("[data-oc-update-log-history-dialog]")?.textContent).toContain(
      "新增更新日志中心",
    );

    const manageButton = document.querySelector("[data-oc-update-log-open-manage]");
    manageButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const editButton = document.querySelector('[data-oc-update-log-edit="update-1"]');
    editButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const editForm = document.querySelector("[data-oc-update-log-editor-form]");
    const editVersionLabelInput = editForm?.querySelector('input[name="versionLabel"]');
    const editTitleInput = editForm?.querySelector('input[name="title"]');
    const editContentInput = editForm?.querySelector('textarea[name="content"]');
    if (
      editVersionLabelInput instanceof HTMLInputElement &&
      editTitleInput instanceof HTMLInputElement &&
      editContentInput instanceof HTMLTextAreaElement
    ) {
      editVersionLabelInput.value = "v2026.4.22-hotfix1";
      editTitleInput.value = "旧版更新热修复";
      editContentInput.value = "1. 修复历史搜索。\n2. 修复详情展示。";
    }
    editForm?.dispatchEvent(
      new Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();
    await flushAsync();

    expect(updateLogState.logs.find((entry) => entry.id === "update-1")?.title).toBe(
      "旧版更新热修复",
    );

    const reopenManageButton = document.querySelector("[data-oc-update-log-open-manage]");
    reopenManageButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const deleteButton = document.querySelector('[data-oc-update-log-delete="update-1"]');
    deleteButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const confirmDeleteButton = document.querySelector("[data-oc-update-log-confirm-delete]");
    confirmDeleteButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();
    await flushAsync();

    expect(updateLogState.logs.some((entry) => entry.id === "update-1")).toBe(false);
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

    const topbarText = document.querySelector("[data-oc-platform-topbar-meta]")?.textContent ?? "";
    expect(topbarText).toContain("tenant_admin");
    expect(topbarText).toContain("tenant-admin");
    expect(topbarText).toContain("积分余额");
    expect(topbarText.indexOf("积分余额")).toBeLessThan(topbarText.indexOf("当前角色"));
    const utilityItems = [...document.querySelectorAll(".sidebar-utility-group > *")];
    expect(utilityItems).toHaveLength(1);
    expect(utilityItems[0]?.textContent).toContain("版本");
    expect(utilityItems[0] instanceof HTMLElement ? utilityItems[0].hidden : true).toBe(false);
  });

  it("uses dom-compat shell detection when sidebar and topbar classes drift", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
        edition: "cloud",
      },
    });
    document.body.innerHTML = `
      <button aria-label="搜索控制台">搜索</button>
      <aside aria-label="navigation sidebar">
        <section class="nav-section" data-native-group="chat"></section>
      </aside>
      <footer class="sidebar-shell__footer">
        <a class="sidebar-utility-link">版本 v2026.4.1</a>
      </footer>
    `;

    bootTenantEntry();
    await flushAsync();

    expect(document.querySelector(".oc-platform-management-section")).not.toBeNull();
    expect(document.querySelector(".oc-tenant-agent-section")).not.toBeNull();
    expect(document.querySelector(".oc-tenant-stats-section")).not.toBeNull();
    expect(document.querySelector("[data-oc-platform-topbar-meta]")?.textContent).toContain(
      "tenant_admin",
    );
  });

  it("injects tenant-admin sections into the native sidebar nav inside the upstream shell wrapper", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
        edition: "cloud",
      },
    });
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <aside class="sidebar" aria-label="primary navigation sidebar">
        <div class="sidebar-shell">
          <div class="sidebar-shell__header">
            <button type="button">toggle</button>
          </div>
          <div class="sidebar-shell__body">
            <nav class="sidebar-nav">
              <section class="nav-section" data-native-group="chat"></section>
              <section class="nav-section" data-native-group="control"></section>
            </nav>
          </div>
          <div class="sidebar-shell__footer">
            <div class="sidebar-utility-group">
              <a class="sidebar-utility-link">文档</a>
              <a class="sidebar-utility-link">版本 v2026.4.1</a>
            </div>
          </div>
        </div>
      </aside>
    `;

    bootTenantEntry();
    await flushAsync();

    const sidebarNav = document.querySelector(".sidebar-nav");
    const sidebarShell = document.querySelector(".sidebar-shell");
    expect(sidebarNav?.querySelector(":scope > .oc-platform-management-section")).not.toBeNull();
    expect(sidebarNav?.querySelector(":scope > .oc-tenant-agent-section")).not.toBeNull();
    expect(sidebarNav?.querySelector(":scope > .oc-tenant-stats-section")).not.toBeNull();
    expect(sidebarNav?.querySelector(":scope > .oc-tenant-wallet-section")).not.toBeNull();
    expect(sidebarShell?.querySelector(":scope > .oc-platform-management-section")).toBeNull();
    expect(
      document.querySelector(".sidebar-shell__header + .oc-platform-management-section"),
    ).toBeNull();
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootMemberChatSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js";
import {
  readHiddenTenantMemberSessions,
  writeSelectedTenantAgent,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

function createAppStub() {
  const app = document.createElement("openclaw-app");
  app.connected = true;
  app.client = {
    request: vi.fn(async (method) => {
      if (method !== "sessions.list") {
        throw new Error(`unexpected method: ${method}`);
      }
      return {
        sessions: [
          {
            key: "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
            label: "本周分析",
            updatedAt: Date.now(),
          },
          {
            key: "agent:subotech-finance:tenant-tenant-agent-1",
            label: "历史主会话",
            updatedAt: Date.now() - 60_000,
          },
          {
            key: "agent:other-agent:tenant:t-1:tenant-agent:tenant-agent-2:user:user-1:chat:ignore",
            label: "ignore",
            updatedAt: Date.now() - 120_000,
          },
        ],
      };
    }),
  };
  app.settings = {};
  app.sessionKey = "main";
  app.tab = "overview";
  app.setTab = vi.fn((next) => {
    app.tab = next;
  });
  app.applySettings = vi.fn((next) => {
    app.settings = next;
  });
  app.loadAssistantIdentity = vi.fn(async () => {});
  return app;
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
}

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawMemberChatSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("member chat surface", () => {
  it("mounts a member session sidebar on /chat and pins the latest assigned session", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "user-1",
        tenantId: "t-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      description: "财务分析",
      status: "active",
      balancePoints: 10,
    });
    window.history.replaceState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav">
        <section class="nav-section oc-platform-management-section" data-oc-role-nav="true">
          <div class="nav-section__items">
            <a class="nav-item" href="./?ocTenantView=tenant-agent-selector">Agent选择</a>
          </div>
        </section>
      </nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const section = document.querySelector("[data-oc-member-chat-section]");
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain("新建会话");
    expect(section?.textContent).toContain("本周分析");
    expect(section?.textContent).toContain("历史主会话");
    expect(section?.textContent).not.toContain("Agent选择");
    expect(document.querySelector("[data-oc-member-chat-top-action]")?.textContent).toContain("Agent选择");
    expect(document.querySelector("[data-oc-member-chat-top-action]")?.textContent).toContain("苏博泰克财务分析助手");
    expect(window.location.search).toContain("tenantAgentId=tenant-agent-1");
    expect(window.location.search).toContain("session=agent%3Asubotech-finance%3Atenant%3At-1%3Atenant-agent%3Atenant-agent-1%3Auser%3Auser-1%3Achat%3Alatest");
    expect(app.sessionKey).toBe(
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    expect(app.tab).toBe("chat");
  });

  it("creates a new member session and shows it in the sidebar list", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "user-1",
        tenantId: "t-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      description: "财务分析",
      status: "active",
      balancePoints: 10,
    });
    window.history.replaceState(
      {},
      "",
      "/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:existing",
    );
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav">
        <section class="nav-section oc-platform-management-section" data-oc-role-nav="true">
          <div class="nav-section__items">
            <a class="nav-item" href="./?ocTenantView=tenant-agent-selector">Agent选择</a>
          </div>
        </section>
      </nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const newButton = document.querySelector("[data-member-chat-new]");
    expect(newButton).not.toBeNull();
    newButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const decodedSearch = decodeURIComponent(window.location.search);
    expect(decodedSearch).toContain("tenantAgentId=tenant-agent-1");
    expect(decodedSearch).toContain("session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:");
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain("新会话");
  });

  it("shows a short toast instead of creating another draft session when already in a new session", async () => {
    vi.useFakeTimers();
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "user-1",
        tenantId: "t-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      description: "财务分析",
      status: "active",
      balancePoints: 10,
    });
    window.history.replaceState(
      {},
      "",
      "/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:draft",
    );
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav"></nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    const initialSearch = window.location.search;
    const newButton = document.querySelector("[data-member-chat-new]");
    expect(newButton).not.toBeNull();
    newButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(window.location.search).toBe(initialSearch);
    expect(document.querySelector("[data-oc-member-chat-toast]")?.textContent).toContain("已经是新的会话了");

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();

    expect(document.querySelector("[data-oc-member-chat-toast]")).toBeNull();
  });

  it("hides deleted sessions from the sidebar while keeping the current session usable", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "user-1",
        tenantId: "t-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      description: "财务分析",
      status: "active",
      balancePoints: 10,
    });
    window.history.replaceState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav"></nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const deleteButtons = [...document.querySelectorAll("[data-member-chat-delete]")];
    expect(deleteButtons).toHaveLength(2);
    deleteButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    expect(document.querySelector("[data-oc-member-chat-delete-dialog]")?.open).toBe(true);

    const confirmButton = document.querySelector("[data-oc-member-chat-confirm-delete]");
    expect(confirmButton).not.toBeNull();
    confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).not.toContain("历史主会话");
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain("本周分析");
    expect(readHiddenTenantMemberSessions({
      session: { tenantId: "t-1", userId: "user-1" },
    }, { id: "tenant-agent-1" })).toContain("agent:subotech-finance:tenant-tenant-agent-1");
  });

  it("keeps the session when delete dialog is canceled", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "user-1",
        tenantId: "t-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
      description: "财务分析",
      status: "active",
      balancePoints: 10,
    });
    window.history.replaceState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav"></nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const deleteButtons = [...document.querySelectorAll("[data-member-chat-delete]")];
    expect(deleteButtons).toHaveLength(2);
    deleteButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    expect(document.querySelector("[data-oc-member-chat-delete-dialog]")?.open).toBe(true);

    const cancelButton = document.querySelector("[data-oc-member-chat-delete-close]");
    expect(cancelButton).not.toBeNull();
    cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain("历史主会话");
    expect(readHiddenTenantMemberSessions({
      session: { tenantId: "t-1", userId: "user-1" },
    }, { id: "tenant-agent-1" })).not.toContain("agent:subotech-finance:tenant-tenant-agent-1");
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootMemberChatSurface,
  resetMemberChatSurfaceForTests,
  syncMemberChatSurface,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js";
import {
  writeSelectedTenantAgent,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

function createAppStub(overrides = {}) {
  const app = document.createElement("openclaw-app");
  app.connected = true;
  const customRequest = overrides.request;
  app.client = {
    request: vi.fn(async (method, params) => {
      if (typeof customRequest === "function") {
        return customRequest(method, params);
      }
      if (method === "chat.history") {
        return { messages: [] };
      }
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
  app.chatMessages = [];
  app.chatQueue = [];
  app.hello = overrides.hello ?? null;
  app.setTab = vi.fn((next) => {
    app.tab = next;
  });
  app.applySettings = vi.fn((next) => {
    app.settings = next;
  });
  if (overrides.settings && typeof overrides.settings === "object") {
    app.settings = { ...app.settings, ...overrides.settings };
  }
  app.password = overrides.password ?? null;
  app.loadAssistantIdentity = vi.fn(async () => {});
  app.requestUpdate = vi.fn(() => {});
  app.handleChatScroll = vi.fn(() => {});
  return app;
}

function installTenantApiFetchStub({ sessions = [], agents = [], historyPageHandler = null } = {}) {
  const state = {
    sessions: sessions.map((session) => ({ ...session })),
    agents: agents.map((agent) => ({ ...agent })),
    usageSyncPayloads: [],
    historyPageCalls: [],
  };
  globalThis.fetch = vi.fn(async (input, options = {}) => {
    const url = String(input);
    const method = String(options.method || "GET").toUpperCase();
    const okJson = (data) => ({
      ok: true,
      json: async () => ({
        ok: true,
        data,
      }),
    });
    if (url.includes("/member/sessions?")) {
      return okJson(state.sessions);
    }
    if (url.endsWith("/member/agents")) {
      return okJson(state.agents);
    }
    if (url.endsWith("/member/sessions") && method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      const existing = state.sessions.find(
        (session) => session.openclawSessionKey === body.openclawSessionKey,
      );
      if (existing) {
        existing.title = body.title;
        existing.hiddenAt = null;
        existing.updatedAt = new Date().toISOString();
      } else {
        state.sessions.push({
          openclawSessionKey: body.openclawSessionKey,
          title: body.title,
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        });
      }
      return okJson({ sessionId: "session-1" });
    }
    if (url.endsWith("/member/sessions/hide") && method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      const existing = state.sessions.find(
        (session) => session.openclawSessionKey === body.openclawSessionKey,
      );
      if (existing) {
        existing.hiddenAt = new Date().toISOString();
      } else {
        state.sessions.push({
          openclawSessionKey: body.openclawSessionKey,
          title: "新会话",
          updatedAt: new Date().toISOString(),
          hiddenAt: new Date().toISOString(),
        });
      }
      return okJson({});
    }
    if (url.endsWith("/member/sessions/delete") && method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      state.sessions = state.sessions.filter(
        (session) => session.openclawSessionKey !== body.openclawSessionKey,
      );
      return okJson({});
    }
    if (url.endsWith("/member/usage-records/sync") && method === "POST") {
      const body = JSON.parse(String(options.body || "{}"));
      state.usageSyncPayloads.push(body);
      return okJson({
        inserted: Array.isArray(body.records) ? body.records.length : 0,
        updated: 0,
        total: Array.isArray(body.records) ? body.records.length : 0,
      });
    }
    if (url.includes("/member/sessions/history?") && method === "GET") {
      const parsedUrl = new URL(url, "https://tenant.local");
      const sessionKey = parsedUrl.searchParams.get("openclawSessionKey") || "";
      const cursor = parsedUrl.searchParams.get("cursor") || "";
      const limit = parsedUrl.searchParams.get("limit") || "";
      state.historyPageCalls.push({
        sessionKey,
        cursor,
        limit,
      });
      if (typeof historyPageHandler === "function") {
        const body = await historyPageHandler({ sessionKey, cursor, limit, url });
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: body,
          }),
        };
      }
      return okJson({
        sessionKey,
        messages: [],
        hasMore: false,
        nextCursor: "",
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  return state;
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
}

function attachChatThread(
  app,
  { clientHeight = 240, baseHeight = 200, perMessageHeight = 100 } = {},
) {
  const chatSurface = document.createElement("main");
  chatSurface.className = "content--chat";
  const thread = document.createElement("div");
  thread.className = "chat-thread";
  thread.style.overflowY = "auto";
  let scrollTop = 0;
  Object.defineProperty(thread, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value) => {
      scrollTop = Number(value || 0);
    },
  });
  Object.defineProperty(thread, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(thread, "scrollHeight", {
    configurable: true,
    get: () =>
      baseHeight +
      (Array.isArray(app.chatMessages) ? app.chatMessages.length : 0) * perMessageHeight,
  });
  Object.defineProperty(thread, "scrollTo", {
    configurable: true,
    value: vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === "number") {
        scrollTop = options;
        return;
      }
      scrollTop = Number(options?.top || 0);
    }),
  });
  thread.addEventListener("scroll", (event) => {
    if (typeof app.handleChatScroll === "function") {
      app.handleChatScroll(event);
    }
  });
  chatSurface.append(thread);
  app.append(chatSurface);
  return thread;
}

afterEach(() => {
  resetMemberChatSurfaceForTests();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("member chat surface", () => {
  it("mounts a member session sidebar on /chat and pins the latest assigned session", async () => {
    installTenantApiFetchStub();
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
    expect(document.querySelector("[data-oc-member-chat-top-action]")?.textContent).toContain(
      "Agent选择",
    );
    expect(document.querySelector("[data-oc-member-chat-top-action]")?.textContent).toContain(
      "苏博泰克财务分析助手",
    );
    expect(window.location.search).toContain("tenantAgentId=tenant-agent-1");
    expect(window.location.search).toContain(
      "session=agent%3Asubotech-finance%3Atenant%3At-1%3Atenant-agent%3Atenant-agent-1%3Auser%3Auser-1%3Achat%3Alatest",
    );
    expect(app.sessionKey).toBe(
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    expect(app.tab).toBe("chat");
  });

  it("collapses the member session section when clicking the session chevron", async () => {
    installTenantApiFetchStub();
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

    const section = document.querySelector("[data-oc-member-chat-section]");
    const collapseButton = section?.querySelector("[data-member-chat-collapse]");
    const items = section?.querySelector(":scope > .nav-section__items");
    expect(section).not.toBeNull();
    expect(collapseButton).not.toBeNull();
    expect(items).not.toBeNull();
    expect(section?.classList.contains("nav-section--collapsed")).toBe(false);
    expect(collapseButton?.getAttribute("aria-expanded")).toBe("true");
    expect(items?.hasAttribute("hidden")).toBe(false);
    expect(items instanceof HTMLElement ? window.getComputedStyle(items).display : "").not.toBe(
      "none",
    );

    collapseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    expect(section?.classList.contains("nav-section--collapsed")).toBe(true);
    expect(collapseButton?.getAttribute("aria-expanded")).toBe("false");
    expect(items?.hasAttribute("hidden")).toBe(true);
    expect(items instanceof HTMLElement ? window.getComputedStyle(items).display : "").toBe("none");
    expect(items?.textContent).toContain("新建会话");
    expect(items?.textContent).toContain("本周分析");
  });

  it("heals a direct member chat route when the stored selected Agent is stale", async () => {
    installTenantApiFetchStub({
      agents: [
        {
          id: "tenant-agent-1",
          agentId: "subotech-finance",
          agentName: "苏博泰克财务分析助手",
          description: "财务分析",
          status: "active",
          balancePoints: 10,
        },
      ],
    });
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        userId: "user-1",
        tenantId: "t-1",
      },
    });
    window.localStorage.setItem(
      "openclaw:tenant-platform:selected-agent:v1",
      JSON.stringify({
        id: "tenant-agent-old",
        agentId: "stale-agent",
        agentName: "旧 Agent",
        balancePoints: 0,
      }),
    );
    window.history.replaceState(
      {},
      "",
      "/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
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
    await flush();
    await flush();

    expect(document.querySelector("[data-oc-member-chat-section]")).not.toBeNull();
    expect(app.sessionKey).toBe(
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    expect(
      JSON.parse(window.localStorage.getItem("openclaw:tenant-platform:selected-agent:v1") || "{}"),
    ).toMatchObject({
      id: "tenant-agent-1",
      agentId: "subotech-finance",
      agentName: "苏博泰克财务分析助手",
    });
  });

  it("does not resync member chat after rendering its own chrome", async () => {
    installTenantApiFetchStub();
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
    await flush();

    const requestedMethods = app.client.request.mock.calls.map(([method]) => method);
    expect(requestedMethods.filter((method) => method === "sessions.list")).toHaveLength(1);
    expect(requestedMethods.filter((method) => method === "chat.history")).toHaveLength(1);
  });

  it("reuses the native sessions cache before asking the gateway again", async () => {
    installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "本周分析",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
      ],
    });
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
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "chat.history") {
          return { messages: [] };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    app.sessionsResult = {
      sessions: [
        {
          key: "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          label: "本周分析",
          updatedAt: Date.now(),
        },
      ],
    };
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    const requestedMethods = app.client.request.mock.calls.map(([method]) => method);
    expect(requestedMethods.filter((method) => method === "sessions.list")).toHaveLength(0);
    expect(requestedMethods.filter((method) => method === "chat.history")).toHaveLength(1);
  });

  it("prepends older member history through the HTTP endpoint when scrolling to the top", async () => {
    const latestSessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const apiState = installTenantApiFetchStub({
      historyPageHandler: async ({ cursor }) => {
        if (cursor === "id:m3") {
          return {
            messages: [
              {
                role: "user",
                content: "我想给苏博泰克公司做一个官网，你可以上网...",
                __openclaw: { id: "m1", seq: 1 },
              },
              {
                role: "assistant",
                content: "可以，先确认目标受众。",
                __openclaw: { id: "m2", seq: 2 },
              },
            ],
            hasMore: false,
            nextCursor: "",
            echoCursor: cursor,
          };
        }
        return {
          messages: [],
          hasMore: false,
          nextCursor: "",
          echoCursor: cursor,
        };
      },
    });
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: latestSessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return {
            messages: [
              {
                role: "user",
                content: "现在我们开始上传素材吧",
                __openclaw: { id: "m3", seq: 1 },
              },
              {
                role: "assistant",
                content: "好的",
                __openclaw: { id: "m4", seq: 2 },
              },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    const thread = attachChatThread(app);
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    expect(app.chatMessages.map((message) => message?.__openclaw?.id)).toEqual(["m3", "m4"]);

    thread.scrollTop = 0;
    thread.dispatchEvent(new Event("scroll"));
    await flush();
    await flush();

    expect(apiState.historyPageCalls).toHaveLength(1);
    expect(apiState.historyPageCalls[0]).toMatchObject({
      sessionKey: latestSessionKey,
      cursor: "id:m3",
      limit: "200",
    });
    expect(app.chatMessages.map((message) => message?.__openclaw?.id)).toEqual([
      "m1",
      "m2",
      "m3",
      "m4",
    ]);
    expect(thread.scrollTop).toBe(200);
  });

  it("dedupes overlapping older history pages and stops reloading when the endpoint says there is no more history", async () => {
    const latestSessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const apiState = installTenantApiFetchStub({
      historyPageHandler: async () => ({
        messages: [
          {
            role: "user",
            content: "重复的较早消息",
            __openclaw: { id: "m2", seq: 2 },
          },
          {
            role: "assistant",
            content: "真正新增的较早回复",
            __openclaw: { id: "m3", seq: 3 },
          },
        ],
        hasMore: false,
        nextCursor: "",
      }),
    });
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: latestSessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return {
            messages: [
              {
                role: "user",
                content: "已加载的用户消息",
                __openclaw: { id: "m2", seq: 1 },
              },
              {
                role: "assistant",
                content: "已加载的助手消息",
                __openclaw: { id: "m4", seq: 2 },
              },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    const thread = attachChatThread(app);
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    thread.scrollTop = 0;
    thread.dispatchEvent(new Event("scroll"));
    await flush();
    await flush();

    expect(app.chatMessages.map((message) => message?.__openclaw?.id)).toEqual(["m2", "m3", "m4"]);
    expect(apiState.historyPageCalls).toHaveLength(1);

    thread.scrollTop = 0;
    thread.dispatchEvent(new Event("scroll"));
    await flush();
    await flush();

    expect(apiState.historyPageCalls).toHaveLength(1);
  });

  it("drops an older history page if the user switches member sessions before the HTTP page resolves", async () => {
    const latestSessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const olderSessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:older";
    let resolveHistoryPage;
    const apiState = installTenantApiFetchStub({
      historyPageHandler: async () =>
        new Promise((resolve) => {
          resolveHistoryPage = resolve;
        }),
    });
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
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: latestSessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
              },
              {
                key: olderSessionKey,
                label: "历史主会话",
                updatedAt: Date.now() - 60_000,
              },
            ],
          };
        }
        if (method === "chat.history") {
          if (
            String(params?.sessionKey || "")
              .trim()
              .toLowerCase() === olderSessionKey
          ) {
            return {
              messages: [
                {
                  role: "user",
                  content: "旧会话消息",
                  __openclaw: { seq: 10 },
                },
              ],
            };
          }
          return {
            messages: [
              {
                role: "user",
                content: "当前会话消息",
                __openclaw: { seq: 3 },
              },
              {
                role: "assistant",
                content: "当前会话回复",
                __openclaw: { seq: 4 },
              },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    const thread = attachChatThread(app);
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    thread.scrollTop = 0;
    thread.dispatchEvent(new Event("scroll"));
    await flush();

    const olderSessionButton = document.querySelector(
      `[data-member-chat-session="${olderSessionKey}"]`,
    );
    olderSessionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    resolveHistoryPage?.({
      messages: [
        {
          role: "user",
          content: "不该注入的新页",
          __openclaw: { seq: 1 },
        },
      ],
      hasMore: false,
      nextCursor: "",
    });
    await flush();
    await flush();

    expect(apiState.historyPageCalls).toHaveLength(1);
    expect(window._ocMemberChatSurfaceController?.currentSessionKey).toBe(olderSessionKey);
    expect(app.chatMessages.map((message) => message?.content)).toEqual(["旧会话消息"]);
  });

  it("loads older member history through the patched native handleChatScroll even when the chat thread appears after binding", async () => {
    const latestSessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const apiState = installTenantApiFetchStub({
      historyPageHandler: async () => ({
        messages: [
          {
            role: "user",
            content: "更早的第一页",
            __openclaw: { id: "m1", seq: 1 },
          },
        ],
        hasMore: false,
        nextCursor: "",
      }),
    });
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: latestSessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return {
            messages: [
              {
                role: "assistant",
                content: "当前首屏消息",
                __openclaw: { id: "m3", seq: 1 },
              },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    const thread = attachChatThread(app);
    thread.scrollTop = 0;
    app.handleChatScroll({ currentTarget: thread });
    await flush();
    await flush();

    expect(apiState.historyPageCalls).toHaveLength(1);
    expect(apiState.historyPageCalls[0]?.cursor).toBe("id:m3");
    expect(app.chatMessages.map((message) => message?.__openclaw?.id)).toEqual(["m1", "m3"]);
  });

  it("creates a new member session and shows it in the sidebar list", async () => {
    installTenantApiFetchStub();
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
    expect(decodedSearch).not.toContain("session=");
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "新会话",
    );
  });

  it("shows the native welcome state for a new draft member session instead of a blank assistant shell", async () => {
    installTenantApiFetchStub();
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
      <nav class="sidebar-nav"></nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    document
      .querySelector("[data-member-chat-new]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    expect(app.chatMessages).toEqual([]);
    expect(app.chatLoading).toBe(false);
    expect(app.sessionKey).toMatch(
      /^agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:/,
    );
  });

  it("keeps the URL on the welcome route even if the native app re-applies the draft session key", async () => {
    installTenantApiFetchStub();
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
      <nav class="sidebar-nav"></nav>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    document
      .querySelector("[data-member-chat-new]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const draftSessionKey = String(app.sessionKey || "");
    app.applySettings({
      ...app.settings,
      sessionKey: draftSessionKey,
      lastActiveSessionKey: draftSessionKey,
    });
    await flush();

    expect(decodeURIComponent(window.location.search)).toBe("?tenantAgentId=tenant-agent-1");
  });

  it("ignores a stale draft-only query session and falls back to a usable member session", async () => {
    installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:stale-draft",
          title: "新会话",
          updatedAt: "2026-04-27T07:46:20.096Z",
          hiddenAt: null,
        },
      ],
    });
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
      "/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:stale-draft",
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
    await flush();

    expect(app.sessionKey).toBe(
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    expect(decodeURIComponent(window.location.search)).toContain(
      "session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    expect(decodeURIComponent(window.location.search)).not.toContain("stale-draft");
  });

  it("replaces generated timestamp titles with the first member message preview", async () => {
    installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "[Fri 2026-04-10 00:40 UTC]",
          updatedAt: "2026-04-10T00:40:00.000Z",
          hiddenAt: null,
        },
      ],
    });
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
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
                title: "[Fri 2026-04-10 00:40 UTC]",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          expect(params).toEqual({
            sessionKey:
              "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
            limit: 200,
          });
          return {
            messages: [
              { role: "assistant", text: "你好" },
              { role: "user", text: "这是成员发送的第一条消息需要被截取成标题展示" },
              { role: "assistant", text: "收到" },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "这是成员发送的第一条消息需要被截取成标题...",
    );
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).not.toContain(
      "[Fri 2026-04-10 00:40 UTC]",
    );
  });

  it("uses the first member message as the title for a new draft session", async () => {
    const apiState = installTenantApiFetchStub();
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return { sessions: [] };
        }
        if (method === "chat.send") {
          return { ok: true };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    await app.client.request("chat.send", {
      message: "这是成员发送的第一条消息需要被截取成标题展示",
    });
    await flush();

    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "这是成员发送的第一条消息需要被截取成标题...",
    );
    expect(apiState.sessions).toHaveLength(1);
    expect(apiState.sessions[0]?.title).toBe("这是成员发送的第一条消息需要被截取成标题...");
  });

  it("filters assistant NO_REPLY history with the same semantics as the native chat view", async () => {
    installTenantApiFetchStub();
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
    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: sessionKey,
                title: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          expect(params).toEqual({ sessionKey, limit: 200 });
          return {
            messages: [
              { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
              { role: "assistant", text: "  NO_REPLY  " },
              { role: "assistant", text: "真实回复" },
              { role: "user", content: [{ type: "text", text: "NO_REPLY" }] },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    expect(app.chatMessages).toEqual([
      { role: "assistant", text: "真实回复" },
      { role: "user", content: [{ type: "text", text: "NO_REPLY" }] },
    ]);
  });

  it("prefers the persisted current member session over newer db-only session rows", async () => {
    installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:db-only",
          title: "侧库占位会话",
          updatedAt: new Date(Date.now() + 60_000).toISOString(),
          hiddenAt: null,
        },
      ],
    });
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
    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: sessionKey,
                title: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    app.sessionKey = sessionKey;
    app.settings = {
      sessionKey,
      lastActiveSessionKey: sessionKey,
    };
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    expect(decodeURIComponent(window.location.search)).toContain(`session=${sessionKey}`);
    expect(decodeURIComponent(window.location.search)).not.toContain("chat:db-only");
    expect(app.sessionKey).toBe(sessionKey);
  });

  it("rehydrates the same member session again after leaving and re-entering chat", async () => {
    installTenantApiFetchStub();
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
    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    window.history.replaceState(
      {},
      "",
      `/chat?tenantAgentId=tenant-agent-1&session=${encodeURIComponent(sessionKey)}`,
    );
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav"></nav>
    `;
    let historyLoads = 0;
    const historyRequest = vi.fn(async (method) => {
      if (method === "sessions.list") {
        return {
          sessions: [
            {
              key: sessionKey,
              title: "本周分析",
              updatedAt: Date.now(),
            },
          ],
        };
      }
      if (method === "chat.history") {
        historyLoads += 1;
        return {
          messages: [{ role: "assistant", text: `历史重载 ${historyLoads}` }],
        };
      }
      throw new Error(`unexpected method: ${method}`);
    });
    const app = createAppStub({ request: historyRequest });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const initialHistoryLoads = historyLoads;
    expect(initialHistoryLoads).toBeGreaterThan(0);
    expect(app.chatMessages).toEqual([
      { role: "assistant", text: `历史重载 ${initialHistoryLoads}` },
    ]);

    app.chatMessages = [{ role: "assistant", text: "陈旧缓存" }];
    window.history.replaceState({}, "", "/");
    await syncMemberChatSurface();
    await flush();

    window.history.replaceState(
      {},
      "",
      `/chat?tenantAgentId=tenant-agent-1&session=${encodeURIComponent(sessionKey)}`,
    );
    await syncMemberChatSurface();
    await flush();

    expect(historyLoads).toBeGreaterThan(initialHistoryLoads);
    expect(app.chatMessages).toEqual([{ role: "assistant", text: `历史重载 ${historyLoads}` }]);
  });

  it("syncs assistant usage records from chat history to the tenant platform", async () => {
    const apiState = installTenantApiFetchStub();
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
    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: sessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          expect(params).toEqual({
            sessionKey,
            limit: 200,
          });
          return {
            messages: [
              {
                role: "assistant",
                timestamp: "2026-04-13T09:30:00.000Z",
                provider: "openai",
                model: "openai/gpt-5.4",
                usage: {
                  input_tokens: 120,
                  output_tokens: 45,
                  total_tokens: 165,
                },
                cost: {
                  total: 0.12,
                },
                text: "已生成统计结论",
              },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    expect(apiState.usageSyncPayloads.length).toBeGreaterThan(0);
    const syncPayload = apiState.usageSyncPayloads.find(
      (payload) => payload.openclawSessionKey === sessionKey,
    );
    expect(syncPayload).toBeTruthy();
    expect(syncPayload.tenantAgentId).toBe("tenant-agent-1");
    expect(syncPayload.records).toEqual([
      expect.objectContaining({
        usageDay: "2026-04-13",
        provider: "openai",
        model: "openai/gpt-5.4",
        inputTokens: 120,
        outputTokens: 45,
        totalTokens: 165,
        totalCost: 0.12,
      }),
    ]);
  });

  it("syncs prompt and completion token aliases from chat history", async () => {
    const apiState = installTenantApiFetchStub();
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
    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: sessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          expect(params).toEqual({
            sessionKey,
            limit: 200,
          });
          return {
            messages: [
              {
                role: "assistant",
                timestamp: "2026-04-13T09:30:00.000Z",
                provider: "openai",
                model: "openai/gpt-5.4",
                usage: {
                  prompt_tokens: 140,
                  completion_tokens: 45,
                  cached_tokens: 20,
                  total_tokens: 185,
                },
                cost: {
                  total: 0.12,
                },
                text: "已生成统计结论",
              },
            ],
          };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    const syncPayload = apiState.usageSyncPayloads.find(
      (payload) => payload.openclawSessionKey === sessionKey,
    );
    expect(syncPayload).toBeTruthy();
    expect(syncPayload.records).toEqual([
      expect.objectContaining({
        inputTokens: 140,
        outputTokens: 45,
        cacheReadTokens: 20,
        totalTokens: 185,
        totalCost: 0.12,
      }),
    ]);
  });

  it("syncs usage records from session usage timeseries with input and output tokens", async () => {
    const apiState = installTenantApiFetchStub();
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
    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: sessionKey,
                label: "本周分析",
                updatedAt: Date.now(),
                modelProvider: "openai",
                model: "gpt-5.4",
              },
            ],
          };
        }
        if (method === "sessions.usage.timeseries") {
          expect(params).toEqual({ key: sessionKey });
          return {
            sessionId: "sess-usage",
            points: [
              {
                timestamp: "2026-04-13T09:30:00.000Z",
                input: 120,
                output: 45,
                cacheRead: 20,
                cacheWrite: 0,
                totalTokens: 185,
                cost: 0.12,
              },
            ],
          };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await flush();
    await flush();

    const syncPayload = apiState.usageSyncPayloads.find(
      (payload) => payload.openclawSessionKey === sessionKey,
    );
    expect(syncPayload).toBeTruthy();
    expect(syncPayload.records).toEqual([
      expect.objectContaining({
        usageDay: "2026-04-13",
        provider: "openai",
        model: "gpt-5.4",
        inputTokens: 120,
        outputTokens: 45,
        cacheReadTokens: 20,
        cacheWriteTokens: 0,
        totalTokens: 185,
        totalCost: 0.12,
      }),
    ]);
  });

  it("shows a short toast instead of creating another draft session when already in a new session", async () => {
    vi.useFakeTimers();
    installTenantApiFetchStub();
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
    window.sessionStorage.setItem(
      "openclaw:tenant-platform:member-chat:draft-route-lock:v1",
      JSON.stringify({
        "t-1:user-1:tenant-agent-1":
          "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:draft",
      }),
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
    expect(document.querySelector("[data-oc-member-chat-toast]")?.textContent).toContain(
      "已经是新的会话了",
    );

    await vi.advanceTimersByTimeAsync(3000);
    await Promise.resolve();

    expect(document.querySelector("[data-oc-member-chat-toast]")).toBeNull();
  });

  it("reroutes the native toolbar new-session button into a fresh member draft session", async () => {
    vi.useFakeTimers();
    const apiState = installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "旧会话",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
      ],
    });
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
      "/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav"></nav>
      <div class="agent-chat__toolbar-right">
        <button class="btn btn--ghost" title="New session" aria-label="New session">+</button>
      </div>
    `;
    const app = createAppStub();
    app.sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    app.settings = {
      sessionKey: app.sessionKey,
      lastActiveSessionKey: app.sessionKey,
    };
    document.body.append(app);

    bootMemberChatSurface();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    const originalSessionKey = String(app.sessionKey || "")
      .trim()
      .toLowerCase();
    const nativeNewSessionButton = document.querySelector(
      ".agent-chat__toolbar-right .btn.btn--ghost[title='New session']",
    );
    expect(nativeNewSessionButton).not.toBeNull();

    nativeNewSessionButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    const currentSessionKey = String(app.sessionKey || "")
      .trim()
      .toLowerCase();
    expect(currentSessionKey).toMatch(
      /^agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:/,
    );
    expect(currentSessionKey).not.toBe(originalSessionKey);
    expect(
      apiState.sessions.some((session) => session.openclawSessionKey === currentSessionKey),
    ).toBe(true);
    expect(decodeURIComponent(window.location.search)).toContain("tenantAgentId=tenant-agent-1");
    expect(decodeURIComponent(window.location.search)).not.toContain(
      `session=${originalSessionKey}`,
    );
    expect(decodeURIComponent(window.location.search)).not.toContain(
      `session=${currentSessionKey}`,
    );
    expect(document.querySelector("[data-oc-member-chat-toast]")).toBeNull();
  });

  it("blocks Enter send from the nested native composer textarea when member credit is exhausted", async () => {
    installTenantApiFetchStub();
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
      balancePoints: 0,
    });
    window.history.replaceState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    document.body.innerHTML = `
      <div class="dashboard-header__breadcrumb">
        <span class="dashboard-header__breadcrumb-link">苏博泰克</span>
        <span class="dashboard-header__breadcrumb-current">聊天</span>
      </div>
      <nav class="sidebar-nav"></nav>
      <div class="agent-chat__input">
        <div class="agent-chat__composer-combobox">
          <textarea>余额不足测试</textarea>
        </div>
      </div>
    `;
    const app = createAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const textarea = document.querySelector(".agent-chat__input textarea");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    textarea?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector("[data-oc-member-chat-toast]")?.textContent).toContain(
      "积分不足请联系管理员。",
    );
  });

  it("intercepts new-session and send events through dom-compat instead of fixed chat classes", async () => {
    const apiState = installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "本周分析",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
      ],
    });
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
      balancePoints: 0,
    });
    window.history.replaceState(
      {},
      "",
      "/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    document.body.innerHTML = `
      <nav aria-label="breadcrumb">
        <a href="/">苏博泰克</a>
        <a href="/chat">聊天</a>
      </nav>
      <aside aria-label="navigation sidebar"></aside>
      <section class="composer-host">
        <textarea aria-label="发送消息">余额不足测试</textarea>
        <div role="toolbar" aria-label="chat actions">
          <button type="button" aria-label="Stop generating">stop</button>
          <button type="button" aria-label="Send message">send</button>
          <button type="button" title="New session">+</button>
        </div>
      </section>
    `;
    const app = createAppStub();
    app.sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    app.settings = {
      sessionKey: app.sessionKey,
      lastActiveSessionKey: app.sessionKey,
    };
    document.body.append(app);

    bootMemberChatSurface();
    await flush();

    const originalSessionKey = String(app.sessionKey || "")
      .trim()
      .toLowerCase();
    const newSessionButton = document.querySelector('button[title="New session"]');
    newSessionButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();

    const currentSessionKey = String(app.sessionKey || "")
      .trim()
      .toLowerCase();
    expect(currentSessionKey).not.toBe(originalSessionKey);
    expect(
      apiState.sessions.some((session) => session.openclawSessionKey === currentSessionKey),
    ).toBe(true);
    expect(decodeURIComponent(window.location.search)).toContain("tenantAgentId=tenant-agent-1");
    expect(decodeURIComponent(window.location.search)).not.toContain(
      `session=${currentSessionKey}`,
    );

    const textarea = document.querySelector('textarea[aria-label="发送消息"]');
    const enterEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    textarea?.dispatchEvent(enterEvent);
    expect(enterEvent.defaultPrevented).toBe(true);

    const sendButton = document.querySelector('button[aria-label="Send message"]');
    sendButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.querySelector("[data-oc-member-chat-toast]")?.textContent).toContain(
      "积分不足请联系管理员。",
    );
  });

  it("hides deleted sessions from the sidebar while keeping the current session usable", async () => {
    const apiState = installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "本周分析",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
        {
          openclawSessionKey: "agent:subotech-finance:tenant-tenant-agent-1",
          title: "历史主会话",
          updatedAt: new Date(Date.now() - 60_000).toISOString(),
          hiddenAt: null,
        },
      ],
    });
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
    await flush();
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "本周分析",
    );
    expect(document.querySelector("[data-oc-member-chat-delete-dialog]")?.open).toBe(false);
    expect(
      apiState.sessions.find(
        (session) => session.openclawSessionKey === "agent:subotech-finance:tenant-tenant-agent-1",
      )?.hiddenAt,
    ).toBeTruthy();
  });

  it("syncs the current session route when selecting another sidebar session", async () => {
    installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "本周分析",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
        {
          openclawSessionKey: "agent:subotech-finance:tenant-tenant-agent-1",
          title: "历史主会话",
          updatedAt: new Date(Date.now() - 60_000).toISOString(),
          hiddenAt: null,
        },
      ],
    });
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

    const sessionButtons = [
      ...document.querySelectorAll<HTMLElement>("[data-member-chat-session]"),
    ];
    const historyButton = sessionButtons.find(
      (button) =>
        String(button.dataset.memberChatSession || "").trim().toLowerCase() ===
        "agent:subotech-finance:tenant-tenant-agent-1",
    );
    expect(historyButton).not.toBeUndefined();

    historyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    expect(app.sessionKey).toBe("agent:subotech-finance:tenant-tenant-agent-1");
    expect(decodeURIComponent(window.location.search)).toContain(
      "session=agent:subotech-finance:tenant-tenant-agent-1",
    );
    expect(
      document.querySelector("[data-oc-member-chat-section]")?.getAttribute(
        "data-oc-member-chat-active-session",
      ),
    ).toBe("agent:subotech-finance:tenant-tenant-agent-1");
  });

  it("keeps the session when delete dialog is canceled", async () => {
    const apiState = installTenantApiFetchStub({
      sessions: [
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "本周分析",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
        {
          openclawSessionKey: "agent:subotech-finance:tenant-tenant-agent-1",
          title: "历史主会话",
          updatedAt: new Date(Date.now() - 60_000).toISOString(),
          hiddenAt: null,
        },
      ],
    });
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
    await flush();
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "历史主会话",
    );
    expect(
      apiState.sessions.find(
        (session) => session.openclawSessionKey === "agent:subotech-finance:tenant-tenant-agent-1",
      )?.hiddenAt,
    ).toBeFalsy();
  });

  it("stops infinite loading and surfaces a timeout error when chat send stays pending", async () => {
    vi.useFakeTimers();
    installTenantApiFetchStub();
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        if (method === "chat.send") {
          return { ok: true };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await vi.runOnlyPendingTimersAsync();

    app.chatLoading = true;
    app.chatRunId = "run-1";
    app.chatStreamStartedAt = Date.now();
    app.lastError = null;

    await app.client.request("chat.send", { message: "生成一个大屏" });
    await vi.advanceTimersByTimeAsync(300_000);

    expect(app.chatLoading).toBe(false);
    expect(app.chatRunId).toBeNull();
    expect(app.chatStreamStartedAt).toBeNull();
    expect(app.lastError).toBe("本次请求超时，模型连接异常，请重新发送。");
    expect(document.body.textContent).toContain("本次请求超时，模型连接异常，请重新发送。");
  });

  it("does not time out a long member chat run while stream or tool progress is still advancing", async () => {
    vi.useFakeTimers();
    installTenantApiFetchStub();
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        if (method === "chat.send") {
          return { ok: true };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    app.chatToolMessages = [];
    app.chatStreamSegments = [];
    app.toolStreamOrder = [];
    document.body.append(app);

    bootMemberChatSurface();
    await vi.runOnlyPendingTimersAsync();

    app.chatLoading = true;
    app.chatRunId = "run-1";
    app.chatStreamStartedAt = Date.now();
    app.chatStream = "";
    app.lastError = null;

    await app.client.request("chat.send", { message: "继续生成大屏" });
    await vi.advanceTimersByTimeAsync(299_000);

    app.chatStream = "已写入 HTML 框架";
    await vi.advanceTimersByTimeAsync(1_000);

    expect(app.chatLoading).toBe(true);
    expect(app.chatRunId).toBe("run-1");
    expect(app.lastError).toBeNull();

    await vi.advanceTimersByTimeAsync(299_000);
    app.chatToolMessages.push({ id: "tool-1", title: "write_file" });
    app.toolStreamOrder.push("tool-1");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(app.chatLoading).toBe(true);
    expect(app.chatRunId).toBe("run-1");
    expect(app.lastError).toBeNull();

    app.chatLoading = false;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(app.lastError).toBeNull();
  });

  it("does not time out a long member chat run while the same tool card keeps streaming new output", async () => {
    vi.useFakeTimers();
    installTenantApiFetchStub();
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
                label: "本周分析",
                updatedAt: Date.now(),
              },
            ],
          };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        if (method === "chat.send") {
          return { ok: true };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    app.chatToolMessages = [];
    app.chatStreamSegments = [];
    app.toolStreamOrder = [];
    document.body.append(app);

    bootMemberChatSurface();
    await vi.runOnlyPendingTimersAsync();

    app.chatLoading = true;
    app.chatRunId = "run-1";
    app.chatStreamStartedAt = Date.now();
    app.lastError = null;
    app.chatToolMessages.push({
      id: "tool-1",
      title: "write_file",
      output: "已创建 HTML 文件",
    });
    app.toolStreamOrder.push("tool-1");

    await app.client.request("chat.send", { message: "继续生成大屏" });
    await vi.advanceTimersByTimeAsync(299_000);

    app.chatToolMessages[0].output = "已写入图表配置";
    await vi.advanceTimersByTimeAsync(1_000);

    expect(app.chatLoading).toBe(true);
    expect(app.chatRunId).toBe("run-1");
    expect(app.lastError).toBeNull();

    await vi.advanceTimersByTimeAsync(299_000);
    app.chatToolMessages[0].output = "已完成资源复制";
    await vi.advanceTimersByTimeAsync(1_000);

    expect(app.chatLoading).toBe(true);
    expect(app.chatRunId).toBe("run-1");
    expect(app.lastError).toBeNull();

    app.chatLoading = false;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(app.lastError).toBeNull();
  });

  it("keeps a draft session interactive when gateway sessions.list hangs", async () => {
    vi.useFakeTimers();
    installTenantApiFetchStub();
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
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return new Promise(() => {});
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await vi.advanceTimersByTimeAsync(6_100);

    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "新建会话",
    );
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "新会话",
    );
    expect(app.chatMessages).toEqual([]);
    expect(app.chatLoading).toBe(false);
    expect(decodeURIComponent(window.location.search)).not.toContain("session=");
  });

  it("does not block a draft member session on chat.history hydration", async () => {
    vi.useFakeTimers();
    installTenantApiFetchStub();
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
    let chatHistoryCalls = 0;
    const app = createAppStub({
      request: async (method) => {
        if (method === "sessions.list") {
          return { sessions: [] };
        }
        if (method === "chat.history") {
          chatHistoryCalls += 1;
          return new Promise(() => {});
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await vi.runOnlyPendingTimersAsync();

    expect(chatHistoryCalls).toBe(0);
    expect(app.chatMessages).toEqual([]);
    expect(app.chatLoading).toBe(false);
    expect(document.querySelector("[data-oc-member-chat-section]")?.textContent).toContain(
      "新会话",
    );
  });

  it("keeps abort bound to the active draft member session while the first send is still running", async () => {
    vi.useFakeTimers();
    const apiState = installTenantApiFetchStub();
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

    let draftSessionKey = "";
    const app = createAppStub({
      request: async (method, params) => {
        if (method === "sessions.list") {
          return { sessions: [] };
        }
        if (method === "chat.send") {
          draftSessionKey = String(params?.sessionKey || "")
            .trim()
            .toLowerCase();
          app.chatLoading = true;
          app.chatRunId = "run-1";
          apiState.sessions = [
            {
              openclawSessionKey: draftSessionKey,
              title: "新会话",
              updatedAt: new Date().toISOString(),
              hiddenAt: null,
            },
          ];
          return { ok: true };
        }
        if (method === "chat.abort") {
          return { ok: true, sessionKey: params?.sessionKey ?? null };
        }
        if (method === "chat.history") {
          return { messages: [] };
        }
        throw new Error(`unexpected method: ${method}`);
      },
    });
    document.body.append(app);

    bootMemberChatSurface();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    const initialDraftSessionKey = String(app.sessionKey || "")
      .trim()
      .toLowerCase();
    expect(initialDraftSessionKey).toMatch(
      /^agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:/,
    );

    await app.client.request("chat.send", {
      sessionKey: initialDraftSessionKey,
      message: "先生成一个图表",
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1200);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(draftSessionKey).toMatch(
      /^agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:/,
    );
    expect(draftSessionKey).toBe(initialDraftSessionKey);
    expect(app.sessionKey).toBe(draftSessionKey);

    await app.client.request("chat.abort", { sessionKey: app.sessionKey, runId: "run-1" });

    const abortCall = app.client.request.mock.calls.find(([method]) => method === "chat.abort");
    expect(abortCall).toBeTruthy();
    expect(abortCall?.[1]).toMatchObject({
      sessionKey: draftSessionKey,
      runId: "run-1",
    });
    expect(app.sessionKey).toBe(draftSessionKey);
  });
});

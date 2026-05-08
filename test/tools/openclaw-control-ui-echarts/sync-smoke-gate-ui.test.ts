/**
 * @vitest-environment jsdom
 */

import JSON5 from "json5";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertPromptIntoChatBox,
  sendPromptToChat,
} from "../../../tools/openclaw-control-ui-echarts/runtime/framework/chat-composer.js";
import {
  detectSelectMode,
  localizeErrorMessage,
  parseSelectPayload,
} from "../../../tools/openclaw-control-ui-echarts/runtime/select/parser.js";
import {
  bootMemberChatSurface,
  resetMemberChatSurfaceForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js";
import {
  writeSelectedTenantAgent,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

function mountComposer() {
  document.body.innerHTML = `
    <div class="agent-chat__input">
      <div class="agent-chat__composer-combobox">
        <textarea></textarea>
      </div>
      <div class="agent-chat__toolbar">
        <div class="agent-chat__toolbar-right">
          <button class="chat-send-btn chat-send-btn--stop" type="button">stop</button>
          <button class="chat-send-btn" type="button">send</button>
        </div>
      </div>
    </div>
  `;
  return {
    stopButton: document.querySelector(".chat-send-btn--stop"),
    sendButton: document.querySelector(".chat-send-btn:not(.chat-send-btn--stop)"),
    textarea: document.querySelector("textarea"),
  };
}

function createMemberChatAppStub() {
  const app = document.createElement("openclaw-app");
  app.connected = true;
  app.client = {
    request: vi.fn(async (method) => {
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
      throw new Error(`unexpected method: ${method}`);
    }),
  };
  app.settings = {};
  app.sessionKey = "main";
  app.tab = "overview";
  app.chatMessages = [];
  app.chatQueue = [];
  app.setTab = vi.fn((next) => {
    app.tab = next;
  });
  app.applySettings = vi.fn((next) => {
    app.settings = next;
  });
  app.loadAssistantIdentity = vi.fn(async () => {});
  app.requestUpdate = vi.fn(() => {});
  return app;
}

function installMemberChatFetchStub() {
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
      return okJson([
        {
          openclawSessionKey:
            "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
          title: "本周分析",
          updatedAt: new Date().toISOString(),
          hiddenAt: null,
        },
      ]);
    }
    if (url.endsWith("/member/usage-records/sync") && method === "POST") {
      return okJson({ inserted: 0, updated: 0, total: 0 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

async function flushAsync(rounds = 2) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame);
});

afterEach(() => {
  resetMemberChatSurfaceForTests();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("upstream sync smoke gate (ui)", () => {
  it("detects the native composer path and ignores the stop button", async () => {
    const insertedWithoutComposer = await insertPromptIntoChatBox("hello");
    const sentWithoutComposer = await sendPromptToChat("hello");
    expect(insertedWithoutComposer).toBe(false);
    expect(sentWithoutComposer).toBe(false);

    const { stopButton, sendButton, textarea } = mountComposer();
    const stopClickSpy = vi.spyOn(stopButton as HTMLButtonElement, "click");
    const sendClickSpy = vi.spyOn(sendButton as HTMLButtonElement, "click");

    const sent = await sendPromptToChat("继续分析");

    expect(sent).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("继续分析");
    expect(sendClickSpy).toHaveBeenCalledTimes(1);
    expect(stopClickSpy).toHaveBeenCalledTimes(0);
  });

  it("mounts member chat key surfaces on /chat without a real browser service", async () => {
    installMemberChatFetchStub();
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
    const app = createMemberChatAppStub();
    document.body.append(app);

    bootMemberChatSurface();
    await flushAsync(3);

    expect(document.documentElement.getAttribute("data-oc-member-chat-route")).toBe("true");
    expect(document.body.getAttribute("data-oc-member-chat-route")).toBe("true");
    expect(document.head.querySelector("[data-oc-member-chat-surface-style]")).not.toBeNull();
    expect(document.querySelector("[data-oc-member-chat-section]")).not.toBeNull();
    expect(document.querySelector("[data-oc-member-chat-top-action]")).not.toBeNull();
    expect(app.tab).toBe("chat");
    expect(window.location.search).toContain("session=");
  });

  it("falls back to prefix mode detection and localized parser errors for select blocks", () => {
    const mode = detectSelectMode(
      String.raw`single-select { options: [{ value: "red", label: "红色" }] }`,
    );
    expect(mode).toBe("single");

    const payload = parseSelectPayload(
      String.raw`single-select {
  defaultValue: "missing",
  options: [{ value: "red", label: "红色" }]
}`,
      JSON5,
      mode,
    );
    expect(payload.kind).toBe("single");
    expect(payload.defaultValue).toBe("");

    expect(localizeErrorMessage("Could not parse the select block. Unexpected token }")).toBe(
      "无法解析选项代码块，请检查括号、引号和字段格式。",
    );
    expect(localizeErrorMessage("parser failed with unknown english detail")).toBe(
      "选项代码块格式不正确，请检查对象结构和 options 字段。",
    );
  });
});

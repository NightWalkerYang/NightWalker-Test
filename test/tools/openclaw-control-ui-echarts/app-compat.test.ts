/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySessionSettings,
  bindMemberHistoryScroll,
  forceChatTab,
  getChatState,
  patchClientRequest,
  replaceChatHydrationState,
  requestRender,
  resolveOpenClawApp,
  restorePatchedApp,
  setPinnedSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/framework/app-compat.js";

function createApp() {
  const app = document.createElement("openclaw-app");
  app.tab = "overview";
  app.sessionKey = "main";
  app.settings = { sessionKey: "main", lastActiveSessionKey: "main" };
  app.chatMessages = [];
  app.chatQueue = [];
  app.setTab = vi.fn((next) => {
    app.tab = next;
  });
  app.applySettings = vi.fn((next) => {
    app.settings = next;
    app.sessionKey = next.sessionKey;
  });
  app.handleChatScroll = vi.fn(() => {});
  app.requestUpdate = vi.fn(() => {});
  app.client = {
    request: vi.fn(async (method, params) => ({ method, params })),
  };
  document.body.append(app);
  return app;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("app compat", () => {
  it("resolves the app root and reads chat state", () => {
    const app = createApp();
    const inner = document.createElement("span");
    app.append(inner);

    expect(resolveOpenClawApp(inner, "test")).toBe(app);
    expect(getChatState(app, "test")?.sessionKey).toBe("main");
  });

  it("patches and restores setTab/applySettings", () => {
    const app = createApp();
    setPinnedSession(app, "agent:one", "test");
    forceChatTab(app, "test");
    applySessionSettings(app, "agent:one", "test");

    expect(app.tab).toBe("chat");
    expect(app.sessionKey).toBe("agent:one");

    restorePatchedApp(app, "", "test");
    expect(typeof app.setTab).toBe("function");
    expect(typeof app.applySettings).toBe("function");
  });

  it("patches and restores client.request and handleChatScroll", async () => {
    const app = createApp();
    const scrollSpy = vi.fn();
    bindMemberHistoryScroll(app, scrollSpy, "test");
    app.handleChatScroll({ type: "scroll" });
    expect(scrollSpy).toHaveBeenCalled();

    patchClientRequest(
      app,
      "test",
      async (originalRequest, method, params) => {
        const result = await originalRequest(method, params);
        return { ...result, patched: true };
      },
      "test",
    );
    await expect(app.client.request("sessions.list", {})).resolves.toEqual({
      method: "sessions.list",
      params: {},
      patched: true,
    });

    restorePatchedApp(app, "test", "test");
    restorePatchedApp(app, "", "test");
  });

  it("replaces chat hydration state and requests render", () => {
    const app = createApp();
    replaceChatHydrationState(
      app,
      {
        sessionKey: "agent:hydrated",
        chatMessages: [{ role: "assistant", content: [] }],
        chatLoading: true,
      },
      "test",
    );
    requestRender(app, "test");

    expect(app.sessionKey).toBe("agent:hydrated");
    expect(app.chatMessages).toHaveLength(1);
    expect(app.requestUpdate).toHaveBeenCalled();
  });
});

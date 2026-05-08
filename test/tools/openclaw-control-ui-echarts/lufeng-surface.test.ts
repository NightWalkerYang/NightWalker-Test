/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootLufengSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/lufeng/surface.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-oc-lufeng-route");
  document.body.removeAttribute("data-oc-lufeng-route");
  window.history.replaceState({}, "", "/");
  delete window.__openclawLufengSurfaceBooted;
  delete window.__OPENCLAW_LUFENG_HISTORY_PATCHED__;
  vi.unstubAllGlobals();
});

describe("lufeng public chat surface", () => {
  it("locks the native app to chat, keeps an isolated finance session, pins gpt-5.4, and trims the sidebar", async () => {
    window.history.replaceState({}, "", "/lufeng");
    vi.stubGlobal(
      "setInterval",
      vi.fn(() => 1),
    );

    document.body.innerHTML = `
      <nav class="sidebar-nav">
        <section class="nav-section" data-group="chat">
          <button class="nav-section__label" aria-expanded="false"></button>
          <div class="nav-section__items">
            <a class="nav-item" href="/lufeng/chat">聊天</a>
          </div>
        </section>
        <section class="nav-section" data-group="control">
          <div class="nav-section__items">
            <a class="nav-item" href="/lufeng/overview">总览</a>
          </div>
        </section>
      </nav>
      <div class="sidebar-shell__footer"></div>
      <button class="topbar-search"></button>
      <div class="chat-controls__session-row">
        <label class="field chat-controls__session"><select><option value="a">会话</option></select></label>
        <label class="field chat-controls__session chat-controls__model">
          <select data-chat-model-select="true"><option value="">ark-code-latest · volcengine-plan</option></select>
        </label>
      </div>
    `;

    const app = document.createElement("openclaw-app");
    app.tab = "overview";
    app.sessionKey = "agent:main:main";
    app.settings = {
      sessionKey: "agent:main:main",
      lastActiveSessionKey: "agent:main:main",
    };
    const setTab = vi.fn((next) => {
      app.tab = next;
    });
    const applySettings = vi.fn((next) => {
      app.settings = next;
      app.sessionKey = next.sessionKey;
    });
    const loadAssistantIdentity = vi.fn(async () => {});
    const request = vi.fn(async (method) => {
      if (method === "sessions.patch") {
        return { ok: true };
      }
      if (method === "models.list") {
        return {
          models: [
            { id: "ark-code-latest", name: "Coding Plan", provider: "volcengine-plan" },
            { id: "glm-5", name: "GLM-5", provider: "zhipu" },
            { id: "gpt-5.4", name: "GPT-5.4", provider: "openai" },
            { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
          ],
        };
      }
      if (method === "sessions.list") {
        return {
          defaults: { modelProvider: "volcengine-plan", model: "ark-code-latest" },
          sessions: [
            {
              key: "agent:subotech-finance:lufeng",
              modelProvider: "cleannetworkspace",
              model: "gpt-5.4",
            },
          ],
        };
      }
      if (method === "chat.history") {
        return {
          messages: [
            {
              role: "assistant",
              provider: "volcengine-plan",
              model: "ark-code-latest",
              errorMessage:
                "400 Your account (2106283101) does not have a valid coding plan subscription, or your subscription has expired.",
              content: [],
            },
            { role: "assistant", model: "glm-5", content: [{ type: "text", text: "旧回答" }] },
            {
              role: "assistant",
              model: "openai/gpt-5.4",
              content: [{ type: "text", text: "新回答" }],
            },
          ],
          thinkingLevel: null,
        };
      }
      return {};
    });
    const requestUpdate = vi.fn(() => {});
    app.setTab = setTab;
    app.applySettings = applySettings;
    app.loadAssistantIdentity = loadAssistantIdentity;
    app.client = { request };
    app.chatModelOverrides = {};
    app.chatModelCatalog = [
      { id: "ark-code-latest", name: "Coding Plan", provider: "volcengine-plan" },
      { id: "glm-5", name: "GLM-5", provider: "zhipu" },
      { id: "gpt-5.4", name: "GPT-5.4", provider: "openai" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
    ];
    app.sessionsResult = {
      defaults: { modelProvider: "volcengine-plan", model: "ark-code-latest" },
      sessions: [
        {
          key: "agent:subotech-finance:lufeng",
          modelProvider: "cleannetworkspace",
          model: "gpt-5.4",
        },
      ],
    };
    app.chatMessages = [
      {
        role: "assistant",
        provider: "volcengine-plan",
        model: "ark-code-latest",
        errorMessage:
          "400 Your account (2106283101) does not have a valid coding plan subscription, or your subscription has expired.",
        content: [],
      },
      { role: "assistant", model: "glm-5", content: [{ type: "text", text: "旧回答" }] },
      {
        role: "assistant",
        model: "openai/gpt-5.4",
        content: [{ type: "text", text: "新回答" }],
      },
    ];
    app.lastError =
      "400 Your account (2106283101) does not have a valid coding plan subscription, or your subscription has expired.";
    app.requestUpdate = requestUpdate;
    document.body.append(app);

    bootLufengSurface();
    await Promise.resolve();

    expect(document.documentElement.getAttribute("data-oc-lufeng-route")).toBe("true");
    expect(document.body.getAttribute("data-oc-lufeng-route")).toBe("true");
    const styleElement = document.head.querySelector('[data-oc-lufeng-style="true"]');
    expect(styleElement).not.toBeNull();
    expect(styleElement).toBeInstanceOf(HTMLLinkElement);
    expect(styleElement?.getAttribute("href")).toContain("/surface.css");
    expect(
      readFileSync("tools/openclaw-control-ui-echarts/runtime/lufeng/surface.css", "utf8"),
    ).toContain(".chat-group.assistant > .oc-text-logo--avatar");
    expect(document.querySelector('[data-group="chat"]')?.getAttribute("data-oc-lufeng-nav")).toBe(
      "chat",
    );
    expect(
      document.querySelector('[data-group="control"]')?.getAttribute("data-oc-lufeng-nav"),
    ).toBe("hidden");
    expect(
      document.querySelector(".sidebar-shell__footer")?.getAttribute("data-oc-lufeng-footer"),
    ).toBe("hidden");
    expect(document.querySelector(".topbar-search")?.getAttribute("data-oc-lufeng-search")).toBe(
      "hidden",
    );
    expect(
      document
        .querySelector(".chat-controls__session:not(.chat-controls__model)")
        ?.getAttribute("data-oc-lufeng-session"),
    ).toBe("hidden");
    const modelSelect = document.querySelector('select[data-chat-model-select="true"]');
    expect(modelSelect?.getAttribute("data-oc-lufeng-model")).toBe("locked");
    expect(modelSelect?.disabled).toBe(true);
    expect(modelSelect?.value).toBe("openai/gpt-5.4");
    expect(
      [...(modelSelect?.querySelectorAll("option") ?? [])].map((option) => option.textContent),
    ).toEqual(["GPT-5.4 · openai"]);
    expect(modelSelect?.getAttribute("title")).toBe("模型已固定为 GPT-5.4 · openai");
    expect(app.tab).toBe("chat");
    expect(app.sessionKey).toBe("agent:subotech-finance:lufeng");
    expect(applySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:subotech-finance:lufeng",
        lastActiveSessionKey: "agent:subotech-finance:lufeng",
      }),
    );
    expect(loadAssistantIdentity).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:subotech-finance:lufeng",
      model: "openai/gpt-5.4",
    });
    expect(app.chatModelOverrides).toEqual({
      "agent:subotech-finance:lufeng": {
        kind: "qualified",
        value: "openai/gpt-5.4",
      },
    });
    expect(app.chatModelCatalog).toEqual([
      { id: "gpt-5.4", name: "GPT-5.4", provider: "openai" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
    ]);
    expect(app.sessionsResult).toEqual({
      defaults: { modelProvider: "openai", model: "gpt-5.4" },
      sessions: [
        {
          key: "agent:subotech-finance:lufeng",
          modelProvider: "openai",
          providerOverride: "openai",
          model: "gpt-5.4",
        },
      ],
    });
    expect(app.chatMessages).toEqual([
      { role: "assistant", content: [{ type: "text", text: "旧回答" }] },
      {
        role: "assistant",
        model: "openai/gpt-5.4",
        content: [{ type: "text", text: "新回答" }],
      },
    ]);
    expect(app.lastError).toBeNull();

    const modelsResult = await app.client.request("models.list", {});
    expect(modelsResult).toEqual({
      models: [
        { id: "gpt-5.4", name: "GPT-5.4", provider: "openai" },
        { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
      ],
    });
    const sessionsResult = await app.client.request("sessions.list", {});
    expect(sessionsResult).toEqual({
      defaults: { modelProvider: "openai", model: "gpt-5.4" },
      sessions: [
        {
          key: "agent:subotech-finance:lufeng",
          modelProvider: "openai",
          providerOverride: "openai",
          model: "gpt-5.4",
        },
      ],
    });
    const historyResult = await app.client.request("chat.history", {
      sessionKey: "agent:subotech-finance:lufeng",
    });
    expect(historyResult).toEqual({
      messages: [
        { role: "assistant", content: [{ type: "text", text: "旧回答" }] },
        {
          role: "assistant",
          model: "openai/gpt-5.4",
          content: [{ type: "text", text: "新回答" }],
        },
      ],
      thinkingLevel: null,
    });
    expect(requestUpdate).toHaveBeenCalled();
  });

  it("trims the shell through compat detection when sidebar or search classes drift", async () => {
    window.history.replaceState({}, "", "/lufeng");
    vi.stubGlobal(
      "setInterval",
      vi.fn(() => 1),
    );

    document.body.innerHTML = `
      <aside aria-label="navigation sidebar">
        <section class="nav-section" data-group="chat">
          <button class="nav-section__label" aria-expanded="false"></button>
          <div class="nav-section__items">
            <a class="nav-item" href="/lufeng/chat">聊天</a>
          </div>
        </section>
        <section class="nav-section" data-group="control">
          <div class="nav-section__items">
            <a class="nav-item" href="/lufeng/overview">总览</a>
          </div>
        </section>
      </aside>
      <div class="sidebar-shell__footer"></div>
      <button aria-label="搜索控制台">搜索</button>
      <label class="field chat-controls__session"><select><option value="a">会话</option></select></label>
      <label class="field chat-controls__session chat-controls__model">
        <select data-chat-model-select="true"><option value="">ark-code-latest · volcengine-plan</option></select>
      </label>
    `;

    const app = document.createElement("openclaw-app");
    app.tab = "overview";
    app.sessionKey = "agent:main:main";
    app.settings = { sessionKey: "agent:main:main", lastActiveSessionKey: "agent:main:main" };
    app.setTab = vi.fn((next) => {
      app.tab = next;
    });
    app.applySettings = vi.fn((next) => {
      app.settings = next;
      app.sessionKey = next.sessionKey;
    });
    app.loadAssistantIdentity = vi.fn(async () => {});
    app.client = {
      request: vi.fn(async (method) => {
        if (method === "sessions.patch") {
          return { ok: true };
        }
        return {};
      }),
    };
    app.requestUpdate = vi.fn(() => {});
    document.body.append(app);

    bootLufengSurface();
    await Promise.resolve();

    expect(document.querySelector('[data-group="chat"]')?.getAttribute("data-oc-lufeng-nav")).toBe(
      "chat",
    );
    expect(
      document.querySelector('[data-group="control"]')?.getAttribute("data-oc-lufeng-nav"),
    ).toBe("hidden");
    expect(
      document.querySelector('[aria-label="搜索控制台"]')?.getAttribute("data-oc-lufeng-search"),
    ).toBe("hidden");
  });
});

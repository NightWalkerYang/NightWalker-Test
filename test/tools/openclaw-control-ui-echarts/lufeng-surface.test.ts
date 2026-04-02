/**
 * @vitest-environment jsdom
 */

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
  it("locks the native app to chat, keeps an isolated finance session, and trims the sidebar", () => {
    window.history.replaceState({}, "", "/lufeng");
    vi.stubGlobal("setInterval", vi.fn(() => 1));

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
    app.setTab = setTab;
    app.applySettings = applySettings;
    app.loadAssistantIdentity = loadAssistantIdentity;
    document.body.append(app);

    bootLufengSurface();

    expect(document.documentElement.getAttribute("data-oc-lufeng-route")).toBe("true");
    expect(document.body.getAttribute("data-oc-lufeng-route")).toBe("true");
    expect(document.head.querySelector('[data-oc-lufeng-style="true"]')).not.toBeNull();
    expect(document.querySelector('[data-group="chat"]')?.getAttribute("data-oc-lufeng-nav")).toBe(
      "chat",
    );
    expect(
      document.querySelector('[data-group="control"]')?.getAttribute("data-oc-lufeng-nav"),
    ).toBe("hidden");
    expect(document.querySelector(".sidebar-shell__footer")?.getAttribute("data-oc-lufeng-footer")).toBe(
      "hidden",
    );
    expect(app.tab).toBe("chat");
    expect(app.sessionKey).toBe("agent:subotech-finance:lufeng");
    expect(applySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:subotech-finance:lufeng",
        lastActiveSessionKey: "agent:subotech-finance:lufeng",
      }),
    );
    expect(loadAssistantIdentity).toHaveBeenCalledTimes(1);
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootTenantAuthSurface,
  resetTenantAuthSurfaceForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js";
import {
  bootMemberChatSurface,
  resetMemberChatSurfaceForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js";
import {
  navigateTenantRoute,
  resetTenantRouteSyncForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js";
import {
  writeSelectedTenantAgent,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.body.removeAttribute("data-oc-tenant-auth-active");
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  resetTenantAuthSurfaceForTests();
  resetMemberChatSurfaceForTests();
  resetTenantRouteSyncForTests();
  vi.unstubAllGlobals();
});

describe("tenant auth surface", () => {
  it("recovers a member chat deep link instead of mounting the login shell", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        tenantId: "tenant-1",
        userId: "user-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "finance-agent",
      agentName: "财务助手",
    });
    window.history.replaceState(
      {},
      "",
      "/chat?ocTenantView=login&session=agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBeNull();
    expect(document.querySelector("[data-oc-tenant-auth-root]")).toBeNull();
    expect(window.location.pathname).toBe("/chat");
    expect(decodeURIComponent(window.location.search)).toContain("tenantAgentId=tenant-agent-1");
    expect(decodeURIComponent(window.location.search)).toContain(
      "session=agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    expect(window.location.search).not.toContain("ocTenantView=login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns members without a selected Agent to the selector view", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    window.history.replaceState({}, "", "/chat?ocTenantView=login&session=agent:legacy");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.querySelector("[data-oc-tenant-auth-root]")).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?ocTenantView=tenant-agent-selector");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops an invalid member session key when recovering a malformed login chat route", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        tenantId: "tenant-1",
        userId: "user-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "finance-agent",
      agentName: "财务助手",
    });
    window.history.replaceState({}, "", "/chat?ocTenantView=login&session=agent:main:main");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.querySelector("[data-oc-tenant-auth-root]")).toBeNull();
    expect(window.location.pathname).toBe("/chat");
    expect(decodeURIComponent(window.location.search)).toContain("tenantAgentId=tenant-agent-1");
    expect(window.location.search).not.toContain("ocTenantView=login");
    expect(decodeURIComponent(window.location.search)).not.toContain("session=agent:main:main");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows only the setup form when the platform is not initialized", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/login");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: { initialized: false },
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBe("true");
    expect(document.querySelector("[data-oc-tenant-auth-root]")).not.toBeNull();
    expect(document.querySelector("openclaw-app")).not.toBeNull();
    expect(document.querySelector(".login-gate__title")?.textContent).toContain("统一登录");
    expect(document.querySelector("[data-tenant-setup-form]")?.hasAttribute("hidden")).toBe(false);
    expect(document.querySelector("[data-tenant-login-form]")?.hasAttribute("hidden")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows only the login form when the platform is already initialized", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/login");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: { initialized: true },
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.querySelector("[data-tenant-setup-form]")).toBeNull();
    expect(document.querySelector("[data-tenant-login-form]")?.hasAttribute("hidden")).toBe(false);
    expect(document.querySelector("openclaw-app")?.getAttribute("data-oc-tenant-auth-hidden")).toBe(
      "true",
    );
  });

  it("unmounts the login shell after same-page navigation leaves the tenant login view", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/?ocTenantView=login");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: { initialized: true, edition: "cloud" },
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.querySelector("[data-oc-tenant-auth-root]")).not.toBeNull();

    navigateTenantRoute("/chat?tenantAgentId=tenant-agent-1");
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBeNull();
    expect(document.querySelector("[data-oc-tenant-auth-root]")).toBeNull();
  });

  it("restores native app visibility after leaving login", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/login");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: { initialized: true, edition: "cloud" },
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.querySelector("openclaw-app")?.getAttribute("data-oc-tenant-auth-hidden")).toBe(
      "true",
    );

    navigateTenantRoute("/?ocTenantView=tenant-agent-selector");
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBeNull();
    expect(document.querySelector("openclaw-app")?.hasAttribute("data-oc-tenant-auth-hidden")).toBe(
      false,
    );
  });

  it("does not load member chat history while on the login view", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState(
      {},
      "",
      "/?ocTenantView=login&tenantAgentId=tenant-agent-1&session=agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        tenantId: "tenant-1",
        userId: "user-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "finance-agent",
      agentName: "财务助手",
    });
    const fetchMock = vi.fn(async (input) => {
      const url = String(input?.url || input || "");
      if (url.includes("/tenant-platform-api/v1/member/sessions")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, data: [] };
          },
        };
      }
      if (url.includes("chat.history")) {
        throw new Error("unexpected chat history load");
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, data: {} };
        },
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    bootMemberChatSurface();
    await Promise.resolve();
    await Promise.resolve();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input?.url || input || "").includes("chat.history"),
      ),
    ).toBe(false);
  });

  it("clears member chat hydration state while on the login view", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/?ocTenantView=login");
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
        tenantId: "tenant-1",
        userId: "user-1",
      },
    });
    writeSelectedTenantAgent({
      id: "tenant-agent-1",
      agentId: "finance-agent",
      agentName: "财务助手",
    });
    const app = document.querySelector("openclaw-app");
    if (app instanceof HTMLElement) {
      app.sessionKey =
        "agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
      app.chatMessages = [{ role: "assistant", content: "old history" }];
      app.chatQueue = [{ role: "user", content: "pending" }];
      app.chatLoading = true;
      app.chatRunId = "run-1";
      app.chatStream = "streaming";
      app.chatStreamStartedAt = Date.now();
      app.lastError = new Error("old error");
      app.chatToolMessages = [{ content: "tool" }];
      app.chatStreamSegments = [{ content: "segment" }];
      app.chatSending = true;
      app.__ocPinnedSessionKey =
        "agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest";
    }

    bootMemberChatSurface();
    await Promise.resolve();
    await Promise.resolve();

    expect(app instanceof HTMLElement ? app.sessionKey : "").toBe("");
    expect(app instanceof HTMLElement ? app.chatMessages : []).toEqual([]);
    expect(app instanceof HTMLElement ? app.chatQueue : []).toEqual([]);
    expect(app instanceof HTMLElement ? app.chatLoading : null).toBe(false);
    expect(app instanceof HTMLElement ? app.chatRunId : null).toBeNull();
    expect(app instanceof HTMLElement ? app.chatStream : null).toBeNull();
    expect(app instanceof HTMLElement ? app.chatToolMessages : []).toEqual([]);
    expect(app instanceof HTMLElement ? app.chatStreamSegments : []).toEqual([]);
    expect(app instanceof HTMLElement ? app.chatSending : null).toBe(false);
  });

  it("does not reactivate auth overlay after route leaves login during async bootstrap", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/?ocTenantView=login");
    let resolveBootstrap;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const bootPromise = bootTenantAuthSurface();
    await Promise.resolve();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBe("true");
    navigateTenantRoute("/?ocTenantView=tenant-members");
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBeNull();
    expect(document.querySelector("[data-oc-tenant-auth-root]")).toBeNull();

    resolveBootstrap?.({
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          data: { initialized: true, edition: "cloud" },
        };
      },
    });
    await bootPromise;
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBeNull();
    expect(document.querySelector("[data-oc-tenant-auth-root]")).toBeNull();
    expect(document.querySelector("openclaw-app")).not.toBeNull();
  });
});

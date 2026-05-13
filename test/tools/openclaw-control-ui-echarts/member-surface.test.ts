/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootMemberSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-surface.js";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawMemberSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
  vi.unstubAllGlobals();
});

describe("member surface", () => {
  it("mounts the native member agent selector into the control-ui content area", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-selector");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/member/agents")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "tenant-agent-1",
                    agentId: "subotech-finance",
                    agentName: "苏博泰克财务分析助手",
                    status: "active",
                    balancePoints: 120,
                    description: "财务分析",
                  },
                ],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootMemberSurface();

    const content = document.querySelector(".content");
    const surfaceRoot = document.querySelector("[data-oc-member-surface-root]");
    expect(content?.getAttribute("data-oc-member-surface-active")).toBe("true");
    expect(surfaceRoot).not.toBeNull();
    expect(surfaceRoot?.textContent).toContain("苏博泰克财务分析助手");
    expect(surfaceRoot?.querySelector("[data-member-open-chat]")?.textContent).toContain(
      "进入聊天",
    );
    expect(surfaceRoot?.querySelector("[data-tenant-feedback]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "请选择一个已分配的 Agent 继续使用。",
    );
  });

  it("does not mount the selector on malformed /chat selector routes", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    window.history.replaceState({}, "", "/chat?ocTenantView=tenant-agent-selector");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await bootMemberSurface();

    const content = document.querySelector(".content");
    expect(content?.getAttribute("data-oc-member-surface-active")).toBeNull();
    expect(document.querySelector("[data-oc-member-surface-root]")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cleans the selector overlay if the route switches to /chat before member agents finish loading", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-selector");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;

    let resolveAgents;
    const agentsPromise = new Promise((resolve) => {
      resolveAgents = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/member/agents")) {
          return {
            ok: true,
            async json() {
              return agentsPromise;
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    const bootPromise = bootMemberSurface();
    await Promise.resolve();

    const content = document.querySelector(".content");
    expect(content?.getAttribute("data-oc-member-surface-active")).toBe("true");

    window.history.pushState({}, "", "/chat?tenantAgentId=tenant-agent-1");
    await Promise.resolve();

    resolveAgents({
      ok: true,
      data: [
        {
          id: "tenant-agent-1",
          agentId: "subotech-finance",
          agentName: "苏博泰克财务分析助手",
          status: "active",
          balancePoints: 120,
          description: "财务分析",
        },
      ],
    });

    await bootPromise;
    await Promise.resolve();

    expect(content?.getAttribute("data-oc-member-surface-active")).toBeNull();
    expect(document.querySelector("[data-oc-member-surface-root]")).toBeNull();
    expect(document.head.querySelector("[data-oc-member-surface-style]")).toBeNull();
  });

  it("clears persisted native chat session recovery state while the selector view is active", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        username: "member-user",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-selector");
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const storageKey = `openclaw.control.settings.v1:${proto}://${window.location.host}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        sessionKey: "stale-session",
        lastActiveSessionKey: "stale-session",
        sessionsByGateway: {
          [`${proto}://${window.location.host}`]: {
            sessionKey: "stale-session",
            lastActiveSessionKey: "stale-session",
          },
        },
      }),
    );
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
      <openclaw-app></openclaw-app>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/member/agents")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    const app = document.querySelector("openclaw-app");
    if (app instanceof HTMLElement) {
      app.sessionKey = "stale-session";
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
      app.__ocPinnedSessionKey = "stale-session";
    }

    await bootMemberSurface();

    expect(window.localStorage.getItem(storageKey)).toBeNull();
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
});

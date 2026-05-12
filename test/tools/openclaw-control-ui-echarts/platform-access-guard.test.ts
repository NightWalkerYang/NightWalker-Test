/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootTenantAuthSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js";
import {
  bootPlatformAccessGuard,
  isNativeControlUiPath,
  resetPlatformAccessGuardBootstrapForTests,
  resolveMemberChatBootstrapHref,
  resolvePlatformAccessDecision,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/platform-access-guard.js";
import { resetTenantRouteSyncForTests } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/route-sync.js";
import {
  isTenantMemberSessionKey,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

const ORIGINAL_PUSH_STATE = window.history.pushState.bind(window.history);
const ORIGINAL_REPLACE_STATE = window.history.replaceState.bind(window.history);
const ORIGINAL_CONSOLE_WARN = console.warn;

function readControlUiSettings() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const key = `openclaw.control.settings.v1:${proto}://${window.location.host}`;
  return JSON.parse(window.localStorage.getItem(key) || "{}");
}

function writeControlUiSettings(sessionKey) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const scope = `${proto}://${window.location.host}`;
  window.localStorage.setItem(
    `openclaw.control.settings.v1:${scope}`,
    JSON.stringify({
      gatewayUrl: scope,
      sessionKey,
      lastActiveSessionKey: sessionKey,
      sessionsByGateway: {
        [scope]: {
          sessionKey,
          lastActiveSessionKey: sessionKey,
        },
      },
    }),
  );
}

async function importTenantPreboot() {
  vi.resetModules();
  await import("../../../tools/openclaw-control-ui-echarts/runtime/tenant/preboot.js");
}

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState = ORIGINAL_PUSH_STATE;
  window.history.replaceState = ORIGINAL_REPLACE_STATE;
  console.warn = ORIGINAL_CONSOLE_WARN;
  delete window.__OPENCLAW_TENANT_PREBOOT_HISTORY_PATCHED__;
  delete window.__OPENCLAW_TENANT_PREBOOT_WARN_PATCHED__;
  delete window.__openclawControlUiResponsivenessWarnCounts;
  delete window.__openclawControlUiDebugWarnCounts;
  delete window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  delete window.__openclawPlatformAccessGuardBooted;
  document.documentElement.removeAttribute("data-oc-tenant-preboot");
  window.history.replaceState({}, "", "/");
  resetPlatformAccessGuardBootstrapForTests();
  resetTenantRouteSyncForTests();
  vi.restoreAllMocks();
});

describe("platform access guard", () => {
  it("recognizes native control-ui routes", () => {
    expect(isNativeControlUiPath("/")).toBe(true);
    expect(isNativeControlUiPath("/chat")).toBe(true);
    expect(isNativeControlUiPath("/overview")).toBe(true);
    expect(isNativeControlUiPath("/index.html")).toBe(true);
    expect(isNativeControlUiPath("/platform-tenant-console.html")).toBe(false);
    expect(isNativeControlUiPath("/tenant-admin.html")).toBe(false);
  });

  it("redirects non-platform sessions away from the native root", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/",
        edition: "cloud",
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("redirect");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("redirect-tenant");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/",
        edition: "local",
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("redirect-tenant-login");
  });

  it("allows platform admins and skips explicit tenant login views", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/",
        edition: "cloud",
        platformSession: { token: "platform-token", session: { role: "platform_admin" } },
        tenantSession: null,
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=platform-login",
        edition: "cloud",
        session: null,
      }),
    ).toBe("skip");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/lufeng",
        href: "https://www.hailstone.cn:18789/lufeng",
        edition: "cloud",
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("skip");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/echarts-view",
        href: "https://www.hailstone.cn:18789/echarts-view",
        edition: "cloud",
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("skip");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/echarts-view/chat",
        href: "https://www.hailstone.cn:18789/echarts-view/chat",
        edition: "cloud",
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("skip");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/sandbox-view",
        href: "https://www.hailstone.cn:18789/sandbox-view",
        edition: "cloud",
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("skip");
  });

  it("allows tenant admins only on tenant management views", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=tenant-members",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat?ocTenantView=tenant-agent-assignment",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=tenant-owned-agents",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=tenant-usage-stats",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=tenant-statistics-overview",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");
  });

  it("redirects members to their own home instead of platform login", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "member-token", session: { role: "member" } },
      }),
    ).toBe("redirect-member");
  });

  it("allows members on the native Agent selector and selected-agent chat routes", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=tenant-agent-selector",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "member-token", session: { role: "member" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat?tenantAgentId=tenant-agent-1",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "member-token", session: { role: "member" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat?ocTenantView=tenant-agent-selector",
        edition: "cloud",
        platformSession: null,
        tenantSession: { token: "member-token", session: { role: "member" } },
      }),
    ).toBe("redirect-member");
  });

  it("keeps a direct member chat route stable before runtime picks the active session", () => {
    const tenantSession = {
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    };
    const selectedAgent = {
      id: "tenant-agent-1",
      agentId: "subotech-finance",
    };

    const targetHref = resolveMemberChatBootstrapHref({
      pathname: "/chat",
      href: "https://www.hailstone.cn:18789/chat?tenantAgentId=tenant-agent-1",
      tenantSession,
      selectedAgent,
    });

    const url = new URL(targetHref);
    expect(url.pathname).toBe("/chat");
    expect(url.searchParams.get("tenantAgentId")).toBe("tenant-agent-1");
    expect(url.searchParams.has("session")).toBe(false);
  });

  it("keeps an existing member chat session bootstrap href unchanged", () => {
    const tenantSession = {
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    };
    const selectedAgent = {
      id: "tenant-agent-1",
      agentId: "subotech-finance",
    };
    const existingHref =
      "https://www.hailstone.cn:18789/chat?tenantAgentId=tenant-agent-1&session=agent:subotech-finance:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:current";

    expect(
      resolveMemberChatBootstrapHref({
        pathname: "/chat",
        href: existingHref,
        tenantSession,
        selectedAgent,
      }),
    ).toBe(existingHref);
  });

  it("clears stale native control-ui session recovery state on the member selector route", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-selector");
    writeControlUiSettings(
      "agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );

    await importTenantPreboot();

    const settings = readControlUiSettings();
    expect(settings.sessionKey).toBeUndefined();
    expect(settings.lastActiveSessionKey).toBeUndefined();
    expect(
      settings.sessionsByGateway?.["wss://www.hailstone.cn:18789"]?.sessionKey,
    ).toBeUndefined();
    expect(
      settings.sessionsByGateway?.["wss://www.hailstone.cn:18789"]?.lastActiveSessionKey,
    ).toBeUndefined();
  });

  it("normalizes invalid member chat restores back to the selector route", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-selector");

    await importTenantPreboot();

    window.history.pushState(
      {},
      "",
      "/chat?ocTenantView=tenant-agent-selector&session=agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?ocTenantView=tenant-agent-selector");
  });

  it("keeps a draft member chat route blank when a runtime draft lock exists", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    window.localStorage.setItem(
      "openclaw:tenant-platform:selected-agent:v1",
      JSON.stringify({
        id: "tenant-agent-1",
        agentId: "finance-agent",
        agentName: "财务助手",
      }),
    );
    window.sessionStorage.setItem(
      "openclaw:tenant-platform:member-chat:draft-route-lock:v1",
      JSON.stringify({
        "tenant-1:user-1:tenant-agent-1":
          "agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:draft",
      }),
    );
    window.history.replaceState({}, "", "/chat?tenantAgentId=tenant-agent-1");

    await importTenantPreboot();

    window.history.pushState(
      {},
      "",
      "/chat?tenantAgentId=tenant-agent-1&session=agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:draft",
    );

    expect(window.location.pathname).toBe("/chat");
    expect(window.location.search).toBe("?tenantAgentId=tenant-agent-1");
  });

  it("normalizes an initial malformed member chat URL before the app boots", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    window.history.replaceState(
      {},
      "",
      "/chat?ocTenantView=tenant-agent-selector&session=agent:finance-agent:tenant:tenant-1:tenant-agent:tenant-agent-1:user:user-1:chat:latest",
    );

    await importTenantPreboot();

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?ocTenantView=tenant-agent-selector");
  });

  it("suppresses repeated native responsiveness warnings after the first occurrence", async () => {
    const warnings = [];
    console.warn = (...args) => {
      warnings.push(args);
    };

    await importTenantPreboot();

    console.warn("[openclaw] control-ui.long-animation-frame", { durationMs: 51 });
    console.warn("[openclaw] control-ui.long-animation-frame", { durationMs: 52 });
    console.warn("[openclaw] control-ui.longtask", { durationMs: 55 });
    console.warn("plain warning", { ok: true });

    expect(warnings).toEqual([
      ["[openclaw] control-ui.long-animation-frame", { durationMs: 51 }],
      ["[openclaw] control-ui.longtask", { durationMs: 55 }],
      ["plain warning", { ok: true }],
    ]);
    expect(window.__openclawControlUiResponsivenessWarnCounts).toMatchObject({
      "[openclaw] control-ui.long-animation-frame": 2,
      "[openclaw] control-ui.longtask": 1,
    });
  });

  it("suppresses repeated control-ui rpc debug warnings after the first occurrence", async () => {
    const warnings = [];
    console.warn = (...args) => {
      warnings.push(args);
    };

    await importTenantPreboot();

    console.warn("[openclaw] control-ui.rpc", { method: "chat.history", durationMs: 12 });
    console.warn("[openclaw] control-ui.rpc", { method: "chat.history", durationMs: 13 });
    console.warn("plain warning", { ok: true });

    expect(warnings).toEqual([
      ["[openclaw] control-ui.rpc", { method: "chat.history", durationMs: 12 }],
      ["plain warning", { ok: true }],
    ]);
    expect(window.__openclawControlUiDebugWarnCounts).toMatchObject({
      "[openclaw] control-ui.rpc": 2,
    });
  });

  it("heals malformed authenticated member routes with replaceState instead of a full reload", async () => {
    writeTenantSession({
      token: "member-token",
      session: {
        role: "member",
        userId: "user-1",
        tenantId: "tenant-1",
      },
    });
    window.history.replaceState({}, "", "/chat?ocTenantView=tenant-agent-selector");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              edition: "cloud",
            },
          };
        },
      })),
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    await bootPlatformAccessGuard();

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?ocTenantView=tenant-agent-selector");
    expect(replaceStateSpy).toHaveBeenCalled();
  });

  it("redirects unauthenticated native control routes into the login view without a full reload", async () => {
    window.history.replaceState({}, "", "/chat");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              edition: "cloud",
              initialized: true,
            },
          };
        },
      })),
    );

    await bootPlatformAccessGuard();
    await bootTenantAuthSurface();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?ocTenantView=login");
    expect(document.querySelector("[data-oc-tenant-auth-root]")).not.toBeNull();
  });
});

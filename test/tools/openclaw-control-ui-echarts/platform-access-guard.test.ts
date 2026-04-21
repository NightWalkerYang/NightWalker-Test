/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import {
  isNativeControlUiPath,
  resolvePlatformAccessDecision,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/platform-access-guard.js";

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
  });
});

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
        platformSession: null,
        tenantSession: null,
      }),
    ).toBe("redirect");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("redirect-tenant");
  });

  it("allows platform admins and skips explicit tenant login views", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/",
        platformSession: { token: "platform-token", session: { role: "platform_admin" } },
        tenantSession: null,
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/?ocTenantView=platform-login",
        session: null,
      }),
    ).toBe("skip");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/lufeng",
        href: "https://www.hailstone.cn:18789/lufeng",
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
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat?ocTenantView=tenant-agent-assignment",
        platformSession: null,
        tenantSession: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("allow");
  });
});

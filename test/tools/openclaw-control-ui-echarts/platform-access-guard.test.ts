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
        session: null,
      }),
    ).toBe("redirect");

    expect(
      resolvePlatformAccessDecision({
        pathname: "/chat",
        href: "https://www.hailstone.cn:18789/chat",
        session: { token: "tenant-token", session: { role: "tenant_admin" } },
      }),
    ).toBe("redirect");
  });

  it("allows platform admins and skips explicit tenant login views", () => {
    expect(
      resolvePlatformAccessDecision({
        pathname: "/",
        href: "https://www.hailstone.cn:18789/",
        session: { token: "platform-token", session: { role: "platform_admin" } },
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
        session: null,
      }),
    ).toBe("skip");
  });
});

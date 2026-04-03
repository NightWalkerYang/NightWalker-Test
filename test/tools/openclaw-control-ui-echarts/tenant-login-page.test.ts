/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountTenantLoginPage } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/login-page.js";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("tenant login page", () => {
  it("does not redirect platform admins away from the tenant login view", async () => {
    window.history.replaceState({}, "", "/?ocTenantView=tenant-login");
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: { initialized: true },
          };
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const root = document.createElement("main");
    document.body.append(root);

    await mountTenantLoginPage(root);

    expect(window.location.search).toContain("ocTenantView=tenant-login");
    expect(root.textContent).toContain("租户登录");
    expect(root.querySelector("[data-tenant-login-form]")).not.toBeNull();
  });
});

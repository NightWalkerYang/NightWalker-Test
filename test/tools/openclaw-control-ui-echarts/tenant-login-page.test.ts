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

  it("shows local tenant-admin setup when local edition is uninitialized", async () => {
    window.history.replaceState({}, "", "/?ocTenantView=tenant-login");
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              initialized: false,
              edition: "local",
              localLicense: {
                edition: "local",
                status: "missing",
              },
            },
          };
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const root = document.createElement("main");
    document.body.append(root);

    await mountTenantLoginPage(root);

    expect(root.textContent).toContain("本地部署登录");
    expect(root.textContent).toContain("初始化租户管理员");
    expect(root.querySelector("[data-tenant-setup-form]")?.hasAttribute("hidden")).toBe(false);
    expect(root.querySelector("[data-tenant-login-form]")?.hasAttribute("hidden")).toBe(true);
    expect(root.querySelector("[data-platform-login-link]")).toBeNull();
  });

  it("retries local bootstrap fetches before surfacing an API error", async () => {
    window.history.replaceState({}, "", "/?ocTenantView=tenant-login");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              initialized: false,
              edition: "local",
              localLicense: {
                edition: "local",
                status: "missing",
              },
            },
          };
        },
      });
    vi.stubGlobal("fetch", fetchMock);
    const root = document.createElement("main");
    document.body.append(root);

    await mountTenantLoginPage(root);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(root.textContent).toContain("初始化租户管理员");
    expect(root.textContent).not.toContain("API 暂不可用");
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootTenantAuthSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("data-oc-tenant-auth-active");
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("tenant auth surface", () => {
  it("shows only the setup form when the platform is not initialized", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/?ocTenantView=platform-login");
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: { initialized: false },
          };
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantAuthSurface();

    expect(document.body.getAttribute("data-oc-tenant-auth-active")).toBe("true");
    expect(document.querySelector("[data-oc-tenant-auth-root]")).not.toBeNull();
    expect(document.querySelector(".login-gate__title")?.textContent).toContain("平台管理员登录");
    expect(document.querySelector("[data-tenant-setup-form]")?.hasAttribute("hidden")).toBe(false);
    expect(document.querySelector("[data-tenant-login-form]")?.hasAttribute("hidden")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows only the login form when the platform is already initialized", async () => {
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    window.history.replaceState({}, "", "/?ocTenantView=platform-login");
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

    await bootTenantAuthSurface();

    expect(document.querySelector("[data-tenant-setup-form]")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("[data-tenant-login-form]")?.hasAttribute("hidden")).toBe(false);
  });
});

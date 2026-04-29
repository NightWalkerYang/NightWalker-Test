/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountTenantLoginPage } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/login-page.js";
import * as tenantContext from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";
import {
  readPlatformSession,
  writeTenantSession,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("tenant login page", () => {
  it("renders unified login when opened from /login", async () => {
    window.history.replaceState({}, "", "/login");
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

    expect(window.location.pathname).toBe("/login");
    expect(root.textContent).toContain("统一登录");
    expect(root.querySelector("[data-tenant-login-form]")).not.toBeNull();
  });

  it("clears invalid stored sessions instead of redirect-looping", async () => {
    window.history.replaceState({}, "", "/login");
    writeTenantSession({
      token: "expired-platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: { initialized: true, edition: "cloud" },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        async json() {
          return {
            ok: false,
            error: "unauthorized",
          };
        },
      });
    vi.stubGlobal("fetch", fetchMock);
    const root = document.createElement("main");
    document.body.append(root);

    await mountTenantLoginPage(root);

    expect(readPlatformSession()).toBeNull();
    expect(root.querySelector("[data-tenant-login-form]")?.hasAttribute("hidden")).toBe(false);
    expect(root.textContent).toContain("统一登录");
  });

  it("shows local tenant-admin setup when local edition is uninitialized", async () => {
    window.history.replaceState({}, "", "/login");
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
    window.history.replaceState({}, "", "/login");
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

  it("ignores a stale direct-sidecar API override before bootstrapping login", async () => {
    window.history.replaceState({}, "", "/login");
    window.localStorage.setItem("openclaw:tenant-platform:api-base:v1", "http://127.0.0.1:18801");
    const fetchMock = vi.fn(async (input) => {
      if (String(input) === "/tenant-platform-api/v1/bootstrap") {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              data: { initialized: true, edition: "cloud" },
            };
          },
        };
      }
      return {
        ok: false,
        status: 404,
        async json() {
          return {
            ok: false,
            error: "not_found",
          };
        },
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const root = document.createElement("main");
    document.body.append(root);

    await mountTenantLoginPage(root);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/tenant-platform-api/v1/bootstrap",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(root.textContent).toContain("统一登录");
    expect(root.textContent).not.toContain("API 暂不可用");
    expect(window.localStorage.getItem("openclaw:tenant-platform:api-base:v1")).toBeNull();
  });

  it("redirects tenant admins to the statistics overview after login", async () => {
    window.history.replaceState({}, "", "/login");
    const redirectSpy = vi
      .spyOn(tenantContext, "redirectToRoleHome")
      .mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              initialized: true,
              edition: "cloud",
            },
          };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              token: "tenant-token",
              session: {
                role: "tenant_admin",
                username: "Test001",
              },
            },
          };
        },
      });
    vi.stubGlobal("fetch", fetchMock);
    const root = document.createElement("main");
    document.body.append(root);

    await mountTenantLoginPage(root);

    const loginForm = root.querySelector("[data-tenant-login-form]");
    if (!(loginForm instanceof HTMLFormElement)) {
      throw new Error("Expected tenant login form to render");
    }
    const usernameInput = loginForm.querySelector('input[name="username"]');
    const passwordInput = loginForm.querySelector('input[name="password"]');
    if (!(usernameInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) {
      throw new Error("Expected tenant login inputs to render");
    }
    usernameInput.value = "Test001";
    passwordInput.value = "Test";
    loginForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(redirectSpy).toHaveBeenCalledWith({
      role: "tenant_admin",
      username: "Test001",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

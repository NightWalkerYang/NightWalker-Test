/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootPlatformSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/platform-surface.js";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawPlatformSurfaceBooted;
  vi.unstubAllGlobals();
});

describe("platform surface", () => {
  it("mounts the native single-entry platform management view into the content area", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=platform-tenants");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/platform/tenants")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              data: [
                {
                  id: "tenant-1",
                  code: "alpha",
                  name: "租户 Alpha",
                  deploymentMode: "cloud",
                  memberCount: 2,
                  walletBalance: 8,
                  agentCount: 1,
                  memberLimit: 10,
                  licenseExpiresAt: null,
                  status: "active",
                },
              ],
            };
          },
        };
      }
      if (url.includes("/platform/catalog-agents")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              data: [{ id: "finance", name: "财务分析助手" }],
            };
          },
        };
      }
      if (url.includes("/platform/tenant-members")) {
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
      if (url.includes("/platform/tenant-agents")) {
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
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootPlatformSurface();

    const content = document.querySelector(".content");
    const surfaceRoot = document.querySelector("[data-oc-platform-surface-root]");
    const tableBody = surfaceRoot?.querySelector("tbody");
    expect(content?.getAttribute("data-oc-platform-surface-active")).toBe("true");
    expect(surfaceRoot).not.toBeNull();
    expect(document.querySelector(".content-header")).toBeNull();
    expect(document.querySelector("[data-platform-search]")).not.toBeNull();
    expect(document.querySelector("[data-platform-open-create]")).not.toBeNull();
    expect(document.querySelector(".data-table")).not.toBeNull();
    expect(tableBody?.textContent).toContain("租户 Alpha");
    expect(tableBody?.textContent).toContain("人数调整");
    expect(tableBody?.textContent).not.toContain("分配Agent");
  });

  it("mounts a dedicated agent allocation view without the tenant creation form", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=platform-agent-assignment");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/platform/tenants")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              data: [
                {
                  id: "tenant-1",
                  code: "alpha",
                  name: "租户 Alpha",
                  deploymentMode: "cloud",
                  memberCount: 2,
                  walletBalance: 8,
                  agentCount: 1,
                  memberLimit: 10,
                  licenseExpiresAt: null,
                  status: "active",
                },
              ],
            };
          },
        };
      }
      if (url.includes("/platform/catalog-agents")) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              data: [{ id: "finance", name: "财务分析助手" }],
            };
          },
        };
      }
      if (url.includes("/platform/tenant-members")) {
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
      if (url.includes("/platform/tenant-agents")) {
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
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootPlatformSurface();

    const surfaceRoot = document.querySelector("[data-oc-platform-surface-root]");
    const tableBody = surfaceRoot?.querySelector("tbody");
    expect(document.querySelector(".content-header")).toBeNull();
    expect(document.querySelector("[data-platform-search]")).not.toBeNull();
    expect(document.querySelector("[data-platform-open-create]")).toBeNull();
    expect(document.querySelector(".data-table")).not.toBeNull();
    expect(tableBody?.textContent).toContain("分配Agent");
    expect(tableBody?.textContent).toContain("倍率调整");
    expect(tableBody?.textContent).not.toContain("人数调整");
  });

  it("unmounts when native route leaves the management view", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=platform-tenants");
    document.body.innerHTML = `<button class="topbar-search"><span class="topbar-search__label">搜索</span></button><div class="content"><div class="native-placeholder">native content</div></div>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/platform/tenants")) {
          return {
            ok: true,
            async json() {
              return { ok: true, data: [] };
            },
          };
        }
        if (url.includes("/platform/catalog-agents")) {
          return {
            ok: true,
            async json() {
              return { ok: true, data: [] };
            },
          };
        }
        if (url.includes("/platform/tenant-members") || url.includes("/platform/tenant-agents")) {
          return {
            ok: true,
            async json() {
              return { ok: true, data: [] };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootPlatformSurface();
    expect(document.querySelector("[data-oc-platform-surface-root]")).not.toBeNull();

    window.history.pushState({}, "", "/chat");

    expect(document.querySelector("[data-oc-platform-surface-root]")).toBeNull();
    expect(document.querySelector(".content")?.getAttribute("data-oc-platform-surface-active")).toBeNull();
  });
});

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
    expect(surfaceRoot?.querySelector("[data-tenant-feedback]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "平台租户页已就绪。",
    );
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
    expect(surfaceRoot?.querySelector("[data-tenant-feedback]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "平台租户页已就绪。",
    );
  });

  it("keeps the management search input focused while filtering", async () => {
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
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

    const input = document.querySelector("[data-platform-search]");
    expect(input instanceof HTMLInputElement).toBe(true);
    input.focus();
    input.value = "alp";
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const nextInput = document.querySelector("[data-platform-search]");
    expect(nextInput instanceof HTMLInputElement).toBe(true);
    expect(nextInput.value).toBe("alp");
    expect(document.activeElement).toBe(nextInput);
    expect(nextInput.selectionStart).toBe(3);
    expect(nextInput.selectionEnd).toBe(3);
  });

  it("hides cloud-only wallet and pricing controls in local edition", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
        edition: "local",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=platform-tenants");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
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
                    deploymentMode: "local",
                    memberCount: 2,
                    walletBalance: 0,
                    agentCount: 1,
                    memberLimit: 10,
                    licenseExpiresAt: "2099-01-01T00:00:00.000Z",
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
        if (url.includes("/platform/local-license")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  edition: "local",
                  status: "active",
                  customerName: "禄丰本地客户",
                  expiresAt: "2099-01-01T00:00:00.000Z",
                  remainingDays: 9999,
                  reason: null,
                },
              };
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

    const table = document.querySelector(".data-table");
    expect(table?.textContent).toContain("人数调整");
    expect(table?.textContent).not.toContain("钱包积分");
    expect(table?.textContent).not.toContain("部署模式");
    expect(document.querySelector("[data-platform-open-local-license]")?.textContent).toContain(
      "授权管理",
    );
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

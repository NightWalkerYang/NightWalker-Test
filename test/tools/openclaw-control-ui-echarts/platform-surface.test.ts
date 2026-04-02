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
    expect(content?.getAttribute("data-oc-platform-surface-active")).toBe("true");
    expect(document.querySelector("[data-oc-platform-surface-root]")).not.toBeNull();
    expect(document.querySelector(".page-title")?.textContent).toContain("租户管理");
    expect(document.querySelector("[data-platform-tenant-list]")?.textContent).toContain("租户 Alpha");
  });
});

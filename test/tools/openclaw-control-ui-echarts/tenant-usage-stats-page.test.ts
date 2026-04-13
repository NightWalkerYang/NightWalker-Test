/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";
import { mountTenantUsageStatsPage } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-usage-stats-page.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawTenantSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
  vi.unstubAllGlobals();
});

describe("tenant usage stats page", () => {
  it("renders the single usage list with search and pagination", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    document.body.innerHTML = `<div id="root"></div>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/usage-stats?page=")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  items: [
                    {
                      id: "usage-1",
                      createdAt: "2026-04-13T09:30:00.000Z",
                      memberUsername: "alice",
                      tenantAgentId: "tenant-agent-1",
                      agentId: "subotech-finance",
                      agentName: "苏博泰克财务分析助手",
                      input_tokens: 120,
                      output_tokens: 45,
                      total_tokens: 165,
                      tokens: 165,
                      creditsUsed: 0.2,
                    },
                  ],
                  total: 1,
                  page: 1,
                  pageSize: 8,
                },
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    const root = document.querySelector("#root");
    expect(root).not.toBeNull();
    await mountTenantUsageStatsPage(root as HTMLElement);

    expect(root?.querySelector("[data-tenant-usage-search]")).not.toBeNull();
    expect(root?.textContent).toContain("成员");
    expect(root?.textContent).toContain("Agent");
    expect(root?.textContent).toContain("耗用总token");
    expect(root?.textContent).toContain("输入");
    expect(root?.textContent).toContain("输出");
    expect(root?.textContent).toContain("耗用积分");
    expect(root?.textContent).toContain("时间");
    expect(root?.querySelector("[data-tenant-usage-page='next']")).not.toBeNull();
    expect(root?.textContent).toContain("alice");
    expect(root?.textContent).toContain("苏博泰克财务分析助手");
    expect(root?.textContent).toContain("165");
    expect(root?.textContent).toContain("0.2");
    expect(root?.textContent).toContain("2026/04/13");
  });
});

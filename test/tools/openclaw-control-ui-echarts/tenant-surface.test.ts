/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";
import { bootTenantSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  delete window.__openclawTenantSurfaceBooted;
  delete window.__openclawTenantRouteSyncBooted;
  vi.unstubAllGlobals();
});

describe("tenant surface", () => {
  it("mounts the native members view into the control-ui content area", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-members");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/members")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "member-1",
                    username: "alice",
                    status: "active",
                    assignedAgentCount: 2,
                    createdAt: "2026-04-03T08:00:00.000Z",
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/tenant-agents")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "tenant-agent-1",
                    agentId: "subotech-finance",
                    agentName: "苏博泰克财务分析助手",
                    balancePoints: 100,
                  },
                ],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();

    const content = document.querySelector(".content");
    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(content?.getAttribute("data-oc-tenant-surface-active")).toBe("true");
    expect(surfaceRoot).not.toBeNull();
    expect(surfaceRoot?.textContent).toContain("alice");
    expect(surfaceRoot?.querySelector("[data-tenant-open-create]")?.textContent).toContain(
      "创建成员",
    );
    expect(surfaceRoot?.querySelector("[data-tenant-open-assign]")).toBeNull();
  });

  it("mounts the native tenant agent assignment view", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-agent-assignment");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/members")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "member-1",
                    username: "alice",
                    status: "active",
                    assignedAgentCount: 2,
                    createdAt: "2026-04-03T08:00:00.000Z",
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/tenant-agents")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "tenant-agent-1",
                    agentId: "subotech-finance",
                    agentName: "苏博泰克财务分析助手",
                    balancePoints: 100,
                  },
                ],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(surfaceRoot?.querySelector("[data-tenant-open-assign]")?.textContent).toContain(
      "分配Agent",
    );
    expect(surfaceRoot?.querySelector("[data-tenant-open-create]")).toBeNull();
  });

  it("mounts the native tenant usage stats view", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-usage-stats");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/usage-stats")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  range: {
                    startDate: "2026-04-13",
                    endDate: "2026-04-13",
                  },
                  totals: {
                    responseCount: 3,
                    memberCount: 1,
                    agentCount: 1,
                    inputTokens: 120,
                    outputTokens: 45,
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                    totalTokens: 165,
                    totalCost: 0,
                    lastUsedAt: "2026-04-13T09:30:00.000Z",
                  },
                  byMember: [
                    {
                      userId: "member-1",
                      username: "alice",
                      responseCount: 3,
                      inputTokens: 120,
                      outputTokens: 45,
                      totalTokens: 165,
                      lastUsedAt: "2026-04-13T09:30:00.000Z",
                    },
                  ],
                  byAgent: [
                    {
                      tenantAgentId: "tenant-agent-1",
                      agentId: "subotech-finance",
                      agentName: "苏博泰克财务分析助手",
                      responseCount: 3,
                      inputTokens: 120,
                      outputTokens: 45,
                      totalTokens: 165,
                      lastUsedAt: "2026-04-13T09:30:00.000Z",
                    },
                  ],
                  byDay: [
                    {
                      usageDay: "2026-04-13",
                      responseCount: 3,
                      inputTokens: 120,
                      outputTokens: 45,
                      totalTokens: 165,
                      lastUsedAt: "2026-04-13T09:30:00.000Z",
                    },
                  ],
                },
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(surfaceRoot?.textContent).toContain("统计区间");
    expect(surfaceRoot?.textContent).toContain("总 Tokens");
    expect(surfaceRoot?.textContent).toContain("苏博泰克财务分析助手");
    expect(surfaceRoot?.textContent).toContain("2026-04-13");
  });
});

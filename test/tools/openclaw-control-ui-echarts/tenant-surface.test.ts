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

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
}

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
    expect(surfaceRoot?.querySelector("[data-tenant-open-member-password]")?.textContent).toContain(
      "更改密码",
    );
    expect(surfaceRoot?.querySelector("[data-tenant-member-status-toggle]")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-open-assign]")).toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-feedback]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")).toBeNull();
  });

  it("updates member password and status from the members list actions", async () => {
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
    const state = {
      members: [
        {
          id: "member-1",
          username: "alice",
          status: "active",
          assignedAgentCount: 2,
          createdAt: "2026-04-03T08:00:00.000Z",
        },
      ],
      passwordUpdates: [],
      statusUpdates: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(String(options.body)) : {};
        const okJson = (data) => ({
          ok: true,
          async json() {
            return {
              ok: true,
              data,
            };
          },
        });
        if (url.includes("/tenant/admin/members") && method === "GET") {
          return okJson(state.members);
        }
        if (url.includes("/tenant/admin/tenant-agents") && method === "GET") {
          return okJson([
            {
              id: "tenant-agent-1",
              agentId: "subotech-finance",
              agentName: "苏博泰克财务分析助手",
              balancePoints: 100,
            },
          ]);
        }
        if (url.endsWith("/tenant/admin/members/password") && method === "POST") {
          state.passwordUpdates.push(body);
          return okJson({ id: body.userId, username: "alice", status: state.members[0].status });
        }
        if (url.endsWith("/tenant/admin/members/status") && method === "POST") {
          state.statusUpdates.push(body);
          const member = state.members.find((item) => item.id === body.userId);
          if (member) {
            member.status = body.status;
          }
          return okJson(member ?? null);
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(surfaceRoot?.querySelector("[data-tenant-open-member-password]")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-member-status-toggle]")).not.toBeNull();

    surfaceRoot
      ?.querySelector("[data-tenant-open-member-password]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    const passwordDialog = document.querySelector("[data-tenant-member-password-dialog]");
    expect(passwordDialog?.open).toBe(true);

    const passwordInput = document.querySelector(
      "[data-tenant-member-password-form] input[name='password']",
    );
    expect(passwordInput).not.toBeNull();
    if (passwordInput instanceof HTMLInputElement) {
      passwordInput.value = "new-secret";
    }
    const passwordForm = document.querySelector("[data-tenant-member-password-form]");
    passwordForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    expect(state.passwordUpdates).toEqual([
      {
        userId: "member-1",
        password: "new-secret",
      },
    ]);
    expect(document.querySelector("[data-tenant-member-password-dialog]")?.open).toBe(false);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "成员密码已更新。",
    );

    const statusToggle = document.querySelector("[data-tenant-member-status-toggle='member-1']");
    expect(statusToggle).not.toBeNull();
    if (statusToggle instanceof HTMLInputElement) {
      statusToggle.checked = false;
      statusToggle.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    expect(state.statusUpdates).toEqual([
      {
        userId: "member-1",
        status: "inactive",
      },
    ]);
    expect(document.querySelector("[data-tenant-member-status-toggle='member-1']")?.checked).toBe(
      false,
    );
    expect(
      document.querySelector("[data-tenant-member-status-toggle='member-1']")?.parentElement
        ?.textContent,
    ).toContain("已禁用");
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "成员已禁用。",
    );
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
    expect(
      surfaceRoot?.querySelector("[data-tenant-revoke-assignment='member-1']")?.textContent,
    ).toContain("撤回分配");
    expect(surfaceRoot?.querySelector("[data-tenant-assignment-select='member-1']")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-open-create]")).toBeNull();
  });

  it("supports multi-select revoking agent assignments from the assignment list", async () => {
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
    const state = {
      members: [
        {
          id: "member-1",
          username: "alice",
          status: "active",
          assignedAgentCount: 1,
          createdAt: "2026-04-03T08:00:00.000Z",
        },
        {
          id: "member-2",
          username: "bob",
          status: "active",
          assignedAgentCount: 1,
          createdAt: "2026-04-04T08:00:00.000Z",
        },
      ],
      revokeCalls: [],
    };
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(String(options.body)) : {};
        const okJson = (data) => ({
          ok: true,
          async json() {
            return {
              ok: true,
              data,
            };
          },
        });
        if (url.includes("/tenant/admin/members") && method === "GET") {
          return okJson(state.members);
        }
        if (url.includes("/tenant/admin/tenant-agents") && method === "GET") {
          return okJson([
            {
              id: "tenant-agent-1",
              agentId: "subotech-finance",
              agentName: "苏博泰克财务分析助手",
              balancePoints: 100,
            },
          ]);
        }
        if (url.endsWith("/tenant/admin/revoke-agent-assignments") && method === "POST") {
          state.revokeCalls.push(body);
          const userIds = Array.isArray(body.userIds) ? body.userIds : [];
          for (const member of state.members) {
            if (userIds.includes(member.id)) {
              member.assignedAgentCount = 0;
            }
          }
          return okJson({
            revokedAssignmentCount: userIds.length,
            affectedUserIds: userIds,
            affectedMemberCount: userIds.length,
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const firstCheckbox = document.querySelector("[data-tenant-assignment-select='member-1']");
    const secondCheckbox = document.querySelector("[data-tenant-assignment-select='member-2']");
    expect(firstCheckbox).not.toBeNull();
    expect(secondCheckbox).not.toBeNull();
    if (firstCheckbox instanceof HTMLInputElement) {
      firstCheckbox.checked = true;
      firstCheckbox.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();
    const secondCheckboxAfterFirst = document.querySelector(
      "[data-tenant-assignment-select='member-2']",
    );
    if (secondCheckboxAfterFirst instanceof HTMLInputElement) {
      secondCheckboxAfterFirst.checked = true;
      secondCheckboxAfterFirst.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true }),
      );
    }
    await flush();

    const bulkRevokeButton = document.querySelector("[data-tenant-bulk-revoke]");
    expect(bulkRevokeButton?.textContent).toContain("撤回分配");
    bulkRevokeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.revokeCalls).toEqual([
      {
        userIds: ["member-1", "member-2"],
      },
    ]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "已撤回 2 个成员的 2 条 Agent 分配。",
    );
    expect(document.querySelector("[data-tenant-bulk-revoke]")).toBeNull();
    expect(document.querySelector("[data-tenant-assignment-select-all]")?.checked).toBe(false);
    expect(document.querySelector("[data-tenant-assignment-select='member-1']")?.checked).toBe(
      false,
    );
    expect(document.querySelector("[data-tenant-assignment-select='member-2']")?.checked).toBe(
      false,
    );
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
                      memberId: "member-1",
                      memberUsername: "alice",
                      tenantAgentId: "tenant-agent-1",
                      agentId: "subotech-finance",
                      agentName: "苏博泰克财务分析助手",
                      inputTokens: 120,
                      outputTokens: 45,
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

    await bootTenantSurface();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(surfaceRoot?.querySelector(".oc-tenant-list-view--scrollable")).not.toBeNull();
    expect(surfaceRoot?.querySelector(".oc-tenant-usage-summary")).toBeNull();
    expect(surfaceRoot?.textContent).toContain("成员");
    expect(surfaceRoot?.textContent).toContain("Agent");
    expect(surfaceRoot?.textContent).toContain("耗用总token");
    expect(surfaceRoot?.textContent).toContain("输入");
    expect(surfaceRoot?.textContent).toContain("输出");
    expect(surfaceRoot?.textContent).toContain("耗用积分");
    expect(surfaceRoot?.textContent).toContain("时间");
    expect(surfaceRoot?.querySelector("[data-tenant-page='next']")).not.toBeNull();
    expect(surfaceRoot?.textContent).toContain("alice");
    expect(surfaceRoot?.textContent).toContain("苏博泰克财务分析助手");
    expect(surfaceRoot?.textContent).toContain("165");
    expect(surfaceRoot?.textContent).toContain("0.2");
    expect(surfaceRoot?.textContent).toContain("2026/04/13");
  });
});

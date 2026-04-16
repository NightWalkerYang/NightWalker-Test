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
    expect(
      surfaceRoot?.querySelector("[data-tenant-revoke-assignment-dialog]") instanceof
        HTMLDialogElement
        ? surfaceRoot.querySelector("[data-tenant-revoke-assignment-dialog]")?.open
        : false,
    ).toBe(false);
    expect(surfaceRoot?.querySelector("[data-tenant-open-create]")).toBeNull();
  });

  it("opens a revoke dialog and revokes selected assigned agents", async () => {
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
          assignedAgentCount: 2,
          createdAt: "2026-04-03T08:00:00.000Z",
        },
      ],
      memberAssignments: {
        "member-1": [
          {
            assignmentId: "assignment-1",
            baseAgentId: "subotech-finance",
            agentName: "苏博泰克财务分析助手",
            description: "财务分析",
            derivedAgentId: "tenant-member-1-finance",
            derivedWorkspaceDir: "/tmp/workspace-1",
          },
          {
            assignmentId: "assignment-2",
            baseAgentId: "subotech-writing",
            agentName: "文案助手",
            description: "文案辅助",
            derivedAgentId: "tenant-member-1-writing",
            derivedWorkspaceDir: "/tmp/workspace-2",
          },
        ],
      },
      revokeCalls: [],
    };
    const confirmSpy = vi.fn(() => {
      throw new Error("window.confirm should not be called");
    });
    vi.stubGlobal("confirm", confirmSpy);
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
        if (url.includes("/tenant/admin/members/agents") && method === "GET") {
          const parsed = new URL(url, window.location.href);
          const userId = parsed.searchParams.get("userId") || "";
          return okJson(state.memberAssignments[userId] || []);
        }
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
          const assignmentIds = Array.isArray(body.assignmentIds) ? body.assignmentIds : [];
          for (const member of state.members) {
            if (member.id === body.userId) {
              const currentAssignments = state.memberAssignments[member.id] || [];
              state.memberAssignments[member.id] = currentAssignments.filter(
                (assignment) => !assignmentIds.includes(assignment.assignmentId),
              );
              member.assignedAgentCount = state.memberAssignments[member.id].length;
            }
          }
          return okJson({
            revokedAssignmentCount: assignmentIds.length,
            affectedUserIds: body.userId ? [body.userId] : [],
            affectedMemberCount: body.userId ? 1 : 0,
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const revokeButton = document.querySelector("[data-tenant-revoke-assignment='member-1']");
    expect(revokeButton?.textContent).toContain("撤回分配");
    revokeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const revokeDialog = document.querySelector("[data-tenant-revoke-assignment-dialog]");
    expect(revokeDialog?.open).toBe(true);
    const targetMemberInput = revokeDialog?.querySelector(
      "[data-tenant-revoke-assignment-form] input[disabled]",
    );
    expect(targetMemberInput instanceof HTMLInputElement ? targetMemberInput.value : "").toBe(
      "alice",
    );
    expect(
      revokeDialog?.querySelector("[data-tenant-revoke-assignment-select='assignment-1']"),
    ).not.toBeNull();
    expect(
      revokeDialog?.querySelector("[data-tenant-revoke-assignment-select='assignment-2']"),
    ).not.toBeNull();

    const selectAll = revokeDialog?.querySelector("[data-tenant-revoke-assignment-select-all]");
    expect(selectAll).not.toBeNull();
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const selectedAssignmentOne = document.querySelector(
      "[data-tenant-revoke-assignment-select='assignment-1']",
    );
    const selectedAssignmentTwo = document.querySelector(
      "[data-tenant-revoke-assignment-select='assignment-2']",
    );
    expect(
      selectedAssignmentOne instanceof HTMLInputElement ? selectedAssignmentOne.checked : false,
    ).toBe(true);
    expect(
      selectedAssignmentTwo instanceof HTMLInputElement ? selectedAssignmentTwo.checked : false,
    ).toBe(true);

    const revokeForm = document.querySelector("[data-tenant-revoke-assignment-form]");
    revokeForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(confirmSpy).not.toHaveBeenCalled();
    const confirmDialog = document.querySelector("[data-tenant-revoke-confirm-dialog]");
    expect(confirmDialog?.open).toBe(true);
    expect(confirmDialog?.textContent).toContain("确认撤回");
    expect(confirmDialog?.textContent).toContain("alice");
    expect(confirmDialog?.textContent).toContain("已选中的 2 个 Agent");

    const confirmForm = document.querySelector("[data-tenant-revoke-confirm-form]");
    confirmForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.revokeCalls).toEqual([
      {
        userId: "member-1",
        assignmentIds: ["assignment-1", "assignment-2"],
      },
    ]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "已撤回成员“alice”的 2 个 Agent 分配。",
    );
    expect(
      document.querySelector("[data-tenant-revoke-assignment-dialog]") instanceof HTMLDialogElement
        ? document.querySelector("[data-tenant-revoke-assignment-dialog]")?.open
        : false,
    ).toBe(false);
    expect(document.querySelector("[data-tenant-revoke-assignment='member-1']")?.disabled).toBe(
      true,
    );
  });

  it("opens an assign dialog, hides already assigned agents, and submits multiple selections", async () => {
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
      ],
      memberAssignments: {
        "member-1": [
          {
            assignmentId: "assignment-1",
            baseAgentId: "subotech-finance",
            agentName: "苏博泰克财务分析助手",
            description: "财务分析",
            derivedAgentId: "tenant-member-1-finance",
            derivedWorkspaceDir: "/tmp/workspace-1",
            tenantAgentId: "tenant-agent-1",
          },
        ],
      },
      tenantAgents: [
        {
          id: "tenant-agent-1",
          agentId: "subotech-finance",
          agentName: "苏博泰克财务分析助手",
          description: "财务分析",
          balancePoints: 100,
        },
        {
          id: "tenant-agent-2",
          agentId: "subotech-writing",
          agentName: "文案助手",
          description: "文案辅助",
          balancePoints: 80,
        },
        {
          id: "tenant-agent-3",
          agentId: "subotech-code",
          agentName: "代码助手",
          description: "代码辅助",
          balancePoints: 60,
        },
      ],
      assignCalls: [],
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
        if (url.includes("/tenant/admin/members/agents") && method === "GET") {
          const parsed = new URL(url, window.location.href);
          const userId = parsed.searchParams.get("userId") || "";
          return okJson(state.memberAssignments[userId] || []);
        }
        if (url.includes("/tenant/admin/members") && method === "GET") {
          return okJson(state.members);
        }
        if (url.includes("/tenant/admin/tenant-agents") && method === "GET") {
          return okJson(state.tenantAgents);
        }
        if (url.endsWith("/tenant/admin/assign-agent") && method === "POST") {
          state.assignCalls.push(body);
          const tenantAgentIds = Array.isArray(body.tenantAgentIds)
            ? body.tenantAgentIds
            : body.tenantAgentId
              ? [body.tenantAgentId]
              : [];
          const member = state.members.find((item) => item.id === body.userId);
          if (member) {
            member.assignedAgentCount += tenantAgentIds.length;
          }
          return okJson({
            assignmentIds: tenantAgentIds.map((tenantAgentId, index) => `assignment-${index + 2}`),
            derivedAgentIds: tenantAgentIds.map(
              (tenantAgentId) => `${tenantAgentId}-derived`,
            ),
            assignedAssignmentCount: tenantAgentIds.length,
            affectedUserIds: body.userId ? [body.userId] : [],
            affectedMemberCount: body.userId ? 1 : 0,
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const assignButton = document.querySelector("[data-tenant-open-assign='member-1']");
    expect(assignButton?.textContent).toContain("分配Agent");
    assignButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const assignDialog = document.querySelector("[data-tenant-assign-dialog]");
    expect(assignDialog?.open).toBe(true);
    expect(assignDialog?.querySelector("[data-tenant-assign-agent-select='tenant-agent-1']")).toBeNull();
    expect(
      assignDialog?.querySelector("[data-tenant-assign-agent-select='tenant-agent-2']"),
    ).not.toBeNull();
    expect(
      assignDialog?.querySelector("[data-tenant-assign-agent-select='tenant-agent-3']"),
    ).not.toBeNull();

    const selectAll = assignDialog?.querySelector("[data-tenant-assign-agent-select-all]");
    expect(selectAll).not.toBeNull();
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const selectedAgentTwo = document.querySelector(
      "[data-tenant-assign-agent-select='tenant-agent-2']",
    );
    const selectedAgentThree = document.querySelector(
      "[data-tenant-assign-agent-select='tenant-agent-3']",
    );
    expect(selectedAgentTwo instanceof HTMLInputElement ? selectedAgentTwo.checked : false).toBe(
      true,
    );
    expect(
      selectedAgentThree instanceof HTMLInputElement ? selectedAgentThree.checked : false,
    ).toBe(true);

    const assignForm = document.querySelector("[data-tenant-assignment-form]");
    assignForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.assignCalls).toEqual([
      {
        userId: "member-1",
        tenantAgentIds: ["tenant-agent-2", "tenant-agent-3"],
      },
    ]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "已为成员“alice”分配 2 个 Agent。",
    );
    expect(
      document.querySelector("[data-tenant-assign-dialog]") instanceof HTMLDialogElement
        ? document.querySelector("[data-tenant-assign-dialog]")?.open
        : false,
    ).toBe(false);
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

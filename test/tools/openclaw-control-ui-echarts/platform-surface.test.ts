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

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
}

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
      if (url.includes("/platform/nodes")) {
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
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")).toBeNull();
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
      if (url.includes("/platform/nodes")) {
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
    expect(tableBody?.textContent).toContain("撤回分配");
    expect(tableBody?.textContent).toContain("倍率调整");
    expect(tableBody?.textContent).not.toContain("人数调整");
    expect(surfaceRoot?.querySelector("[data-tenant-feedback]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")).toBeNull();
  });

  it("mounts a dedicated node management view and saves nodes through the zero-intrusive dialog", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=platform-nodes");
    document.body.innerHTML = `
      <button class="topbar-search"><span class="topbar-search__label">搜索</span></button>
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const state: {
      tenants: Array<Record<string, unknown>>;
      nodes: Array<Record<string, unknown>>;
      saveCalls: Array<Record<string, unknown>>;
    } = {
      tenants: [
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
      nodes: [],
      saveCalls: [],
    };
    const okJson = (data: unknown) => ({
      ok: true,
      async json() {
        return {
          ok: true,
          data,
        };
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(String(options.body)) : {};
        if (url.includes("/platform/tenants") && method === "GET") {
          return okJson(state.tenants);
        }
        if (url.includes("/platform/catalog-agents") && method === "GET") {
          return okJson([]);
        }
        if (url.includes("/platform/nodes") && method === "GET") {
          return okJson(state.nodes);
        }
        if (url.endsWith("/platform/nodes") && method === "POST") {
          state.saveCalls.push(body);
          const savedNode = {
            id: String(body.id || ""),
            name: String(body.name || ""),
            status: String(body.status || "active"),
            leaseStatus: String(body.leaseStatus || "active"),
            leaseExpiresAt: String(body.leaseExpiresAt || "2099-06-01T00:00:00.000Z"),
            boundTenantCount: 0,
            agentCount: 1,
            lastHeartbeatAt: null,
            desiredRevision: 2,
            lastAppliedRevision: 0,
          };
          state.nodes = [
            savedNode,
            ...state.nodes.filter((entry) => String(entry.id) !== savedNode.id),
          ];
          return okJson(savedNode);
        }
        return okJson([]);
      }),
    );

    await bootPlatformSurface();
    await flush();

    expect(document.querySelector("[data-platform-open-create]")).toBeNull();
    const createNodeButton = document.querySelector("[data-platform-open-node]");
    expect(createNodeButton).not.toBeNull();
    createNodeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const nodeDialog = document.querySelector("[data-platform-node-dialog]");
    expect(nodeDialog?.open).toBe(true);
    const nodeForm = nodeDialog?.querySelector("[data-platform-node-form]");
    expect(nodeForm instanceof HTMLFormElement).toBe(true);

    const idInput = nodeForm?.querySelector('input[name="id"]');
    const nameInput = nodeForm?.querySelector('input[name="name"]');
    const sharedSecretInput = nodeForm?.querySelector('input[name="sharedSecret"]');
    const expiresAtInput = nodeForm?.querySelector('input[name="leaseExpiresAt"]');
    if (idInput instanceof HTMLInputElement) {
      idInput.value = "node-shanghai";
    }
    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = "上海受管节点";
    }
    if (sharedSecretInput instanceof HTMLInputElement) {
      sharedSecretInput.value = "node-secret";
    }
    if (expiresAtInput instanceof HTMLInputElement) {
      expiresAtInput.value = "2099-06-01T08:00";
    }
    nodeForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.saveCalls).toEqual([
      expect.objectContaining({
        id: "node-shanghai",
        name: "上海受管节点",
        sharedSecret: "node-secret",
      }),
    ]);
    const tableBody = document.querySelector("[data-oc-platform-surface-root] tbody");
    expect(tableBody?.textContent).toContain("node-shanghai");
    expect(tableBody?.textContent).toContain("上海受管节点");

    const editButton = document.querySelector("[data-platform-open-edit-node='node-shanghai']");
    expect(editButton).not.toBeNull();
    editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const editDialog = document.querySelector("[data-platform-node-dialog]");
    const editNameInput = editDialog?.querySelector('input[name="name"]');
    expect(editDialog?.open).toBe(true);
    expect(editNameInput instanceof HTMLInputElement ? editNameInput.value : "").toBe("上海受管节点");
  });

  it("opens an assign dialog and batch-assigns selectable catalog agents", async () => {
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
    const state = {
      tenants: [
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
      catalogAgents: [
        {
          id: "subotech-finance",
          name: "苏博泰克财务分析助手",
          description: "财务分析",
        },
        {
          id: "subotech-writing",
          name: "文案助手",
          description: "文案辅助",
        },
        {
          id: "subotech-sales",
          name: "销售助手",
          description: "销售跟进",
        },
      ],
      tenantAgents: {
        "tenant-1": [
          {
            id: "tenant-agent-1",
            agentId: "subotech-finance",
            agentName: "苏博泰克财务分析助手",
            description: "财务分析",
            balancePoints: 12,
            rateMultiplier: 1,
            status: "active",
          },
        ],
      } as Record<string, Array<Record<string, unknown>>>,
      assignCalls: [] as Array<Record<string, unknown>>,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(String(options.body)) : {};
        const okJson = (data: unknown) => ({
          ok: true,
          async json() {
            return {
              ok: true,
              data,
            };
          },
        });
        if (url.includes("/platform/tenants") && method === "GET") {
          return okJson(state.tenants);
        }
        if (url.includes("/platform/catalog-agents") && method === "GET") {
          return okJson(state.catalogAgents);
        }
        if (url.includes("/platform/nodes") && method === "GET") {
          return okJson([]);
        }
        if (url.includes("/platform/tenant-members") && method === "GET") {
          return okJson([]);
        }
        if (url.includes("/platform/tenant-agents") && method === "GET") {
          const parsed = new URL(url, window.location.href);
          const tenantId = parsed.searchParams.get("tenantId") || "";
          return okJson(state.tenantAgents[tenantId] || []);
        }
        if (url.endsWith("/platform/tenant-agents") && method === "POST") {
          state.assignCalls.push(body);
          const tenantId = String(body.tenantId || "");
          const agentId = String(body.agentId || "");
          const catalogAgent = state.catalogAgents.find((agent) => agent.id === agentId) || null;
          state.tenantAgents[tenantId] = [
            ...(state.tenantAgents[tenantId] || []),
            {
              id: `tenant-agent-${state.assignCalls.length + 1}`,
              agentId,
              agentName: catalogAgent?.name || agentId,
              description: body.description || "",
              balancePoints: Number(body.balancePoints || 0),
              rateMultiplier: Number(body.rateMultiplier || 1),
              status: "active",
            },
          ];
          const tenant = state.tenants.find((item) => item.id === tenantId);
          if (tenant) {
            tenant.agentCount = state.tenantAgents[tenantId].length;
          }
          return okJson(state.tenantAgents[tenantId][state.tenantAgents[tenantId].length - 1] || null);
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootPlatformSurface();
    await flush();

    const assignButton = document.querySelector("[data-platform-open-assign='tenant-1']");
    expect(assignButton?.textContent).toContain("分配Agent");
    assignButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const assignDialog = document.querySelector("[data-platform-assign-dialog]");
    expect(assignDialog?.open).toBe(true);
    expect(
      assignDialog?.querySelector("[data-platform-assign-agent-select='subotech-finance']"),
    ).toBeNull();
    expect(
      assignDialog?.querySelector("[data-platform-assign-agent-select='subotech-writing']"),
    ).not.toBeNull();
    expect(
      assignDialog?.querySelector("[data-platform-assign-agent-select='subotech-sales']"),
    ).not.toBeNull();

    const descriptionInput = assignDialog?.querySelector("[data-platform-assign-description]");
    if (descriptionInput instanceof HTMLInputElement) {
      descriptionInput.value = "批量下发";
      descriptionInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    const rateInput = assignDialog?.querySelector("[data-platform-assign-rate-multiplier]");
    if (rateInput instanceof HTMLInputElement) {
      rateInput.value = "1.5";
      rateInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    const balanceInput = assignDialog?.querySelector("[data-platform-assign-balance-points]");
    if (balanceInput instanceof HTMLInputElement) {
      balanceInput.value = "8";
      balanceInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }

    const selectAll = assignDialog?.querySelector("[data-platform-assign-agent-select-all]");
    expect(selectAll).not.toBeNull();
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const rerenderedAssignDialog = document.querySelector("[data-platform-assign-dialog]");
    expect(
      rerenderedAssignDialog?.querySelector("[data-platform-assign-description]") instanceof
        HTMLInputElement
        ? (
            rerenderedAssignDialog?.querySelector(
              "[data-platform-assign-description]",
            ) as HTMLInputElement
          ).value
        : "",
    ).toBe("批量下发");
    expect(
      rerenderedAssignDialog?.querySelector(
        "[data-platform-assign-rate-multiplier]",
      ) instanceof HTMLInputElement
        ? (
            rerenderedAssignDialog?.querySelector(
              "[data-platform-assign-rate-multiplier]",
            ) as HTMLInputElement
          ).value
        : "",
    ).toBe("1.5");
    expect(
      rerenderedAssignDialog?.querySelector(
        "[data-platform-assign-balance-points]",
      ) instanceof HTMLInputElement
        ? (
            rerenderedAssignDialog?.querySelector(
              "[data-platform-assign-balance-points]",
            ) as HTMLInputElement
          ).value
        : "",
    ).toBe("8");

    const assignForm = document.querySelector("[data-platform-agent-form]");
    assignForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.assignCalls).toEqual([
      {
        tenantId: "tenant-1",
        description: "批量下发",
        rateMultiplier: "1.5",
        balancePoints: "8",
        agentId: "subotech-writing",
      },
      {
        tenantId: "tenant-1",
        description: "批量下发",
        rateMultiplier: "1.5",
        balancePoints: "8",
        agentId: "subotech-sales",
      },
    ]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "已向租户“租户 Alpha”下发 2 个 Agent。",
    );
    expect(
      document.querySelector("[data-platform-assign-dialog]") instanceof HTMLDialogElement
        ? document.querySelector("[data-platform-assign-dialog]")?.open
        : false,
    ).toBe(false);
  });

  it("opens a revoke dialog and revokes selected tenant agents", async () => {
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
    const state = {
      tenants: [
        {
          id: "tenant-1",
          code: "alpha",
          name: "租户 Alpha",
          deploymentMode: "cloud",
          memberCount: 2,
          walletBalance: 8,
          agentCount: 2,
          memberLimit: 10,
          licenseExpiresAt: null,
          status: "active",
        },
      ],
      tenantAgents: {
        "tenant-1": [
          {
            id: "tenant-agent-1",
            agentId: "subotech-finance",
            agentName: "苏博泰克财务分析助手",
            description: "财务分析",
            balancePoints: 12,
            rateMultiplier: 1,
            status: "active",
          },
          {
            id: "tenant-agent-2",
            agentId: "subotech-writing",
            agentName: "文案助手",
            description: "文案辅助",
            balancePoints: 5,
            rateMultiplier: 1.1,
            status: "active",
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
        if (url.includes("/platform/tenants") && method === "GET") {
          return okJson(state.tenants);
        }
        if (url.includes("/platform/catalog-agents") && method === "GET") {
          return okJson([]);
        }
        if (url.includes("/platform/nodes") && method === "GET") {
          return okJson([]);
        }
        if (url.includes("/platform/tenant-agents") && method === "GET") {
          const parsed = new URL(url, window.location.href);
          const tenantId = parsed.searchParams.get("tenantId") || "";
          return okJson(state.tenantAgents[tenantId] || []);
        }
        if (url.endsWith("/platform/revoke-tenant-agents") && method === "POST") {
          state.revokeCalls.push(body);
          const tenantAgentIds = Array.isArray(body.tenantAgentIds) ? body.tenantAgentIds : [];
          state.tenantAgents[body.tenantId] = (state.tenantAgents[body.tenantId] || []).filter(
            (agent) => !tenantAgentIds.includes(agent.id),
          );
          const tenant = state.tenants.find((item) => item.id === body.tenantId);
          if (tenant) {
            tenant.agentCount = state.tenantAgents[body.tenantId].length;
          }
          return okJson({
            revokedTenantAgentCount: tenantAgentIds.length,
            revokedAssignmentCount: 3,
            tenantAgentIds,
            affectedUserIds: ["member-1", "member-2"],
            affectedMemberCount: 2,
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootPlatformSurface();
    await flush();

    const revokeButton = document.querySelector("[data-platform-open-revoke='tenant-1']");
    expect(revokeButton?.textContent).toContain("撤回分配");
    revokeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const revokeDialog = document.querySelector("[data-platform-revoke-tenant-agent-dialog]");
    expect(revokeDialog?.open).toBe(true);
    expect(
      revokeDialog?.querySelector("[data-platform-revoke-agent-select='tenant-agent-1']"),
    ).not.toBeNull();
    expect(
      revokeDialog?.querySelector("[data-platform-revoke-agent-select='tenant-agent-2']"),
    ).not.toBeNull();

    const selectAll = revokeDialog?.querySelector("[data-platform-revoke-agent-select-all]");
    expect(selectAll).not.toBeNull();
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const revokeForm = document.querySelector("[data-platform-revoke-tenant-agent-form]");
    revokeForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(confirmSpy).not.toHaveBeenCalled();
    const confirmDialog = document.querySelector("[data-platform-revoke-confirm-dialog]");
    expect(confirmDialog?.open).toBe(true);
    expect(confirmDialog?.textContent).toContain("确认撤回");
    expect(confirmDialog?.textContent).toContain("租户 Alpha");
    expect(confirmDialog?.textContent).toContain("已选中的 2 个 Agent");

    const confirmForm = document.querySelector("[data-platform-revoke-confirm-form]");
    confirmForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.revokeCalls).toEqual([
      {
        tenantId: "tenant-1",
        tenantAgentIds: ["tenant-agent-1", "tenant-agent-2"],
      },
    ]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "已撤回租户“租户 Alpha”的 2 个 Agent，并同步失效 3 条成员分配。",
    );
    expect(
      document.querySelector("[data-platform-revoke-tenant-agent-dialog]") instanceof
        HTMLDialogElement
        ? document.querySelector("[data-platform-revoke-tenant-agent-dialog]")?.open
        : false,
    ).toBe(false);
    expect(document.querySelector("[data-platform-open-revoke='tenant-1']")?.disabled).toBe(true);
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
        if (url.includes("/platform/nodes")) {
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
        if (url.includes("/platform/nodes")) {
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

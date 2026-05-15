/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
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
  it("updates the mounted tenant section when the tenant route changes", async () => {
    const requests = [];
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
        requests.push(url);
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
                    description: "财务分析与预算评估",
                    status: "active",
                    balancePoints: 128.5,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/wallet")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  summary: {
                    walletBalance: 300,
                  },
                  orders: [],
                  ledger: [],
                  tenantAgents: [],
                  payment: {
                    providerName: "通联支付",
                    enabled: true,
                    channels: [],
                  },
                },
              };
            },
          };
        }
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: null,
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.getAttribute("data-oc-tenant-section")).toBe("members");
    expect(requests.some((url) => url.includes("/tenant/admin/members"))).toBe(true);

    window.history.pushState({}, "", "/?ocTenantView=tenant-owned-agents");
    await flush();

    expect(root?.getAttribute("data-oc-tenant-section")).toBe("owned-agents");
    expect(requests.some((url) => url.includes("/tenant/admin/tenant-agents"))).toBe(true);
    expect(requests.some((url) => url.includes("/tenant/admin/wallet"))).toBe(true);
  });

  it("mounts the tenant skills market section when the route switches to tenant-skills-market", async () => {
    const requests = [];
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
        requests.push(url);
        if (url.includes("/tenant/admin/members")) {
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
        if (url.includes("/tenant/admin/tenant-agents")) {
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
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: null,
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/market")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "skill-free",
                    skillId: "skill-free",
                    skillKey: "finance-report",
                    name: "财务报表 Skill",
                    description: "生成财务报表与经营分析摘要。",
                    classification: "free",
                    marketStatus: "免费可启用",
                    pricePoints: 0,
                    latestVersionId: "version-free-1",
                    latestVersionLabel: "v1.0.0",
                    latestPublishedAt: "2026-05-01T08:00:00.000Z",
                    compatibleBaseAgents: ["finance"],
                    affectedTenantAgentCount: 2,
                    affectedAssignmentCount: 3,
                    entitlementId: null,
                    enabledByTenant: false,
                  },
                  {
                    id: "skill-paid",
                    skillId: "skill-paid",
                    skillKey: "risk-audit",
                    name: "风险审计 Skill",
                    description: "审计风险线索并输出整改建议。",
                    classification: "paid",
                    marketStatus: "待下单",
                    pricePoints: 80,
                    latestVersionId: "version-paid-1",
                    latestVersionLabel: "v2.1.0",
                    compatibleBaseAgents: ["*"],
                    affectedTenantAgentCount: 0,
                    affectedAssignmentCount: 0,
                    entitlementId: null,
                    enabledByTenant: false,
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
    await flush();

    window.history.pushState({}, "", "/?ocTenantView=tenant-skills-market");
    await flush();

    const root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.getAttribute("data-oc-tenant-section")).toBe("skills-market");
    expect(requests.some((url) => url.includes("/tenant/admin/skills/market"))).toBe(true);
    expect(root?.querySelector(".data-table")).toBeNull();
    expect(root?.querySelectorAll(".oc-tenant-skill-market-card")).toHaveLength(2);
    expect(root?.textContent).toContain("财务报表 Skill");
    expect(root?.textContent).toContain("免费可启用");
    expect(root?.textContent).toContain("风险审计 Skill");
    expect(root?.querySelector('[data-tenant-skill-free-enable="skill-free"]')).not.toBeNull();
    expect(root?.querySelector('[data-tenant-skill-order="skill-paid"]')).not.toBeNull();

    const detailTrigger = root?.querySelector('[data-tenant-skill-market-detail="skill-free"]');
    detailTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const detailDialog = document.querySelector("[data-tenant-skill-market-detail-dialog]");
    expect(detailDialog?.open).toBe(true);
    expect(detailDialog?.textContent).toContain("Skill 详情");
    expect(detailDialog?.textContent).toContain("finance-report");
    expect(detailDialog?.textContent).toContain("生成财务报表与经营分析摘要");
    expect(detailDialog?.textContent).toContain("2 个 Agent");
    expect(detailDialog?.textContent).toContain("3 个分配");
  });

  it("mounts the tenant skills workbench section when the route switches to tenant-skills-workbench", async () => {
    const requests = [];
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-skills-workbench");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("/tenant/admin/members")) {
          return {
            ok: true,
            async json() {
              return { ok: true, data: [] };
            },
          };
        }
        if (url.includes("/tenant/admin/tenant-agents")) {
          return {
            ok: true,
            async json() {
              return { ok: true, data: [] };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/entitlements")) {
          return {
            ok: true,
            async json() {
              return { ok: true, data: [] };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/assignments")) {
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

    await bootTenantSurface();
    await flush();

    const root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.getAttribute("data-oc-tenant-section")).toBe("skills-workbench");
    const listView = root?.querySelector(".oc-tenant-list-view");
    expect(listView?.classList.contains("oc-tenant-list-view--scrollable")).toBe(true);
    expect(listView?.classList.contains("oc-tenant-list-view--skills-workbench")).toBe(true);
    expect(root?.querySelector(".oc-tenant-table-toolbar [data-tenant-search]")).toBeNull();
    const memberSearch = root?.querySelector(
      ".oc-tenant-skill-workbench__member-search [data-tenant-search]",
    );
    expect(memberSearch).not.toBeNull();
    expect((memberSearch as HTMLInputElement | null)?.placeholder).toBe("搜索用户名称");
    expect(requests.some((url) => url.includes("/tenant/admin/skills/assignments"))).toBe(true);
  });

  it("keeps skills workbench cards accessible through the tenant scroll shell", () => {
    const css = readFileSync(
      "tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.css",
      "utf8",
    );

    expect(css).toMatch(
      /\.oc-tenant-list-view--scrollable\s*\{[\s\S]*max-height:\s*calc\(100vh - 20px\);[\s\S]*overflow-y:\s*auto;/,
    );
    expect(css).toMatch(
      /\.oc-tenant-list-view--skills-workbench\s*\{[\s\S]*max-height:\s*none;[\s\S]*overflow-y:\s*visible;[\s\S]*padding-bottom:\s*40px;/,
    );
    expect(css).toMatch(
      /\.oc-tenant-skill-workbench\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*320px;[\s\S]*align-items:\s*start;/,
    );
    expect(css).toMatch(
      /\.oc-tenant-skill-workbench__content\s*\{[\s\S]*min-height:\s*320px;[\s\S]*overflow:\s*visible;/,
    );
    expect(css).toMatch(
      /\.oc-tenant-skill-workbench__sidebar\s*\{[\s\S]*max-height:\s*min\(720px, calc\(100vh - 160px\)\);[\s\S]*overflow:\s*hidden;[\s\S]*position:\s*sticky;/,
    );
    expect(css).not.toMatch(
      /\.oc-tenant-skill-workbench\s*\{[\s\S]*height:\s*calc\(100vh - 160px\);/,
    );
    expect(css).not.toMatch(
      /\.oc-tenant-list-view--skills-workbench\s*\{[\s\S]*max-height:\s*calc\(100vh - 160px\);/,
    );
    expect(css).not.toMatch(/\.oc-tenant-skill-workbench__content\s*\{[\s\S]*overflow-y:\s*auto;/);
    expect(css).not.toMatch(/\.oc-tenant-skill-workbench__content\s*\{[\s\S]*min-height:\s*0;/);
    expect(css).toMatch(
      /@media \(max-width: 900px\)\s*\{[\s\S]*\.oc-tenant-list-view--skills-workbench\s*\{[\s\S]*max-height:\s*none;[\s\S]*overflow-y:\s*visible;/,
    );
  });

  it("renders the merged tenant skills workbench for workbench and legacy routes", async () => {
    const requests = [];
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-skills-entitlements");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("/tenant/admin/skills/entitlements")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "entitlement-1",
                    skillId: "skill-1",
                    skillKey: "finance-core",
                    name: "finance-core",
                    classification: "bundled",
                    status: "active",
                    enabledByTenant: true,
                    versionPolicy: "latest",
                    currentVersionId: "ver-1",
                    blockedReason: null,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/assignments")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    tenantAgentId: "tenant-agent-1",
                    baseAgentId: "finance",
                    templateSkillKeys: ["finance-core", "finance-report"],
                    blockedSkillKeys: [],
                    assignmentCount: 2,
                    templateRows: [
                      {
                        skillKey: "finance-core",
                        templateState: "enabled",
                      },
                      {
                        skillKey: "finance-report",
                        templateState: "enabled",
                      },
                    ],
                    assignments: [
                      {
                        assignmentId: "assignment-1",
                        userId: "member-1",
                        username: "alice",
                        resolvedSkillKeys: ["finance-core"],
                        overrideRows: [],
                        overrideSummary: [],
                        blockedReasons: [],
                        status: "active",
                      },
                      {
                        assignmentId: "assignment-2",
                        userId: "member-1",
                        username: "alice",
                        resolvedSkillKeys: ["finance-core", "finance-report"],
                        overrideRows: [],
                        overrideSummary: [],
                        blockedReasons: [],
                        status: "active",
                      },
                    ],
                  },
                  {
                    tenantAgentId: "tenant-agent-2",
                    baseAgentId: "ops",
                    templateSkillKeys: ["ops-core"],
                    blockedSkillKeys: [],
                    assignmentCount: 1,
                    templateRows: [
                      {
                        skillKey: "ops-core",
                        templateState: "enabled",
                      },
                    ],
                    assignments: [
                      {
                        assignmentId: "assignment-3",
                        userId: "member-1",
                        username: "alice",
                        resolvedSkillKeys: ["ops-core"],
                        overrideRows: [],
                        overrideSummary: [],
                        blockedReasons: [],
                        status: "active",
                      },
                    ],
                  },
                ],
              };
            },
          };
        }
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
                    assignedAgentCount: 1,
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
                    agentId: "finance",
                    agentName: "财务助手",
                    description: "财务分析 Agent",
                    status: "active",
                    balancePoints: 20,
                  },
                  {
                    id: "tenant-agent-2",
                    agentId: "ops",
                    agentName: "运维助手",
                    description: "运维处理 Agent",
                    status: "active",
                    balancePoints: 10,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/market?baseAgentId=finance")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "skill-1",
                    skillId: "skill-1",
                    skillKey: "finance-core",
                    name: "finance-core",
                    description: "财务核心能力",
                    classification: "bundled",
                    marketStatus: "无需购买",
                    latestVersionId: "ver-1",
                    latestVersionLabel: "v1",
                    compatibleBaseAgents: ["finance"],
                    pricePoints: 0,
                  },
                  {
                    id: "skill-2",
                    skillId: "skill-2",
                    skillKey: "finance-report",
                    name: "finance-report",
                    description: "财务报表能力",
                    classification: "free",
                    marketStatus: "免费可启用",
                    latestVersionId: "ver-2",
                    latestVersionLabel: "v2",
                    compatibleBaseAgents: ["finance"],
                    pricePoints: 0,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/market?baseAgentId=ops")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "skill-3",
                    skillId: "skill-3",
                    skillKey: "ops-core",
                    name: "ops-core",
                    description: "运维核心能力",
                    classification: "bundled",
                    marketStatus: "无需购买",
                    latestVersionId: "ver-3",
                    latestVersionLabel: "v3",
                    compatibleBaseAgents: ["ops"],
                    pricePoints: 0,
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
    await flush();

    let root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.getAttribute("data-oc-tenant-section")).toBe("skills-workbench");
    const listView = root?.querySelector(".oc-tenant-list-view");
    expect(listView?.classList.contains("oc-tenant-list-view--scrollable")).toBe(true);
    expect(listView?.classList.contains("oc-tenant-list-view--skills-workbench")).toBe(true);
    expect(root?.textContent).toContain("alice");
    expect(root?.textContent).toContain("财务助手");
    expect(root?.querySelector(".oc-tenant-skill-workbench__member-section")).not.toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__member-trigger")).not.toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__agent-nav-item")).not.toBeNull();
    expect(root?.querySelector('[data-tenant-skill-member-toggle="member-1"]')).not.toBeNull();
    expect(
      root?.querySelector('[data-tenant-skill-assignment-select="assignment-1"]'),
    ).not.toBeNull();
    expect(
      root?.querySelector('[data-tenant-skill-assignment-select="assignment-2"]'),
    ).not.toBeNull();
    expect(
      root?.querySelector('[data-tenant-skill-assignment-select="assignment-3"]'),
    ).not.toBeNull();
    expect(root?.textContent).not.toContain("finance-core");
    expect(root?.textContent).not.toContain("运维核心能力");
    expect(root?.querySelector(".oc-tenant-skill-workbench-agent-card")).toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__selection-panel")).toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__selection-content")).toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__context-bar")).toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__content-header")).toBeNull();
    expect(root?.querySelectorAll(".oc-tenant-skill-workbench-skill-card").length).toBe(0);
    expect(root?.textContent).toContain("请选择该成员下的 Agent 后查看 skills。");

    const financeAssignmentButton = root?.querySelector(
      '[data-tenant-skill-assignment-select="assignment-1"]',
    );
    financeAssignmentButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();

    root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.textContent).toContain("finance-core");
    expect(root?.textContent).not.toContain("finance-report");
    expect(root?.querySelector(".oc-tenant-skill-workbench__selection-content")).not.toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__context-bar")).not.toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__content-header")).toBeNull();
    expect(root?.querySelectorAll(".oc-tenant-skill-workbench-skill-card").length).toBe(1);
    expect(root?.querySelector('[data-tenant-skill-template-save="tenant-agent-1"]')).toBeNull();
    expect(root?.querySelector('[data-tenant-skill-override-save="assignment-1"]')).toBeNull();

    const opsAssignmentButton = root?.querySelector(
      '[data-tenant-skill-assignment-select="assignment-3"]',
    );
    opsAssignmentButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();

    root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.textContent).toContain("运维助手");
    expect(root?.textContent).toContain("ops-core");
    expect(root?.textContent).not.toContain("finance-report");
    expect(root?.querySelector(".oc-tenant-skill-workbench-agent-card")).toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__selection-panel")).toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__selection-content")).not.toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__context-bar")).not.toBeNull();
    expect(root?.querySelector(".oc-tenant-skill-workbench__content-header")).toBeNull();
    expect(root?.querySelectorAll(".oc-tenant-skill-workbench-skill-card").length).toBe(1);
    expect(root?.querySelector('[data-tenant-skill-template-save="tenant-agent-2"]')).toBeNull();
    expect(root?.querySelector('[data-tenant-skill-override-save="assignment-3"]')).toBeNull();

    const memberToggle = root?.querySelector('[data-tenant-skill-member-toggle="member-1"]');
    memberToggle?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();

    root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(memberToggle?.getAttribute("aria-expanded")).not.toBe("false");
    const collapsedToggle = root?.querySelector('[data-tenant-skill-member-toggle="member-1"]');
    const collapsedSection = collapsedToggle?.closest(".oc-tenant-skill-workbench__member-section");
    const collapsedItems = collapsedSection?.querySelector(".nav-section__items");
    expect(collapsedToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(collapsedSection?.classList.contains("nav-section--collapsed")).toBe(true);
    expect(collapsedItems?.hasAttribute("hidden")).toBe(true);
    expect(root?.querySelector(".oc-tenant-skill-workbench__selection-content")).toBeNull();
    expect(root?.textContent).toContain("请选择该成员下的 Agent 后查看 skills。");

    window.history.pushState({}, "", "/?ocTenantView=tenant-skills-assignments");
    await flush();

    root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.getAttribute("data-oc-tenant-section")).toBe("skills-workbench");
    expect(root?.textContent).toContain("请选择该成员下的 Agent 后查看 skills。");
    expect(requests.some((url) => url.includes("/tenant/admin/skills/entitlements"))).toBe(true);
    expect(requests.some((url) => url.includes("/tenant/admin/skills/assignments"))).toBe(true);
    expect(
      requests.some((url) => url.includes("/tenant/admin/skills/market?baseAgentId=finance")),
    ).toBe(true);
    expect(
      requests.some((url) => url.includes("/tenant/admin/skills/market?baseAgentId=ops")),
    ).toBe(true);
  });

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
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: null,
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

  it("renders resolved skills from assignment state even when the market response is empty", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-skills-workbench");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/skills/entitlements")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "entitlement-1",
                    skillId: "skill-1",
                    skillKey: "finance-core",
                    name: "finance-core",
                    description: "财务核心能力",
                    classification: "bundled",
                    status: "active",
                    enabledByTenant: true,
                    versionPolicy: "latest",
                    currentVersionId: "ver-1",
                    latestVersionId: "ver-1",
                    blockedReason: null,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/assignments")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    tenantAgentId: "tenant-agent-1",
                    baseAgentId: "finance",
                    templateSkillKeys: ["finance-core"],
                    blockedSkillKeys: [],
                    assignmentCount: 1,
                    templateRows: [
                      {
                        skillId: "skill-1",
                        skillKey: "finance-core",
                        name: "finance-core",
                        description: "财务核心能力",
                        classification: "bundled",
                        latestVersionId: "ver-1",
                        templateState: "enabled",
                      },
                    ],
                    assignments: [
                      {
                        assignmentId: "assignment-1",
                        userId: "member-1",
                        username: "alice",
                        resolvedSkillKeys: ["finance-core"],
                        overrideRows: [],
                        overrideSummary: [],
                        blockedReasons: [],
                        status: "active",
                      },
                    ],
                  },
                ],
              };
            },
          };
        }
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
                    assignedAgentCount: 1,
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
                    agentId: "finance",
                    agentName: "财务助手",
                    description: "财务分析 Agent",
                    status: "active",
                    balancePoints: 20,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/market?baseAgentId=finance")) {
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
      }),
    );

    await bootTenantSurface();
    await flush();

    let root = document.querySelector("[data-oc-tenant-surface-root]");
    const financeAssignmentButton = root?.querySelector(
      '[data-tenant-skill-assignment-select="assignment-1"]',
    );
    financeAssignmentButton?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();

    root = document.querySelector("[data-oc-tenant-surface-root]");
    expect(root?.textContent).toContain("finance-core");
    expect(root?.textContent).toContain("财务核心能力");
    expect(root?.textContent).toContain("无需购买");
    expect(root?.querySelectorAll(".oc-tenant-skill-workbench-skill-card").length).toBe(1);
  });

  it("filters the skills workbench member tree by username from the sidebar search", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-skills-workbench");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/skills/entitlements")) {
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
        if (url.includes("/tenant/admin/skills/assignments")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    tenantAgentId: "tenant-agent-1",
                    baseAgentId: "finance",
                    templateSkillKeys: [],
                    blockedSkillKeys: [],
                    assignmentCount: 2,
                    templateRows: [],
                    assignments: [
                      {
                        assignmentId: "assignment-1",
                        userId: "member-1",
                        username: "alice",
                        resolvedSkillKeys: [],
                        overrideRows: [],
                        overrideSummary: [],
                        blockedReasons: [],
                        status: "active",
                      },
                      {
                        assignmentId: "assignment-2",
                        userId: "member-2",
                        username: "bob",
                        resolvedSkillKeys: [],
                        overrideRows: [],
                        overrideSummary: [],
                        blockedReasons: [],
                        status: "active",
                      },
                    ],
                  },
                ],
              };
            },
          };
        }
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
                    agentId: "finance",
                    agentName: "财务助手",
                    description: "财务分析 Agent",
                    status: "active",
                    balancePoints: 20,
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/skills/market?baseAgentId=finance")) {
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
      }),
    );

    await bootTenantSurface();
    await flush();

    const root = document.querySelector("[data-oc-tenant-surface-root]");
    const memberSearch = root?.querySelector(
      ".oc-tenant-skill-workbench__member-search [data-tenant-search]",
    );
    expect(root?.querySelectorAll("[data-tenant-skill-member-toggle]")).toHaveLength(2);
    expect(root?.textContent).toContain("alice");
    expect(root?.textContent).toContain("bob");
    expect(root?.querySelector(".oc-tenant-table-toolbar [data-tenant-search]")).toBeNull();

    if (memberSearch instanceof HTMLInputElement) {
      memberSearch.focus();
      memberSearch.value = "ali";
      memberSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();

    const updatedRoot = document.querySelector("[data-oc-tenant-surface-root]");
    const updatedSearch = updatedRoot?.querySelector(
      ".oc-tenant-skill-workbench__member-search [data-tenant-search]",
    );
    expect(updatedRoot?.querySelectorAll("[data-tenant-skill-member-toggle]")).toHaveLength(1);
    expect(
      updatedRoot?.querySelector('[data-tenant-skill-member-toggle="member-1"]'),
    ).not.toBeNull();
    expect(updatedRoot?.querySelector('[data-tenant-skill-member-toggle="member-2"]')).toBeNull();
    expect(document.activeElement).toBe(updatedSearch);
  });

  it("does not mount tenant management on malformed /chat routes", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/chat?ocTenantView=tenant-members&session=main");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await bootTenantSurface();

    expect(document.querySelector("[data-oc-tenant-surface-root]")).toBeNull();
    expect(
      document.querySelector(".content")?.getAttribute("data-oc-tenant-surface-active"),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders 组织范围 state from the current tenant binding instead of stale member metadata", async () => {
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
      binding: {
        tenantId: "tenant-1",
        dataSourceId: "ds-1",
        dataSourceName: "金蝶云星空",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: state.binding,
              };
            },
          };
        }
        if (url.includes("/tenant/admin/members")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: [
                  {
                    id: "member-none",
                    username: "none",
                    status: "active",
                    assignedAgentCount: 0,
                    createdAt: "2026-04-03T08:00:00.000Z",
                    orgScopeMode: "none",
                    orgScopeCount: 0,
                    boundDataSourceName: "",
                  },
                  {
                    id: "member-all",
                    username: "all",
                    status: "active",
                    assignedAgentCount: 0,
                    createdAt: "2026-04-03T08:00:00.000Z",
                    orgScopeMode: "all",
                    orgScopeCount: 0,
                    boundDataSourceName: "",
                  },
                  {
                    id: "member-custom",
                    username: "custom",
                    status: "active",
                    assignedAgentCount: 0,
                    createdAt: "2026-04-03T08:00:00.000Z",
                    orgScopeMode: "custom",
                    orgScopeCount: 2,
                    boundDataSourceName: "",
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
                data: [],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    const headerCells = Array.from(surfaceRoot?.querySelectorAll("thead th") ?? []).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(headerCells).toContain("组织范围");
    expect(surfaceRoot?.textContent).toContain("未分配");
    expect(surfaceRoot?.textContent).toContain("全部组织");
    expect(surfaceRoot?.textContent).toContain("2 个组织");
    expect(surfaceRoot?.textContent).not.toContain("未绑定数据源");

    const noneButton = surfaceRoot?.querySelector(
      "[data-tenant-open-member-org-scope='member-none']",
    );
    expect(noneButton?.textContent).toContain("选择组织范围");
    expect(noneButton?.hasAttribute("disabled")).toBe(false);

    const allButton = surfaceRoot?.querySelector(
      "[data-tenant-open-member-org-scope='member-all']",
    );
    expect(allButton?.hasAttribute("disabled")).toBe(false);
  });

  it("shows 未绑定数据源 when the tenant has no current data source binding", async () => {
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
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: null,
              };
            },
          };
        }
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
                    assignedAgentCount: 0,
                    createdAt: "2026-04-03T08:00:00.000Z",
                    orgScopeMode: "all",
                    orgScopeCount: 0,
                    boundDataSourceName: "过期数据源名称",
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
                data: [],
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const memberRow = document
      .querySelector("[data-tenant-open-member-org-scope='member-1']")
      ?.closest("tr");
    expect(memberRow?.textContent).toContain("未绑定数据源");
    expect(
      document
        .querySelector("[data-tenant-open-member-org-scope='member-1']")
        ?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("supports 组织范围 modal loading, mode switching, validation, select-all, and summary refresh", async () => {
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
          orgScopeMode: "none",
          orgScopeCount: 0,
          boundDataSourceName: "金蝶云星空",
        },
      ],
      binding: {
        tenantId: "tenant-1",
        dataSourceId: "ds-1",
        dataSourceName: "金蝶云星空",
      },
      orgs: [
        {
          orgId: "1001",
          orgNumber: "ORG-1001",
          orgName: "华东事业部",
        },
        {
          orgId: "1002",
          orgNumber: "ORG-1002",
          orgName: "华南事业部",
        },
      ],
      memberScope: {
        userId: "member-1",
        dataSourceId: "ds-1",
        scopeMode: "none",
        sandboxEnabled: false,
        orgScopeCount: 0,
        orgScopes: [],
      },
      requests: [],
      saveCalls: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(String(options.body)) : {};
        state.requests.push(`${method} ${url}`);
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
          return okJson([]);
        }
        if (url.endsWith("/tenant/admin/data-source-binding") && method === "GET") {
          return okJson(state.binding);
        }
        if (url.endsWith("/tenant/admin/orgs") && method === "GET") {
          return okJson(state.orgs);
        }
        if (url.includes("/tenant/admin/member-org-scope?") && method === "GET") {
          return okJson(state.memberScope);
        }
        if (url.endsWith("/tenant/admin/member-org-scope") && method === "POST") {
          state.saveCalls.push(body);
          const nextOrgIds = Array.isArray(body.orgIds) ? body.orgIds : [];
          state.memberScope = {
            userId: body.userId,
            dataSourceId: "ds-1",
            scopeMode: body.scopeMode,
            sandboxEnabled: Boolean(body.sandboxEnabled),
            orgScopeCount: nextOrgIds.length,
            orgScopes: state.orgs
              .filter((org) => nextOrgIds.includes(org.orgId))
              .map((org) => ({
                orgId: org.orgId,
                orgNameSnapshot: org.orgName,
              })),
          };
          state.members = state.members.map((member) =>
            member.id === body.userId
              ? {
                  ...member,
                  orgScopeMode: body.scopeMode,
                  orgScopeCount: nextOrgIds.length,
                  sandboxEnabled: body.sandboxEnabled ? 1 : 0,
                  boundDataSourceName: state.binding.dataSourceName,
                }
              : member,
          );
          return okJson(state.memberScope);
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const openButton = document.querySelector("[data-tenant-open-member-org-scope='member-1']");
    expect(openButton?.textContent).toContain("选择组织范围");
    openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const orgScopeDialog = document.querySelector("[data-tenant-member-org-scope-dialog]");
    expect(orgScopeDialog?.open).toBe(true);
    expect(state.requests).toEqual(
      expect.arrayContaining([
        "GET /tenant-platform-api/v1/tenant/admin/data-source-binding",
        "GET /tenant-platform-api/v1/tenant/admin/orgs",
        "GET /tenant-platform-api/v1/tenant/admin/member-org-scope?userId=member-1",
      ]),
    );

    const noneRadio = document.querySelector("[data-tenant-member-org-scope-mode='none']");
    const customRadio = document.querySelector("[data-tenant-member-org-scope-mode='custom']");
    const allRadio = document.querySelector("[data-tenant-member-org-scope-mode='all']");
    const sandboxCheckbox = document.querySelector("[data-tenant-member-sandbox-enabled]");
    expect(noneRadio).not.toBeNull();
    expect(customRadio).not.toBeNull();
    expect(allRadio).not.toBeNull();
    expect(sandboxCheckbox).not.toBeNull();
    expect(noneRadio instanceof HTMLInputElement ? noneRadio.checked : false).toBe(true);
    expect(sandboxCheckbox instanceof HTMLInputElement ? sandboxCheckbox.checked : true).toBe(
      false,
    );

    if (customRadio instanceof HTMLInputElement) {
      customRadio.checked = true;
      customRadio.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    const refreshedSandboxCheckbox = document.querySelector("[data-tenant-member-sandbox-enabled]");
    if (refreshedSandboxCheckbox instanceof HTMLInputElement) {
      refreshedSandboxCheckbox.checked = true;
      refreshedSandboxCheckbox.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true }),
      );
    }
    await flush();

    expect(document.querySelector("[data-tenant-member-org-scope-org='1001']")).not.toBeNull();
    expect(document.querySelector("[data-tenant-member-org-scope-org='1002']")).not.toBeNull();

    const initialOrgScopeForm = document.querySelector("[data-tenant-member-org-scope-form]");
    initialOrgScopeForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    expect(state.saveCalls).toEqual([]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "请至少选择 1 个组织。",
    );

    const selectAll = document.querySelector("[data-tenant-member-org-scope-select-all]");
    expect(selectAll).not.toBeNull();
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const orgOne = document.querySelector("[data-tenant-member-org-scope-org='1001']");
    const orgTwo = document.querySelector("[data-tenant-member-org-scope-org='1002']");
    expect(orgOne instanceof HTMLInputElement ? orgOne.checked : false).toBe(true);
    expect(orgTwo instanceof HTMLInputElement ? orgTwo.checked : false).toBe(true);

    const refreshedAllRadio = document.querySelector("[data-tenant-member-org-scope-mode='all']");
    if (refreshedAllRadio instanceof HTMLInputElement) {
      refreshedAllRadio.checked = true;
      refreshedAllRadio.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();
    expect(document.querySelector("[data-tenant-member-org-scope-org='1001']")).toBeNull();

    const refreshedCustomRadio = document.querySelector(
      "[data-tenant-member-org-scope-mode='custom']",
    );
    if (refreshedCustomRadio instanceof HTMLInputElement) {
      refreshedCustomRadio.checked = true;
      refreshedCustomRadio.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const customOrgOne = document.querySelector("[data-tenant-member-org-scope-org='1001']");
    const customOrgTwo = document.querySelector("[data-tenant-member-org-scope-org='1002']");
    expect(customOrgOne).not.toBeNull();
    if (customOrgTwo instanceof HTMLInputElement) {
      customOrgTwo.checked = false;
      customOrgTwo.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const finalOrgScopeForm = document.querySelector("[data-tenant-member-org-scope-form]");
    finalOrgScopeForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.saveCalls).toEqual([
      {
        userId: "member-1",
        scopeMode: "custom",
        sandboxEnabled: true,
        orgIds: ["1001"],
      },
    ]);
    expect(document.querySelector("[data-tenant-member-org-scope-dialog]")?.open).toBe(false);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "组织范围已更新。",
    );
    expect(
      document.querySelector("[data-tenant-open-member-org-scope='member-1']")?.closest("tr")
        ?.textContent,
    ).toContain("1 个组织");
    expect(
      document.querySelector("[data-tenant-open-member-org-scope='member-1']")?.closest("tr")
        ?.textContent,
    ).toContain("已启用");
  });

  it("filters custom org scope choices by search text and scopes select-all to visible organizations", async () => {
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
          orgScopeMode: "none",
          orgScopeCount: 0,
          boundDataSourceName: "金蝶云星空",
        },
      ],
      binding: {
        tenantId: "tenant-1",
        dataSourceId: "ds-1",
        dataSourceName: "金蝶云星空",
      },
      orgs: [
        {
          orgId: "1001",
          orgNumber: "ORG-1001",
          orgName: "华东事业部",
        },
        {
          orgId: "1002",
          orgNumber: "ORG-1002",
          orgName: "华南事业部",
        },
        {
          orgId: "2001",
          orgNumber: "FIN-2001",
          orgName: "财务共享中心",
        },
      ],
      memberScope: {
        userId: "member-1",
        dataSourceId: "ds-1",
        scopeMode: "none",
        orgScopeCount: 0,
        orgScopes: [],
      },
      saveCalls: [],
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
          return okJson([]);
        }
        if (url.endsWith("/tenant/admin/data-source-binding") && method === "GET") {
          return okJson(state.binding);
        }
        if (url.endsWith("/tenant/admin/orgs") && method === "GET") {
          return okJson(state.orgs);
        }
        if (url.includes("/tenant/admin/member-org-scope?") && method === "GET") {
          return okJson(state.memberScope);
        }
        if (url.endsWith("/tenant/admin/member-org-scope") && method === "POST") {
          state.saveCalls.push(body);
          return okJson({
            userId: body.userId,
            dataSourceId: "ds-1",
            scopeMode: body.scopeMode,
            orgScopeCount: Array.isArray(body.orgIds) ? body.orgIds.length : 0,
            orgScopes: state.orgs
              .filter((org) => Array.isArray(body.orgIds) && body.orgIds.includes(org.orgId))
              .map((org) => ({
                orgId: org.orgId,
                orgNameSnapshot: org.orgName,
              })),
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    document
      .querySelector("[data-tenant-open-member-org-scope='member-1']")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const customRadio = document.querySelector("[data-tenant-member-org-scope-mode='custom']");
    if (customRadio instanceof HTMLInputElement) {
      customRadio.checked = true;
      customRadio.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const searchInput = document.querySelector("[data-tenant-member-org-scope-search]");
    expect(searchInput).not.toBeNull();
    if (searchInput instanceof HTMLInputElement) {
      searchInput.value = "1002";
      searchInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    expect(document.querySelector("[data-tenant-member-org-scope-org='1001']")).toBeNull();
    expect(document.querySelector("[data-tenant-member-org-scope-org='2001']")).toBeNull();
    expect(document.querySelector("[data-tenant-member-org-scope-org='1002']")).not.toBeNull();

    const selectAll = document.querySelector("[data-tenant-member-org-scope-select-all]");
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    const orgScopeForm = document.querySelector("[data-tenant-member-org-scope-form]");
    orgScopeForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.saveCalls).toEqual([
      {
        userId: "member-1",
        scopeMode: "custom",
        sandboxEnabled: false,
        orgIds: ["1002"],
      },
    ]);
  });

  it("drops hidden org ids that are no longer present in the current organization list", async () => {
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
          orgScopeMode: "custom",
          orgScopeCount: 2,
          boundDataSourceName: "金蝶云星空",
        },
      ],
      binding: {
        tenantId: "tenant-1",
        dataSourceId: "ds-1",
        dataSourceName: "金蝶云星空",
      },
      orgs: [
        {
          orgId: "1001",
          orgNumber: "ORG-1001",
          orgName: "华东事业部",
        },
        {
          orgId: "1002",
          orgNumber: "ORG-1002",
          orgName: "华南事业部",
        },
      ],
      memberScope: {
        userId: "member-1",
        dataSourceId: "ds-1",
        scopeMode: "custom",
        orgScopeCount: 2,
        orgScopes: [
          {
            orgId: "1001",
            orgNameSnapshot: "华东事业部",
          },
          {
            orgId: "9999",
            orgNameSnapshot: "已删除组织",
          },
        ],
      },
      saveCalls: [],
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
          return okJson([]);
        }
        if (url.endsWith("/tenant/admin/data-source-binding") && method === "GET") {
          return okJson(state.binding);
        }
        if (url.endsWith("/tenant/admin/orgs") && method === "GET") {
          return okJson(state.orgs);
        }
        if (url.includes("/tenant/admin/member-org-scope?") && method === "GET") {
          return okJson(state.memberScope);
        }
        if (url.endsWith("/tenant/admin/member-org-scope") && method === "POST") {
          state.saveCalls.push(body);
          state.memberScope = {
            userId: body.userId,
            dataSourceId: "ds-1",
            scopeMode: body.scopeMode,
            orgScopeCount: Array.isArray(body.orgIds) ? body.orgIds.length : 0,
            orgScopes: state.orgs
              .filter((org) => Array.isArray(body.orgIds) && body.orgIds.includes(org.orgId))
              .map((org) => ({
                orgId: org.orgId,
                orgNameSnapshot: org.orgName,
              })),
          };
          state.members = state.members.map((member) =>
            member.id === body.userId
              ? {
                  ...member,
                  orgScopeMode: body.scopeMode,
                  orgScopeCount: Array.isArray(body.orgIds) ? body.orgIds.length : 0,
                }
              : member,
          );
          return okJson(state.memberScope);
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    document
      .querySelector("[data-tenant-open-member-org-scope='member-1']")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    const visibleOrg = document.querySelector("[data-tenant-member-org-scope-org='1001']");
    const otherVisibleOrg = document.querySelector("[data-tenant-member-org-scope-org='1002']");
    expect(visibleOrg instanceof HTMLInputElement ? visibleOrg.checked : false).toBe(true);
    expect(otherVisibleOrg instanceof HTMLInputElement ? otherVisibleOrg.checked : false).toBe(
      false,
    );
    expect(document.querySelector("[data-tenant-member-org-scope-org='9999']")).toBeNull();

    document
      .querySelector("[data-tenant-member-org-scope-form]")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.saveCalls).toEqual([
      {
        userId: "member-1",
        scopeMode: "custom",
        sandboxEnabled: false,
        orgIds: ["1001"],
      },
    ]);
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
        if (url.endsWith("/tenant/admin/data-source-binding") && method === "GET") {
          return okJson(null);
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

  it("keeps the member status toggle disabled across re-renders while an update is in flight", async () => {
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
      statusUpdates: [],
    };
    let resolveStatusRequest;
    const okJson = (data) => ({
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
      vi.fn((input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(String(options.body)) : {};
        if (url.includes("/tenant/admin/members") && method === "GET") {
          return Promise.resolve(okJson(state.members));
        }
        if (url.includes("/tenant/admin/tenant-agents") && method === "GET") {
          return Promise.resolve(okJson([]));
        }
        if (url.endsWith("/tenant/admin/data-source-binding") && method === "GET") {
          return Promise.resolve(okJson(null));
        }
        if (url.endsWith("/tenant/admin/members/status") && method === "POST") {
          state.statusUpdates.push(body);
          return new Promise((resolve) => {
            resolveStatusRequest = () => {
              const member = state.members.find((item) => item.id === body.userId);
              if (member) {
                member.status = body.status;
              }
              resolve(okJson(member ?? null));
            };
          });
        }
        if (url.endsWith("/tenant/admin/members/password") && method === "POST") {
          return Promise.resolve(okJson({ id: "member-1", username: "alice", status: "active" }));
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const initialToggle = document.querySelector("[data-tenant-member-status-toggle='member-1']");
    expect(initialToggle).not.toBeNull();
    if (initialToggle instanceof HTMLInputElement) {
      initialToggle.checked = false;
      initialToggle.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();

    let pendingToggle = document.querySelector("[data-tenant-member-status-toggle='member-1']");
    expect(pendingToggle instanceof HTMLInputElement ? pendingToggle.disabled : false).toBe(true);
    expect(pendingToggle instanceof HTMLInputElement ? pendingToggle.checked : true).toBe(false);

    document
      .querySelector("[data-tenant-open-member-password='member-1']")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    pendingToggle = document.querySelector("[data-tenant-member-status-toggle='member-1']");
    expect(pendingToggle instanceof HTMLInputElement ? pendingToggle.disabled : false).toBe(true);

    if (pendingToggle instanceof HTMLInputElement) {
      pendingToggle.checked = true;
      pendingToggle.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
    await flush();
    expect(state.statusUpdates).toEqual([
      {
        userId: "member-1",
        status: "inactive",
      },
    ]);

    resolveStatusRequest?.();
    await flush();
    await flush();

    const finalToggle = document.querySelector("[data-tenant-member-status-toggle='member-1']");
    expect(finalToggle instanceof HTMLInputElement ? finalToggle.disabled : true).toBe(false);
    expect(finalToggle instanceof HTMLInputElement ? finalToggle.checked : true).toBe(false);
  });

  it("deletes a tenant member from the members list and refreshes the table", async () => {
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
      deleteCalls: [],
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
          return okJson([]);
        }
        if (url.endsWith("/tenant/admin/data-source-binding") && method === "GET") {
          return okJson(null);
        }
        if (url.endsWith("/tenant/admin/members/delete") && method === "POST") {
          state.deleteCalls.push(body);
          state.members = state.members.filter((member) => member.id !== body.userId);
          return okJson({
            id: body.userId,
            username: "alice",
            revokedAssignmentCount: 2,
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const deleteButton = document.querySelector("[data-tenant-open-member-delete='member-1']");
    expect(deleteButton?.textContent).toContain("删除成员");
    deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const deleteDialog = document.querySelector("[data-tenant-member-delete-dialog]");
    expect(deleteDialog?.open).toBe(true);
    expect(deleteDialog?.textContent).toContain("alice");
    expect(deleteDialog?.textContent).toContain("2 条 Agent 分配");

    const deleteForm = document.querySelector("[data-tenant-member-delete-form]");
    deleteForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.deleteCalls).toEqual([{ userId: "member-1" }]);
    expect(document.querySelector("[data-tenant-member-delete-dialog]")?.open).toBe(false);
    expect(document.querySelector("[data-tenant-open-member-delete='member-1']")).toBeNull();
    expect(document.querySelector(".oc-tenant-table-empty")?.textContent).toContain("暂无成员数据");
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "成员“alice”已删除，并同步失效 2 条 Agent 分配。",
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
    expect(surfaceRoot?.textContent).toContain("成员");
    expect(surfaceRoot?.textContent).toContain("已分配 Agent");
    expect(surfaceRoot?.textContent).toContain("创建时间");
    expect(surfaceRoot?.textContent).toContain("alice");
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
            derivedAgentIds: tenantAgentIds.map((tenantAgentId) => `${tenantAgentId}-derived`),
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
    expect(
      assignDialog?.querySelector("[data-tenant-assign-agent-select='tenant-agent-1']"),
    ).toBeNull();
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
    expect(surfaceRoot?.querySelector("[data-tenant-search]")).not.toBeNull();
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

  it("mounts a fallback tenant shell when the native content area is unavailable", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-members");
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  tenantId: "tenant-1",
                  dataSourceId: "ds-1",
                  dataSourceName: "主账套",
                },
              };
            },
          };
        }
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
                    assignedAgentCount: 0,
                    createdAt: "2026-04-03T08:00:00.000Z",
                    orgScopeMode: "custom",
                    orgScopeCount: 2,
                    boundDataSourceName: "主账套",
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
              return { ok: true, data: [] };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const fallbackShell = document.querySelector("[data-oc-tenant-surface-fallback]");
    expect(fallbackShell).not.toBeNull();
    expect(fallbackShell?.classList.contains("content")).toBe(true);
    expect(document.body.getAttribute("data-oc-tenant-surface-active")).toBe("fallback");
    expect(document.querySelector("openclaw-app")).not.toBeNull();
    expect(document.querySelector("[data-oc-tenant-surface-root]")?.textContent).toContain("alice");
  });

  it("recovers from fallback to native content when the tenant shell arrives late", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-members");
    document.body.innerHTML = "<openclaw-app></openclaw-app>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.endsWith("/tenant/admin/data-source-binding")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  tenantId: "tenant-1",
                  dataSourceId: "ds-1",
                  dataSourceName: "主账套",
                },
              };
            },
          };
        }
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
                    assignedAgentCount: 0,
                    createdAt: "2026-04-03T08:00:00.000Z",
                    orgScopeMode: "custom",
                    orgScopeCount: 2,
                    boundDataSourceName: "主账套",
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
              return { ok: true, data: [] };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    expect(document.body.getAttribute("data-oc-tenant-surface-active")).toBe("fallback");

    const nativeContent = document.createElement("main");
    nativeContent.className = "content";
    document.querySelector("openclaw-app")?.prepend(nativeContent);
    await flush();
    await flush();

    expect(document.body.getAttribute("data-oc-tenant-surface-active")).toBeNull();
    expect(document.querySelector("[data-oc-tenant-surface-fallback]")).toBeNull();
    expect(nativeContent.getAttribute("data-oc-tenant-surface-active")).toBe("true");
    expect(nativeContent.querySelector("[data-oc-tenant-surface-root]")?.textContent).toContain(
      "alice",
    );
  });

  it("mounts the native tenant owned-agents view and opens the detail dialog", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-owned-agents");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
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
                    description: "财务分析与预算评估",
                    status: "active",
                    rateMultiplier: 1.5,
                    balancePoints: 128.5,
                    createdAt: "2026-04-01T08:00:00.000Z",
                    updatedAt: "2026-04-14T11:30:00.000Z",
                    emoji: "💼",
                  },
                ],
              };
            },
          };
        }
        if (url.includes("/tenant/admin/wallet")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  summary: {
                    walletBalance: 300,
                  },
                  orders: [],
                  ledger: [],
                  tenantAgents: [],
                  payment: {
                    providerName: "通联支付",
                    enabled: true,
                    channels: [],
                  },
                },
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(surfaceRoot?.querySelector("[data-tenant-search]")).not.toBeNull();
    expect(surfaceRoot?.textContent).toContain("苏博泰克财务分析助手");
    expect(surfaceRoot?.textContent).toContain("财务分析与预算评估");
    expect(surfaceRoot?.textContent).toContain("128.5");
    const detailButton = surfaceRoot?.querySelector("[data-tenant-open-agent-detail]");
    expect(detailButton?.textContent).toContain("详情");

    detailButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();

    const detailDialog = document.querySelector("[data-tenant-agent-detail-dialog]");
    expect(detailDialog?.open).toBe(true);
    expect(detailDialog?.textContent).toContain("Agent 详情");
    expect(detailDialog?.textContent).toContain("subotech-finance");
    expect(detailDialog?.textContent).toContain("1.5");
    expect(detailDialog?.textContent).toContain("2026/04/14");
  });

  it("mounts the native tenant wallet recharge view without embedded order and ledger lists", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-wallet");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/tenant/admin/wallet")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  summary: {
                    walletBalance: 120.5,
                    pendingOrderCount: 1,
                    totalRecharged: 200,
                    totalTransferred: 79.5,
                    latestPaidAt: "2026-04-15T08:00:00.000Z",
                  },
                  orders: [
                    {
                      id: "payment-1",
                      amountCny: 88.5,
                      status: "pending_payment",
                      launchHref: "/pay",
                      launchQrDataUrl: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
                    },
                  ],
                  ledger: [
                    {
                      id: "ledger-1",
                      category: "recharge",
                      direction: "credit",
                      amountPoints: 88.5,
                      balanceAfter: 120.5,
                      paymentOrderId: "payment-1",
                      createdAt: "2026-04-15T08:00:00.000Z",
                    },
                  ],
                  tenantAgents: [],
                  payment: {
                    providerName: "通联支付",
                    enabled: true,
                    channels: [
                      {
                        id: "allinpay_h5_auto",
                        label: "支付宝/微信",
                      },
                    ],
                  },
                },
              };
            },
          };
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(surfaceRoot?.textContent).toContain("在线充值");
    expect(surfaceRoot?.textContent).toContain("钱包余额");
    expect(surfaceRoot?.textContent).toContain("待处理订单");
    expect(surfaceRoot?.querySelector("[data-tenant-wallet-recharge-form]")).not.toBeNull();
    expect(surfaceRoot?.textContent).not.toContain("充值订单");
    expect(surfaceRoot?.textContent).not.toContain("钱包流水");
    expect(surfaceRoot?.textContent).not.toContain("划转积分");
    expect(surfaceRoot?.querySelector("[data-tenant-agent-transfer-form]")).toBeNull();
  });

  it("mounts the native tenant wallet orders view with search and pagination", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-wallet-orders");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const requests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("/tenant/admin/payment-orders?page=1&pageSize=8")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  items: [
                    {
                      id: "payment-1",
                      amountCny: 88.5,
                      amountPoints: 88.5,
                      status: "pending_payment",
                      providerOrderId: "trx-001",
                      channelLabel: "支付宝/微信",
                      launchHref: "/pay",
                      launchQrDataUrl: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
                      createdAt: "2026-04-15T08:00:00.000Z",
                      updatedAt: "2026-04-15T08:00:00.000Z",
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
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(
      requests.some((url) => url.includes("/tenant/admin/payment-orders?page=1&pageSize=8")),
    ).toBe(true);
    expect(surfaceRoot?.textContent).toContain("充值订单");
    expect(surfaceRoot?.textContent).toContain("订单号");
    expect(surfaceRoot?.textContent).toContain("payment-1");
    expect(surfaceRoot?.querySelector("[data-tenant-search]")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-page='prev']")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-page='next']")).not.toBeNull();
  });

  it("mounts the native tenant model usage view with search and pagination", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-wallet-ledger");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const requests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("/tenant/admin/wallet-ledger?page=1&pageSize=8")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  items: [
                    {
                      id: "ledger-1",
                      category: "usage_charge",
                      direction: "debit",
                      amountPoints: 2.5,
                      balanceAfter: 16.5,
                      paymentOrderId: "",
                      note: "usage:test-session:usage-1",
                      createdAt: "2026-04-15T08:00:00.000Z",
                      tenantAgentName: "财务分析助手",
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
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(
      requests.some((url) => url.includes("/tenant/admin/wallet-ledger?page=1&pageSize=8")),
    ).toBe(true);
    expect(surfaceRoot?.textContent).toContain("模型耗用");
    expect(surfaceRoot?.textContent).toContain("关联");
    expect(surfaceRoot?.textContent).toContain("模型扣费");
    expect(surfaceRoot?.querySelector("[data-tenant-search]")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-page='prev']")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-page='next']")).not.toBeNull();
  });

  it("mounts the native tenant wallet flow view with search and pagination", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-wallet-flow");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const requests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("/tenant/admin/wallet-flow?page=1&pageSize=8")) {
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  items: [
                    {
                      id: "ledger-flow-1",
                      category: "agent_revoke_refund",
                      direction: "credit",
                      amountPoints: 28,
                      balanceAfter: 128,
                      paymentOrderId: "",
                      note: "revoke:tenant-agent-1:finance",
                      createdAt: "2026-04-15T09:00:00.000Z",
                      tenantAgentName: "财务分析助手",
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
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    expect(
      requests.some((url) => url.includes("/tenant/admin/wallet-flow?page=1&pageSize=8")),
    ).toBe(true);
    expect(surfaceRoot?.textContent).toContain("钱包流水");
    expect(surfaceRoot?.textContent).toContain("关联");
    expect(surfaceRoot?.textContent).toContain("Agent 撤回回退");
    expect(surfaceRoot?.querySelector("[data-tenant-search]")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-page='prev']")).not.toBeNull();
    expect(surfaceRoot?.querySelector("[data-tenant-page='next']")).not.toBeNull();
  });

  it("opens a transfer modal from the owned-agent card and submits the transfer", async () => {
    writeTenantSession({
      token: "tenant-token",
      session: {
        role: "tenant_admin",
        username: "tenant-admin",
      },
    });
    window.history.replaceState({}, "", "/?ocTenantView=tenant-owned-agents");
    document.body.innerHTML = `
      <div class="content">
        <div class="native-placeholder">native content</div>
      </div>
    `;
    const state = {
      walletBalance: 300,
      tenantAgents: [
        {
          id: "tenant-agent-1",
          agentId: "subotech-finance",
          agentName: "苏博泰克财务分析助手",
          description: "财务分析与预算评估",
          status: "active",
          rateMultiplier: 1.5,
          balancePoints: 128.5,
          createdAt: "2026-04-01T08:00:00.000Z",
          updatedAt: "2026-04-14T11:30:00.000Z",
          emoji: "💼",
        },
      ],
      transferCalls: [],
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
        if (url.includes("/tenant/admin/tenant-agents") && method === "GET") {
          return okJson(state.tenantAgents);
        }
        if (url.includes("/tenant/admin/wallet") && method === "GET") {
          return okJson({
            summary: {
              walletBalance: state.walletBalance,
            },
            orders: [],
            ledger: [],
            tenantAgents: state.tenantAgents,
            payment: {
              providerName: "通联支付",
              enabled: true,
              channels: [],
            },
          });
        }
        if (url.endsWith("/tenant/admin/wallet/transfers") && method === "POST") {
          state.transferCalls.push(body);
          state.walletBalance -= Number(body.amountPoints || 0);
          state.tenantAgents = state.tenantAgents.map((agent) =>
            agent.id === body.tenantAgentId
              ? {
                  ...agent,
                  balancePoints: Number(agent.balancePoints || 0) + Number(body.amountPoints || 0),
                }
              : agent,
          );
          return okJson({
            tenantAgentId: body.tenantAgentId,
            amountPoints: Number(body.amountPoints || 0),
            walletBalance: state.walletBalance,
            agentBalance: state.tenantAgents[0]?.balancePoints,
          });
        }
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    await bootTenantSurface();
    await flush();

    const surfaceRoot = document.querySelector("[data-oc-tenant-surface-root]");
    const agentCard = surfaceRoot?.querySelector("[data-tenant-agent-card='tenant-agent-1']");
    expect(agentCard?.textContent).toContain("划转积分");
    expect(agentCard?.textContent).not.toContain("计费倍率");
    expect(agentCard?.querySelector("[data-tenant-agent-transfer-form]")).toBeNull();

    const transferDialogBeforeClick = surfaceRoot?.querySelector(
      "[data-tenant-agent-transfer-dialog]",
    );
    expect(
      transferDialogBeforeClick?.querySelector("[data-tenant-agent-transfer-form]"),
    ).toBeNull();

    (
      surfaceRoot?.querySelector(
        "[data-tenant-open-agent-transfer='tenant-agent-1']",
      ) as HTMLButtonElement | null
    )?.click();
    await flush();

    const transferDialog = document.querySelector("[data-tenant-agent-transfer-dialog]");
    const transferForm = transferDialog?.querySelector("[data-tenant-agent-transfer-form]");
    expect(transferForm).not.toBeNull();
    const amountInput = transferForm?.querySelector("input[name='amountPoints']");
    const noteInput = transferForm?.querySelector("input[name='note']");
    if (amountInput instanceof HTMLInputElement) {
      amountInput.value = "20";
    }
    if (noteInput instanceof HTMLInputElement) {
      noteInput.value = "补充预算";
    }
    transferForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    await flush();

    expect(state.transferCalls).toEqual([
      {
        tenantAgentId: "tenant-agent-1",
        amountPoints: "20",
        note: "补充预算",
      },
    ]);
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "已划转 20 积分",
    );
    expect(surfaceRoot?.textContent).toContain("148.5");
  });
});

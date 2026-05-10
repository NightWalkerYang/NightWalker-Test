import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAllinpayLaunchDescriptor,
  buildQrSvgDataUrl,
  resolveAllinpaySidecarConfig,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/allinpay.mjs";
import { verifyPassword } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/auth.mjs";
import {
  openTenantPlatformDb,
  closeTenantPlatformDb,
  createPlatformUpdateLog,
  createBootstrapPlatformAdmin,
  createTenantPaymentOrder,
  deleteTenantMember,
  deletePlatformUpdateLog,
  createTenantWithAdmin,
  createTenantMember,
  confirmTenantPaymentOrderPaid,
  getTenantPaymentOrderById,
  getUserByUsername,
  listPlatformUpdateLogs,
  listTenantAgents,
  listTenantMembers,
  listTenantPaymentOrdersPage,
  listTenantModelUsageEntriesPage,
  listTenantWalletLedgerEntriesPage,
  listTenantWalletFlowEntriesPage,
  readOpenClawAgentCatalog,
  repairTenantUsageCostGaps,
  upsertTenantAgent,
  assignTenantAgentToUser,
  revokeTenantAgentAssignments,
  revokePlatformTenantAgents,
  listAssignedAgentsForUser,
  listAssignedAgentVisualizationsForUser,
  listAssignedAgentSandboxesForUser,
  getTenantOverview,
  getTenantWalletDashboard,
  listTenantUsageRecords,
  syncTenantUsageRecords,
  transferTenantWalletToAgent,
  updatePlatformUpdateLog,
  updateTenantPaymentOrderStatus,
  updateTenantMemberLimit,
  updateTenantMemberPassword,
  updateTenantMemberStatus,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
import { rewriteVisualizationHtml } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs";

const cleanupRoots = new Set();

function createTempSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-platform-"));
  cleanupRoots.add(root);
  const configDir = path.join(root, ".openclaw");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "openclaw.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      agents: {
        list: [
          {
            id: "finance",
            name: "财务分析助手",
            identity: {
              emoji: "💼",
              avatar: "avatars/finance.png",
            },
          },
        ],
      },
    }),
    "utf8",
  );
  return {
    root,
    config: {
      configDir,
      stateDir: path.join(configDir, "tenant-platform"),
      dbPath: path.join(configDir, "tenant-platform", "tenant-platform.sqlite"),
      configPath,
    },
  };
}

function readExecApprovals(sandbox) {
  const approvalsPath = path.join(sandbox.config.configDir, "exec-approvals.json");
  if (!fs.existsSync(approvalsPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(approvalsPath, "utf8"));
}

function writeExecApprovals(sandbox, payload) {
  const approvalsPath = path.join(sandbox.config.configDir, "exec-approvals.json");
  fs.writeFileSync(approvalsPath, JSON.stringify(payload, null, 2), "utf8");
}

function writeSessionStoreEntry(sandbox, agentId, sessionKey, entry) {
  const sessionsDir = path.join(sandbox.config.configDir, "agents", agentId, "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  const storePath = path.join(sessionsDir, "sessions.json");
  const current =
    fs.existsSync(storePath) && fs.statSync(storePath).size > 0
      ? JSON.parse(fs.readFileSync(storePath, "utf8"))
      : {};
  current[sessionKey] = {
    ...(current[sessionKey] && typeof current[sessionKey] === "object" ? current[sessionKey] : {}),
    ...entry,
  };
  fs.writeFileSync(storePath, JSON.stringify(current, null, 2), "utf8");
}

function readConfigAgentIds(sandbox) {
  const parsed = JSON.parse(fs.readFileSync(sandbox.config.configPath, "utf8"));
  return Array.isArray(parsed?.agents?.list)
    ? parsed.agents.list.map((entry) => String(entry?.id || "").trim()).filter(Boolean)
    : [];
}

afterEach(() => {
  for (const root of cleanupRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  cleanupRoots.clear();
});

describe("tenant platform database foundation", () => {
  it("creates a bootstrap platform admin and a tenant with an admin", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });
      const tenant = createTenantWithAdmin(db, {
        code: "alpha",
        name: "租户 Alpha",
        adminUsername: "alpha-admin",
        adminPassword: "secret",
        memberLimit: 8,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      expect(platformAdmin?.role).toBe("platform_admin");
      expect(tenant?.code).toBe("alpha");
      expect(tenant?.memberLimit).toBe(8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("creates, updates, lists, and deletes platform update logs", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      const platformAdmin = createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const created = createPlatformUpdateLog(db, {
        versionLabel: "v2026.4.23",
        title: "新增更新日志中心",
        content: "1. 平台管理员可以发布更新日志。\n2. 租户侧登录后会弹出最新更新。",
        createdByUserId: platformAdmin?.id,
        createdByUsername: platformAdmin?.username,
      });

      expect(created).toMatchObject({
        versionLabel: "v2026.4.23",
        title: "新增更新日志中心",
        createdByUsername: "platform-root",
      });

      const updated = updatePlatformUpdateLog(db, {
        id: created?.id,
        versionLabel: "v2026.4.23-hotfix1",
        title: "更新日志中心热修复",
        content: "1. 修复自动弹窗。\n2. 修复历史搜索。",
      });
      expect(updated).toMatchObject({
        id: created?.id,
        versionLabel: "v2026.4.23-hotfix1",
        title: "更新日志中心热修复",
      });

      const listed = listPlatformUpdateLogs(db);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        id: created?.id,
        versionLabel: "v2026.4.23-hotfix1",
        title: "更新日志中心热修复",
      });
      expect(listed[0]?.excerpt).toContain("修复自动弹窗");

      const deleted = deletePlatformUpdateLog(db, { id: created?.id });
      expect(deleted).toMatchObject({
        id: created?.id,
        title: "更新日志中心热修复",
      });
      expect(listPlatformUpdateLogs(db)).toEqual([]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("assigns a tenant agent to a member and returns card-ready identity fields", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      const baseWorkspace = path.join(sandbox.config.configDir, "workspace-agents", "finance");
      fs.mkdirSync(path.join(baseWorkspace, "memory"), { recursive: true });
      fs.mkdirSync(path.join(baseWorkspace, "skills"), { recursive: true });
      fs.mkdirSync(path.join(baseWorkspace, "sessions"), { recursive: true });
      fs.writeFileSync(path.join(baseWorkspace, "MEMORY.md"), "# 母 Agent 记忆", "utf8");
      fs.writeFileSync(
        path.join(baseWorkspace, "memory", "tenant-policy.md"),
        "成员首次分配后应继承这段记忆。",
        "utf8",
      );
      fs.writeFileSync(
        path.join(baseWorkspace, "skills", "README.md"),
        "skills should be available in the derived workspace",
        "utf8",
      );
      fs.writeFileSync(
        path.join(baseWorkspace, "sessions", "old.jsonl"),
        '{"type":"assistant"}\n',
        "utf8",
      );
      fs.writeFileSync(
        path.join(baseWorkspace, "BOOTSTRAP.md"),
        "# BOOTSTRAP.md - should stay inherited and be filtered only at runtime\n",
        "utf8",
      );
      fs.mkdirSync(path.join(baseWorkspace, "hooks"), { recursive: true });
      fs.writeFileSync(path.join(baseWorkspace, "hooks", "README.md"), "hook docs", "utf8");

      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "beta",
        name: "租户 Beta",
        adminUsername: "beta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      expect(listTenantMembers(db, tenant.id)).toHaveLength(1);

      const catalog = readOpenClawAgentCatalog(sandbox.config.configPath);
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析与报表问答",
        rateMultiplier: 1.25,
        balancePoints: 42,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      expect(String(assignment.derivedAgentId || "")).toMatch(/^tenant-/);
      expect(
        fs.existsSync(
          path.join(
            sandbox.config.configDir,
            "workspace-agents",
            String(assignment.derivedAgentId),
          ),
        ),
      ).toBe(true);
      const derivedWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
      );
      expect(fs.readFileSync(path.join(derivedWorkspace, "MEMORY.md"), "utf8")).toContain(
        "母 Agent 记忆",
      );
      expect(
        fs.readFileSync(path.join(derivedWorkspace, "memory", "tenant-policy.md"), "utf8"),
      ).toContain("成员首次分配后应继承");
      expect(fs.readFileSync(path.join(derivedWorkspace, "skills", "README.md"), "utf8")).toContain(
        "skills should be available",
      );
      expect(fs.readFileSync(path.join(derivedWorkspace, "hooks", "README.md"), "utf8")).toContain(
        "hook docs",
      );
      expect(fs.existsSync(path.join(derivedWorkspace, "sessions", "old.jsonl"))).toBe(false);
      expect(fs.readFileSync(path.join(derivedWorkspace, "BOOTSTRAP.md"), "utf8")).toContain(
        "should stay inherited",
      );
      expect(readConfigAgentIds(sandbox)).toContain(String(assignment.derivedAgentId));

      const agents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        catalog,
      );
      expect(agents).toHaveLength(1);
      expect(agents[0]?.baseAgentId).toBe("finance");
      expect(agents[0]?.agentId).toBe(assignment.derivedAgentId);
      expect(agents[0]?.agentName).toBe("财务分析助手");
      expect(agents[0]?.emoji).toBe("💼");
      expect(agents[0]?.balancePoints).toBe(42);

      const visualizationDir = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
        "Echarts",
      );
      fs.mkdirSync(path.join(visualizationDir, "sales"), { recursive: true });
      fs.writeFileSync(path.join(visualizationDir, "销售数据可视化_index.html"), "<html></html>");
      fs.writeFileSync(path.join(visualizationDir, "折线图_index.html"), "<html></html>");
      fs.writeFileSync(
        path.join(visualizationDir, "sales", "区域销售数据_index.html"),
        "<html></html>",
      );
      fs.writeFileSync(path.join(visualizationDir, "notes.txt"), "ignored");

      const visualizations = listAssignedAgentVisualizationsForUser(
        db,
        {
          tenantId: tenant.id,
          userId: member.id,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        },
        catalog,
      );
      expect(visualizations).toHaveLength(3);
      expect(visualizations.map((item) => item.visualizationName).toSorted()).toEqual([
        "sales/区域销售数据",
        "折线图",
        "销售数据可视化",
      ]);
      expect(
        visualizations.find((item) => item.visualizationName === "sales/区域销售数据")
          ?.visualizationRelativePath,
      ).toBe("sales/区域销售数据_index.html");
      expect(
        visualizations.every(
          (item) =>
            item.visualizationFileName.endsWith("_index.html") && item.agentName === "财务分析助手",
        ),
      ).toBe(true);

      const sandboxes = listAssignedAgentSandboxesForUser(
        db,
        {
          tenantId: tenant.id,
          userId: member.id,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        },
        catalog,
      );
      expect(sandboxes).toHaveLength(1);
      expect(sandboxes[0]?.sandboxFileName).toBe("采购沙盒模拟_sandbox.json");
      expect(sandboxes[0]?.sandboxName).toBe("采购沙盒模拟");
      expect(sandboxes[0]?.isVirtualSandbox).toBe(true);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("falls back to OPENCLAW_WORKSPACE_DIR for split workspace deployments", () => {
    const sandbox = createTempSandbox();
    fs.writeFileSync(
      sandbox.config.configPath,
      JSON.stringify({
        agents: {
          list: [
            {
              id: "main",
              name: "默认助手",
            },
          ],
        },
        models: {
          mode: "merge",
          providers: {
            cleannetworkspace: {
              api: "openai-completions",
              models: [
                {
                  id: "gpt-5.4",
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
                {
                  id: "gpt-5.4-mini",
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
              ],
            },
          },
        },
      }),
      "utf8",
    );

    const splitWorkspace = path.join(sandbox.root, "shared-workspace");
    fs.mkdirSync(path.join(splitWorkspace, "memory"), { recursive: true });
    fs.mkdirSync(path.join(splitWorkspace, "skills"), { recursive: true });
    fs.writeFileSync(path.join(splitWorkspace, "MEMORY.md"), "# 主工作区记忆", "utf8");
    fs.writeFileSync(
      path.join(splitWorkspace, "memory", "split-layout.md"),
      "split workspace should still seed derived agents",
      "utf8",
    );
    fs.writeFileSync(
      path.join(splitWorkspace, "skills", "README.md"),
      "split workspace skills should be visible in derived agents",
      "utf8",
    );

    const previousWorkspaceDir = process.env.OPENCLAW_WORKSPACE_DIR;
    process.env.OPENCLAW_WORKSPACE_DIR = splitWorkspace;

    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "gamma",
        name: "租户 Gamma",
        adminUsername: "gamma-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-split",
        password: "secret",
      });

      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "main",
        description: "默认助手",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const derivedWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
      );
      expect(fs.readFileSync(path.join(derivedWorkspace, "MEMORY.md"), "utf8")).toContain(
        "主工作区记忆",
      );
      expect(
        fs.readFileSync(path.join(derivedWorkspace, "memory", "split-layout.md"), "utf8"),
      ).toContain("split workspace should still seed derived agents");
      expect(fs.readFileSync(path.join(derivedWorkspace, "skills", "README.md"), "utf8")).toContain(
        "split workspace skills should be visible",
      );
    } finally {
      if (previousWorkspaceDir === undefined) {
        delete process.env.OPENCLAW_WORKSPACE_DIR;
      } else {
        process.env.OPENCLAW_WORKSPACE_DIR = previousWorkspaceDir;
      }
      closeTenantPlatformDb(db);
    }
  });

  it("copies base agent exec approvals into the derived agent bucket on assignment", () => {
    const sandbox = createTempSandbox();
    writeExecApprovals(sandbox, {
      version: 1,
      defaults: {
        security: "full",
        ask: "off",
        askFallback: "full",
      },
      agents: {
        finance: {
          security: "full",
          ask: "off",
          askFallback: "full",
          autoAllowSkills: true,
          allowlist: [
            {
              id: "allow-ls",
              pattern: "/usr/bin/ls",
            },
            {
              pattern: "=command:finance",
            },
          ],
        },
        "*": {
          allowlist: [
            {
              pattern: "/usr/bin/pwd",
            },
          ],
        },
      },
    });

    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "approval-sync",
        name: "租户 Approval Sync",
        adminUsername: "approval-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-approval",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 8,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const approvals = readExecApprovals(sandbox);
      const derivedBucket = approvals?.agents?.[String(assignment.derivedAgentId)];
      expect(derivedBucket).toMatchObject({
        security: "full",
        ask: "off",
        askFallback: "full",
        autoAllowSkills: true,
      });
      expect(derivedBucket.allowlist).toEqual([
        expect.objectContaining({ pattern: "/usr/bin/ls" }),
        expect.objectContaining({ pattern: "=command:finance" }),
      ]);
      expect(approvals?.agents?.["*"]?.allowlist).toEqual([
        expect.objectContaining({ pattern: "/usr/bin/pwd" }),
      ]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("backfills derived agent approval buckets for legacy assignments while preserving derived entries", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "approval-heal",
        name: "租户 Approval Heal",
        adminUsername: "approval-heal-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-heal",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 8,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const derivedAgentId = String(assignment.derivedAgentId || "");

      writeExecApprovals(sandbox, {
        version: 1,
        defaults: {
          security: "full",
          ask: "off",
          askFallback: "full",
        },
        agents: {
          finance: {
            security: "full",
            ask: "off",
            askFallback: "full",
            allowlist: [
              {
                pattern: "/usr/bin/head",
              },
              {
                pattern: "=command:shared",
              },
            ],
          },
          [derivedAgentId]: {
            ask: "always",
            allowlist: [
              {
                pattern: "/usr/bin/cat",
              },
              {
                pattern: "=command:shared",
              },
            ],
          },
        },
      });

      const assignedAgents = listAssignedAgentsForUser(
        db,
        {
          tenantId: tenant.id,
          userId: member.id,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents).toHaveLength(1);

      const approvals = readExecApprovals(sandbox);
      const derivedBucket = approvals?.agents?.[derivedAgentId];
      expect(derivedBucket).toMatchObject({
        security: "full",
        ask: "off",
        askFallback: "full",
      });
      expect(derivedBucket.allowlist.map((entry) => entry.pattern).toSorted()).toEqual(
        ["/usr/bin/cat", "/usr/bin/head", "=command:shared"].toSorted(),
      );
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("removes derived agent approval buckets when deleting a tenant member", () => {
    const sandbox = createTempSandbox();
    writeExecApprovals(sandbox, {
      version: 1,
      defaults: {
        security: "full",
        ask: "off",
        askFallback: "full",
      },
      agents: {
        finance: {
          security: "full",
          ask: "off",
          askFallback: "full",
          allowlist: [
            {
              pattern: "/usr/bin/ls",
            },
          ],
        },
      },
    });

    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "approval-delete",
        name: "租户 Approval Delete",
        adminUsername: "approval-delete-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-delete-approval",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 8,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const derivedAgentId = String(assignment.derivedAgentId || "");
      expect(readExecApprovals(sandbox)?.agents?.[derivedAgentId]).toBeTruthy();

      deleteTenantMember(db, {
        tenantId: tenant.id,
        userId: member.id,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const approvals = readExecApprovals(sandbox);
      expect(approvals?.agents?.finance).toBeTruthy();
      expect(approvals?.agents?.[derivedAgentId]).toBeUndefined();
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("externalizes inline HTML handlers so echarts-view modal close buttons stay clickable", () => {
    const sandbox = createTempSandbox();
    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      "finance",
      "Echarts",
    );
    fs.mkdirSync(visualizationDir, { recursive: true });

    const rewrittenHtml = rewriteVisualizationHtml(
      [
        "<!doctype html>",
        "<html>",
        "  <body>",
        '    <div id="modalMask" style="display:block">',
        '      <button class="modal-close" onclick="closeDrill()">关闭</button>',
        '      <button class="modal-next" onclick="window.location.href=\'next_index.html\'; return false;">下一页</button>',
        "    </div>",
        "    <script>",
        "      function closeDrill() {",
        "        document.getElementById('modalMask').style.display = 'none';",
        "      }",
        "    </script>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "/workspace-agent-downloads/finance/Echarts/",
      visualizationDir,
      "集团经营分析总览大屏_index.html",
      new Map([["next_index.html", "/echarts-view/?token=next-token"]]),
    );

    expect(rewrittenHtml).not.toContain("onclick=");
    expect(rewrittenHtml).toContain("data-openclaw-inline-handler-1");
    expect(rewrittenHtml).toContain("data-openclaw-inline-handler-2");

    const assetPrefix = /^\/workspace-agent-downloads\/finance\/Echarts\//;
    const generatedInlineScriptMatch = rewrittenHtml.match(
      /<script\b[^>]*src="([^"]*inline-script-[^"]+\.js)"[^>]*><\/script>/i,
    );
    expect(generatedInlineScriptMatch).not.toBeNull();

    const generatedHandlerScriptMatch = rewrittenHtml.match(
      /<script\b[^>]*src="([^"]*inline-handler-[^"]+\.js)"[^>]*><\/script>/i,
    );
    expect(generatedHandlerScriptMatch).not.toBeNull();

    const generatedHandlerScriptPath = path.join(
      visualizationDir,
      String(generatedHandlerScriptMatch?.[1] || "").replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedHandlerScriptPath)).toBe(true);

    const generatedHandlerScriptContent = fs.readFileSync(generatedHandlerScriptPath, "utf8");
    expect(generatedHandlerScriptContent).toContain('addEventListener("click"');
    expect(generatedHandlerScriptContent).toContain("closeDrill()");
    expect(generatedHandlerScriptContent).toContain("event.preventDefault()");
    expect(generatedHandlerScriptContent).toContain("event.stopPropagation()");
    expect(generatedHandlerScriptContent).toContain(
      "window.top.location.href = '/echarts-view/?token=next-token'",
    );
  });

  it("updates tenant member limits without breaking current member counts", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "gamma",
        name: "租户 Gamma",
        adminUsername: "gamma-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });

      const updated = updateTenantMemberLimit(db, {
        tenantId: tenant.id,
        memberLimit: 6,
      });

      expect(updated?.memberLimit).toBe(6);
      expect(() =>
        updateTenantMemberLimit(db, {
          tenantId: tenant.id,
          memberLimit: 0,
        }),
      ).toThrow("member_limit_invalid");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("revokes tenant-distributed agents and invalidates related member assignments", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "lambda",
        name: "租户 Lambda",
        adminUsername: "lambda-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const memberA = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const memberB = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-b",
        password: "secret",
      });
      const catalog = readOpenClawAgentCatalog(sandbox.config.configPath);
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1.2,
        balancePoints: 18,
        status: "active",
      });

      const assignmentA = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: memberA.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const assignmentB = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: memberB.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const memberAWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignmentA.derivedAgentId),
      );
      const memberARuntimeWorkspace = path.join(
        sandbox.config.configDir,
        `workspace-${String(assignmentA.derivedAgentId)}`,
      );
      const memberBWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignmentB.derivedAgentId),
      );
      const memberBRuntimeWorkspace = path.join(
        sandbox.config.configDir,
        `workspace-${String(assignmentB.derivedAgentId)}`,
      );
      expect(fs.existsSync(memberAWorkspace)).toBe(true);
      expect(fs.existsSync(memberARuntimeWorkspace)).toBe(true);
      expect(fs.existsSync(memberBWorkspace)).toBe(true);
      expect(fs.existsSync(memberBRuntimeWorkspace)).toBe(true);
      expect(readConfigAgentIds(sandbox)).toEqual(
        expect.arrayContaining([
          String(assignmentA.derivedAgentId),
          String(assignmentB.derivedAgentId),
        ]),
      );

      const result = revokePlatformTenantAgents(db, {
        tenantId: tenant.id,
        tenantAgentIds: [tenantAgentId],
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      expect(result).toMatchObject({
        revokedTenantAgentCount: 1,
        revokedAssignmentCount: 2,
        affectedMemberCount: 2,
        refundedPoints: 18,
        walletBalance: 18,
        removedWorkspaceCount: 2,
      });
      expect(result.tenantAgentIds).toEqual([tenantAgentId]);
      expect(result.affectedUserIds.toSorted()).toEqual([memberA.id, memberB.id].toSorted());
      expect(readConfigAgentIds(sandbox)).not.toContain(String(assignmentA.derivedAgentId));
      expect(readConfigAgentIds(sandbox)).not.toContain(String(assignmentB.derivedAgentId));

      const wallet = db
        .prepare(
          `SELECT balance_points AS balancePoints
           FROM tenant_wallets
           WHERE tenant_id = ?`,
        )
        .get(tenant.id);
      expect(wallet?.balancePoints).toBeCloseTo(18, 8);

      const refundLedger = db
        .prepare(
          `SELECT category, direction, amount_points AS amountPoints, balance_after AS balanceAfter
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(tenant.id);
      expect(refundLedger).toMatchObject({
        category: "agent_revoke_refund",
        direction: "credit",
        amountPoints: 18,
        balanceAfter: 18,
      });

      expect(listTenantAgents(db, tenant.id, catalog)).toHaveLength(0);
      expect(
        listAssignedAgentsForUser(
          db,
          {
            tenantId: tenant.id,
            userId: memberA.id,
            configPath: sandbox.config.configPath,
            configDir: sandbox.config.configDir,
          },
          catalog,
        ),
      ).toHaveLength(0);
      expect(
        listAssignedAgentsForUser(
          db,
          {
            tenantId: tenant.id,
            userId: memberB.id,
            configPath: sandbox.config.configPath,
            configDir: sandbox.config.configDir,
          },
          catalog,
        ),
      ).toHaveLength(0);
      expect(fs.existsSync(memberAWorkspace)).toBe(false);
      expect(fs.existsSync(memberARuntimeWorkspace)).toBe(false);
      expect(fs.existsSync(memberBWorkspace)).toBe(false);
      expect(fs.existsSync(memberBRuntimeWorkspace)).toBe(false);

      expect(() =>
        assignTenantAgentToUser(db, {
          tenantId: tenant.id,
          userId: memberA.id,
          tenantAgentId,
          configPath: sandbox.config.configPath,
          configDir: sandbox.config.configDir,
        }),
      ).toThrow("tenant_agent_inactive");

      expect(() =>
        syncTenantUsageRecords(db, {
          tenantId: tenant.id,
          userId: memberA.id,
          tenantAgentId,
          openclawSessionKey: "agent:finance:tenant:lambda:user:member-a:chat:latest",
          records: [
            {
              sourceFingerprint: "assistant-1",
              messageTimestamp: "2026-04-13T09:30:00.000Z",
              usageDay: "2026-04-13",
              provider: "openai",
              model: "openai/gpt-5.4",
              inputTokens: 20,
              outputTokens: 8,
              totalTokens: 28,
              totalCost: 0.01,
            },
          ],
        }),
      ).toThrow("tenant_agent_not_found");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("updates tenant member status and password in the database layer", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "theta",
        name: "租户 Theta",
        adminUsername: "theta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });

      const disabled = updateTenantMemberStatus(db, {
        tenantId: tenant.id,
        userId: member.id,
        status: "inactive",
      });
      expect(disabled?.status).toBe("inactive");
      expect(getUserByUsername(db, "member-a")?.status).toBe("inactive");

      const passwordChanged = updateTenantMemberPassword(db, {
        tenantId: tenant.id,
        userId: member.id,
        password: "new-secret",
      });
      expect(passwordChanged?.status).toBe("inactive");
      expect(
        verifyPassword("secret", String(getUserByUsername(db, "member-a")?.password_hash || "")),
      ).toBe(false);
      expect(
        verifyPassword(
          "new-secret",
          String(getUserByUsername(db, "member-a")?.password_hash || ""),
        ),
      ).toBe(true);

      const enabled = updateTenantMemberStatus(db, {
        tenantId: tenant.id,
        userId: member.id,
        status: "active",
      });
      expect(enabled?.status).toBe("active");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("logically deletes tenant members and revokes their active assignments", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "iota",
        name: "租户 Iota",
        adminUsername: "iota-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-delete",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 12,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const sessionKey = "agent:finance:tenant:iota:user:member-delete:chat:latest";
      syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-delete",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            totalCost: 0.15,
          },
        ],
      });
      const derivedAgentId = String(
        db
          .prepare(
            `SELECT derived_agent_id AS derivedAgentId
             FROM user_agent_assignments
             WHERE tenant_id = ? AND user_id = ? AND tenant_agent_id = ?`,
          )
          .get(tenant.id, member.id, tenantAgentId)?.derivedAgentId || "",
      );
      const canonicalWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        derivedAgentId,
      );
      const runtimeWorkspace = path.join(sandbox.config.configDir, `workspace-${derivedAgentId}`);
      expect(fs.existsSync(canonicalWorkspace)).toBe(true);
      expect(fs.existsSync(runtimeWorkspace)).toBe(true);
      expect(readConfigAgentIds(sandbox)).toContain(derivedAgentId);

      const deleted = deleteTenantMember(db, {
        tenantId: tenant.id,
        userId: member.id,
        configDir: sandbox.config.configDir,
        configPath: sandbox.config.configPath,
      });

      expect(deleted).toMatchObject({
        id: member.id,
        username: "member-delete",
        revokedAssignmentCount: 1,
        preservedUsageCount: 1,
        removedWorkspaceCount: 1,
      });
      expect(readConfigAgentIds(sandbox)).not.toContain(derivedAgentId);
      expect(listTenantMembers(db, tenant.id)).toEqual([]);
      expect(getUserByUsername(db, "member-delete")).toBeNull();
      expect(
        db
          .prepare(
            `SELECT id
             FROM tenant_memberships
             WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
          )
          .get(tenant.id, member.id)?.id ?? null,
      ).toBeNull();
      expect(
        db
          .prepare(
            `SELECT id
             FROM user_agent_assignments
             WHERE tenant_id = ? AND user_id = ? AND tenant_agent_id = ?`,
          )
          .get(tenant.id, member.id, tenantAgentId)?.id ?? null,
      ).toBeNull();
      expect(
        listAssignedAgentsForUser(
          db,
          { tenantId: tenant.id, userId: member.id },
          readOpenClawAgentCatalog(sandbox.config.configPath),
        ),
      ).toEqual([]);
      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items[0],
      ).toMatchObject({
        memberId: member.id,
        memberUsername: "member-delete",
        agentId: "finance",
        totalTokens: 150,
        creditsUsed: 0.15,
      });
      expect(getTenantOverview(db, { tenantId: tenant.id }).topMembers[0]).toMatchObject({
        username: "member-delete",
        tokens: 150,
      });
      expect(fs.existsSync(canonicalWorkspace)).toBe(false);
      expect(fs.existsSync(runtimeWorkspace)).toBe(false);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("revokes tenant member assignments and removes the derived workspaces", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "mu",
        name: "租户 Mu",
        adminUsername: "mu-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-revoke",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });

      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const canonicalWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        String(assignment.derivedAgentId),
      );
      const runtimeWorkspace = path.join(
        sandbox.config.configDir,
        `workspace-${String(assignment.derivedAgentId)}`,
      );
      expect(fs.existsSync(canonicalWorkspace)).toBe(true);
      expect(fs.existsSync(runtimeWorkspace)).toBe(true);

      const result = revokeTenantAgentAssignments(db, {
        tenantId: tenant.id,
        userId: member.id,
        assignmentIds: [String(assignment.assignmentId || "")],
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      expect(result).toMatchObject({
        revokedAssignmentCount: 1,
        affectedUserIds: [member.id],
        affectedMemberCount: 1,
        removedWorkspaceCount: 1,
      });
      expect(fs.existsSync(canonicalWorkspace)).toBe(false);
      expect(fs.existsSync(runtimeWorkspace)).toBe(false);
      expect(
        listAssignedAgentsForUser(
          db,
          {
            tenantId: tenant.id,
            userId: member.id,
            configPath: sandbox.config.configPath,
            configDir: sandbox.config.configDir,
          },
          readOpenClawAgentCatalog(sandbox.config.configPath),
        ),
      ).toEqual([]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("creates a new member record when the same username is recreated after deletion", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "kappa",
        name: "租户 Kappa",
        adminUsername: "kappa-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-recreate",
        password: "secret",
      });

      deleteTenantMember(db, {
        tenantId: tenant.id,
        userId: member.id,
        configDir: sandbox.config.configDir,
        configPath: sandbox.config.configPath,
      });

      const recreated = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-recreate",
        password: "renew-secret",
      });

      const userRecord = getUserByUsername(db, "member-recreate");
      const oldMembership = db
        .prepare(
          `SELECT id
           FROM tenant_memberships
           WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
        )
        .get(tenant.id, member.id);
      const newMembership = db
        .prepare(
          `SELECT status
           FROM tenant_memberships
           WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
        )
        .get(tenant.id, recreated.id);

      expect(recreated?.id).not.toBe(member.id);
      expect(userRecord?.status).toBe("active");
      expect(userRecord?.id).toBe(recreated?.id);
      expect(verifyPassword("secret", String(userRecord?.password_hash || ""))).toBe(false);
      expect(verifyPassword("renew-secret", String(userRecord?.password_hash || ""))).toBe(true);
      expect(oldMembership?.id ?? null).toBeNull();
      expect(newMembership?.status).toBe("active");
      expect(listTenantMembers(db, tenant.id)).toEqual([
        expect.objectContaining({
          id: recreated.id,
          username: "member-recreate",
          status: "active",
        }),
      ]);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("deducts agent points from synced usage records without double-charging repeats", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "delta",
        name: "租户 Delta",
        adminUsername: "delta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:delta:user:member-a:chat:latest";
      const firstSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 0.12,
          },
        ],
      });
      expect(firstSync.inserted).toBe(1);
      expect(firstSync.billingEnabled).toBe(true);
      expect(firstSync.pointsDelta).toBeCloseTo(0.12, 8);
      expect(firstSync.agentBalancePoints).toBeCloseTo(9.88, 8);

      const repeatedSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 0.12,
          },
        ],
      });
      expect(repeatedSync.updated).toBe(1);
      expect(repeatedSync.pointsDelta).toBe(0);
      expect(repeatedSync.agentBalancePoints).toBeCloseTo(9.88, 8);

      const adjustedSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 0.2,
          },
        ],
      });
      expect(adjustedSync.updated).toBe(1);
      expect(adjustedSync.pointsDelta).toBeCloseTo(0.08, 8);
      expect(adjustedSync.agentBalancePoints).toBeCloseTo(9.8, 8);

      const assignedAgents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents[0]?.balancePoints).toBeCloseTo(9.8, 8);
      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items[0],
      ).toMatchObject({
        creditsUsed: 0.2,
        totalTokens: 165,
        total_tokens: 165,
        tokens: 165,
        inputTokens: 120,
        input_tokens: 120,
        outputTokens: 45,
        output_tokens: 45,
        memberUsername: member.username,
        agentId: "finance",
      });

      const ledgerRows = db
        .prepare(
          `SELECT category, amount_points AS amountPoints, balance_after AS balanceAfter, note
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]).toMatchObject({
        category: "usage_charge",
        amountPoints: 0.2,
        balanceAfter: 9.8,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain(sessionKey);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.walletBalance).toBe(0);
      expect(overview?.summary.consumedCredits).toBeCloseTo(0.2, 8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("prefers local static provider pricing over incoming per-record totalCost", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "epsilon-static",
        name: "租户 Epsilon Static",
        adminUsername: "epsilon-static-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-static",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:epsilon-static:user:member-static:chat:latest";
      const syncResult = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "cleannetworkspace",
            model: "gpt-5.4",
            inputTokens: 120,
            outputTokens: 45,
            totalTokens: 165,
            totalCost: 3,
          },
        ],
      });
      expect(syncResult.inserted).toBe(1);
      expect(syncResult.pointsDelta).toBeCloseTo(0.006825, 8);
      expect(syncResult.agentBalancePoints).toBeCloseTo(9.993175, 8);

      const usageRow = db
        .prepare(
          `SELECT total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           LIMIT 1`,
        )
        .get(tenant.id);
      expect(usageRow?.totalCost).toBeCloseTo(0.006825, 8);

      const ledgerRow = db
        .prepare(
          `SELECT amount_points AS amountPoints, balance_after AS balanceAfter
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           LIMIT 1`,
        )
        .get(tenant.id);
      expect(ledgerRow?.amountPoints).toBeCloseTo(0.006825, 8);
      expect(ledgerRow?.balanceAfter).toBeCloseTo(9.993175, 8);

      expect(getTenantOverview(db, { tenantId: tenant.id }).summary.consumedCredits).toBeCloseTo(
        0.006825,
        8,
      );
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("falls back to session estimatedCostUsd when synced usage records omit per-record cost", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "zeta",
        name: "租户 Zeta",
        adminUsername: "zeta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:zeta:user:member-a:chat:latest";
      writeSessionStoreEntry(sandbox, String(assignment.derivedAgentId || "finance"), sessionKey, {
        sessionId: "sess-zeta",
        estimatedCostUsd: 0.2,
        updatedAt: "2026-04-13T10:00:00.000Z",
      });

      const syncResult = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 90,
            outputTokens: 60,
            totalTokens: 150,
          },
          {
            sourceFingerprint: "assistant-2",
            messageTimestamp: "2026-04-13T09:35:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 30,
            outputTokens: 20,
            totalTokens: 50,
          },
        ],
      });
      expect(syncResult.inserted).toBe(2);
      expect(syncResult.pointsDelta).toBeCloseTo(1.4, 8);
      expect(syncResult.agentBalancePoints).toBeCloseTo(8.6, 8);

      const usageRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint, total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY message_timestamp ASC`,
        )
        .all(tenant.id);
      expect(usageRows).toEqual([
        expect.objectContaining({
          sourceFingerprint: "assistant-1",
          totalCost: 1.05,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.35,
        }),
      ]);

      const ledgerRows = db
        .prepare(
          `SELECT amount_points AS amountPoints, balance_after AS balanceAfter, note
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(2);
      expect(ledgerRows[0]).toMatchObject({
        amountPoints: 1.05,
        balanceAfter: 8.95,
      });
      expect(ledgerRows[1]).toMatchObject({
        amountPoints: 0.35,
        balanceAfter: 8.6,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain(sessionKey);
      expect(String(ledgerRows[1]?.note || "")).toContain(sessionKey);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.consumedCredits).toBeCloseTo(1.4, 8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("estimates zero-priced ollama usage from tokens during sync", () => {
    const sandbox = createTempSandbox();
    fs.writeFileSync(
      sandbox.config.configPath,
      JSON.stringify({
        agents: {
          list: [
            {
              id: "finance",
              name: "财务分析助手",
            },
          ],
        },
        models: {
          mode: "merge",
          providers: {
            ollama: {
              api: "ollama",
              models: [
                {
                  id: "qwen3.6:latest",
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
              ],
            },
          },
        },
      }),
      "utf8",
    );
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "theta",
        name: "租户 Theta",
        adminUsername: "theta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-ollama",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:theta:user:member-ollama:chat:latest";
      writeSessionStoreEntry(sandbox, String(assignment.derivedAgentId || "finance"), sessionKey, {
        sessionId: "sess-theta",
        estimatedCostUsd: 0,
        modelProvider: "ollama",
        model: "qwen3.6:latest",
        updatedAt: "2026-04-13T10:00:00.000Z",
      });

      const syncResult = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
        records: [
          {
            sourceFingerprint: "assistant-1",
            messageTimestamp: "2026-04-13T09:30:00.000Z",
            usageDay: "2026-04-13",
            provider: "ollama",
            model: "qwen3.6:latest",
            inputTokens: 80_000,
            outputTokens: 4_000,
            totalTokens: 84_000,
          },
          {
            sourceFingerprint: "assistant-2",
            messageTimestamp: "2026-04-13T09:35:00.000Z",
            usageDay: "2026-04-13",
            provider: "ollama",
            model: "qwen3.6:latest",
            inputTokens: 40_000,
            outputTokens: 2_000,
            totalTokens: 42_000,
          },
        ],
      });
      expect(syncResult.inserted).toBe(2);
      expect(syncResult.pointsDelta).toBeCloseTo(0.0432, 8);
      expect(syncResult.agentBalancePoints).toBeCloseTo(9.9568, 8);

      const usageRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint, total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY message_timestamp ASC`,
        )
        .all(tenant.id);
      expect(usageRows).toEqual([
        expect.objectContaining({
          sourceFingerprint: "assistant-1",
          totalCost: 0.0288,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.0144,
        }),
      ]);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.consumedCredits).toBeCloseTo(0.0432, 8);
      const usageList = listTenantUsageRecords(db, { tenantId: tenant.id, page: 1, pageSize: 8 });
      expect(usageList.items[0]?.creditsUsed).toBeGreaterThan(0);
      expect(usageList.items[1]?.creditsUsed).toBeGreaterThan(0);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("repairs historical usage rows when session estimatedCostUsd becomes available later", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "eta",
        name: "租户 Eta",
        adminUsername: "eta-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      const assignment = assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:eta:user:member-a:chat:latest";
      db.prepare(
        `INSERT INTO tenant_usage_records (
           id,
           tenant_id,
           user_id,
           member_user_id,
           member_username,
           tenant_agent_id,
           openclaw_session_key,
           source_fingerprint,
           message_timestamp,
           usage_day,
           provider,
           model,
           input_tokens,
           output_tokens,
           cache_read_tokens,
           cache_write_tokens,
           total_tokens,
           total_cost,
           created_at,
           updated_at
         ) VALUES (
           @id,
           @tenantId,
           @userId,
           @memberUserId,
           @memberUsername,
           @tenantAgentId,
           @openclawSessionKey,
           @sourceFingerprint,
           @messageTimestamp,
           @usageDay,
           @provider,
           @model,
           @inputTokens,
           @outputTokens,
           @cacheReadTokens,
           @cacheWriteTokens,
           @totalTokens,
           @totalCost,
           @createdAt,
           @updatedAt
         )`,
      ).run({
        id: "usage-eta-1",
        tenantId: tenant.id,
        userId: member.id,
        memberUserId: member.id,
        memberUsername: member.username,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        sourceFingerprint: "assistant-1",
        messageTimestamp: "2026-04-13T09:30:00.000Z",
        usageDay: "2026-04-13",
        provider: "cleannetworkspace",
        model: "gpt-5.4",
        inputTokens: 80,
        outputTokens: 40,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 120,
        totalCost: null,
        createdAt: "2026-04-13T09:30:00.000Z",
        updatedAt: "2026-04-13T09:30:00.000Z",
      });
      db.prepare(
        `INSERT INTO tenant_usage_records (
           id,
           tenant_id,
           user_id,
           member_user_id,
           member_username,
           tenant_agent_id,
           openclaw_session_key,
           source_fingerprint,
           message_timestamp,
           usage_day,
           provider,
           model,
           input_tokens,
           output_tokens,
           cache_read_tokens,
           cache_write_tokens,
           total_tokens,
           total_cost,
           created_at,
           updated_at
         ) VALUES (
           @id,
           @tenantId,
           @userId,
           @memberUserId,
           @memberUsername,
           @tenantAgentId,
           @openclawSessionKey,
           @sourceFingerprint,
           @messageTimestamp,
           @usageDay,
           @provider,
           @model,
           @inputTokens,
           @outputTokens,
           @cacheReadTokens,
           @cacheWriteTokens,
           @totalTokens,
           @totalCost,
           @createdAt,
           @updatedAt
         )`,
      ).run({
        id: "usage-eta-2",
        tenantId: tenant.id,
        userId: member.id,
        memberUserId: member.id,
        memberUsername: member.username,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        sourceFingerprint: "assistant-2",
        messageTimestamp: "2026-04-13T09:35:00.000Z",
        usageDay: "2026-04-13",
        provider: "cleannetworkspace",
        model: "gpt-5.4",
        inputTokens: 40,
        outputTokens: 20,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 60,
        totalCost: null,
        createdAt: "2026-04-13T09:35:00.000Z",
        updatedAt: "2026-04-13T09:35:00.000Z",
      });
      expect(
        db
          .prepare(
            `SELECT COUNT(*) AS count
             FROM tenant_wallet_ledger
             WHERE tenant_id = ? AND category = 'usage_charge'`,
          )
          .get(tenant.id)?.count,
      ).toBe(0);

      writeSessionStoreEntry(sandbox, String(assignment.derivedAgentId || "finance"), sessionKey, {
        sessionId: "sess-eta",
        estimatedCostUsd: 0,
        modelProvider: "cleannetworkspace",
        model: "gpt-5.4",
        inputTokens: 48000,
        outputTokens: 4000,
        cacheRead: 0,
        cacheWrite: 0,
        updatedAt: "2026-04-13T10:10:00.000Z",
      });

      const repairResult = repairTenantUsageCostGaps(db, {
        tenantId: tenant.id,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      expect(repairResult).toMatchObject({
        scannedSessions: 1,
        repairedSessions: 1,
        repairedRows: 2,
      });

      const repairedRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint, total_cost AS totalCost
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY message_timestamp ASC`,
        )
        .all(tenant.id);
      expect(repairedRows).toEqual([
        expect.objectContaining({
          sourceFingerprint: "assistant-1",
          totalCost: 0.0056,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.0028,
        }),
      ]);

      const ledgerRows = db
        .prepare(
          `SELECT amount_points AS amountPoints, balance_after AS balanceAfter
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(2);
      expect(ledgerRows[0]).toMatchObject({
        amountPoints: 0.0056,
        balanceAfter: 9.9944,
      });
      expect(ledgerRows[1]).toMatchObject({
        amountPoints: 0.0028,
        balanceAfter: 9.9916,
      });

      const assignedAgents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents[0]?.balancePoints).toBeCloseTo(9.9916, 8);
      expect(getTenantOverview(db, { tenantId: tenant.id }).summary.consumedCredits).toBeCloseTo(
        0.0084,
        8,
      );
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("repairs legacy zero-token usage records in place when corrected usage arrives", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "epsilon",
        name: "租户 Epsilon",
        adminUsername: "epsilon-admin",
        adminPassword: "secret",
        memberLimit: 3,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });

      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "member-a",
        password: "secret",
      });
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 10,
        status: "active",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const sessionKey = "agent:finance:tenant:epsilon:user:member-a:chat:latest";
      const baseRecord = {
        messageTimestamp: "2026-04-13T09:30:00.000Z",
        usageDay: "2026-04-13",
        provider: "openai",
        model: "openai/gpt-5.4",
        totalTokens: 165,
        totalCost: 0.12,
      };

      const firstSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "legacy-zero",
            inputTokens: 0,
            outputTokens: 0,
            ...baseRecord,
          },
        ],
      });
      expect(firstSync.inserted).toBe(1);
      expect(firstSync.updated).toBe(0);

      const repairedSync = syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: sessionKey,
        records: [
          {
            sourceFingerprint: "legacy-correct",
            inputTokens: 120,
            outputTokens: 45,
            ...baseRecord,
          },
        ],
      });
      expect(repairedSync.inserted).toBe(0);
      expect(repairedSync.updated).toBe(1);
      expect(repairedSync.pointsDelta).toBe(0);
      expect(repairedSync.agentBalancePoints).toBeCloseTo(9.88, 8);

      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items,
      ).toHaveLength(1);
      expect(
        listTenantUsageRecords(db, {
          tenantId: tenant.id,
          page: 1,
          pageSize: 8,
          search: "",
        }).items[0],
      ).toMatchObject({
        creditsUsed: 0.12,
        totalTokens: 165,
        inputTokens: 120,
        outputTokens: 45,
        memberUsername: member.username,
        agentId: "finance",
      });

      const usageRows = db
        .prepare(
          `SELECT source_fingerprint AS sourceFingerprint,
                  input_tokens AS inputTokens,
                  output_tokens AS outputTokens
           FROM tenant_usage_records
           WHERE tenant_id = ?
           ORDER BY created_at DESC`,
        )
        .all(tenant.id);
      expect(usageRows).toHaveLength(1);
      expect(usageRows[0]).toMatchObject({
        sourceFingerprint: "legacy-correct",
        inputTokens: 120,
        outputTokens: 45,
      });

      const ledgerRows = db
        .prepare(
          `SELECT category, amount_points AS amountPoints, balance_after AS balanceAfter, note
           FROM tenant_wallet_ledger
           WHERE tenant_id = ?
           ORDER BY created_at ASC`,
        )
        .all(tenant.id);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]).toMatchObject({
        category: "usage_charge",
        amountPoints: 0.12,
        balanceAfter: 9.88,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain("legacy-correct");
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("creates tenant payment orders and confirms recharge into wallet idempotently", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "tenant-wallet-order",
        name: "租户 Wallet Order",
        adminUsername: "wallet-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const adminUser = getUserByUsername(db, "wallet-admin");
      if (!adminUser) {
        throw new Error("Expected tenant admin to exist");
      }

      const created = createTenantPaymentOrder(db, {
        tenantId: tenant.id,
        createdByUserId: adminUser.id,
        amountCny: 88.5,
        channel: "allinpay_h5_auto",
      });
      expect(created).toMatchObject({
        tenantId: tenant.id,
        amountCny: 88.5,
        amountPoints: 88.5,
        status: "pending_payment",
        channel: "allinpay_h5_auto",
      });
      expect(getTenantOverview(db, { tenantId: tenant.id }).summary.pendingPaymentOrderCount).toBe(
        1,
      );

      const processing = updateTenantPaymentOrderStatus(db, {
        tenantId: tenant.id,
        orderId: created.id,
        status: "processing",
        providerOrderId: "trx-processing-1",
        providerPayload: {
          latestProviderStatus: "2008",
        },
      });
      expect(processing?.status).toBe("processing");

      const confirmed = confirmTenantPaymentOrderPaid(db, {
        tenantId: tenant.id,
        orderId: created.id,
        providerOrderId: "trx-success-1",
        providerPayload: {
          latestProviderStatus: "0000",
        },
      });
      expect(confirmed.credited).toBe(true);
      expect(confirmed.alreadyPaid).toBe(false);
      expect(confirmed.walletBalance).toBeCloseTo(88.5, 8);
      expect(
        getTenantPaymentOrderById(db, { tenantId: tenant.id, orderId: created.id })?.status,
      ).toBe("paid");

      const secondConfirm = confirmTenantPaymentOrderPaid(db, {
        tenantId: tenant.id,
        orderId: created.id,
        providerOrderId: "trx-success-1",
      });
      expect(secondConfirm.credited).toBe(false);
      expect(secondConfirm.alreadyPaid).toBe(true);

      const dashboard = getTenantWalletDashboard(db, { tenantId: tenant.id });
      expect(dashboard.summary.walletBalance).toBeCloseTo(88.5, 8);
      expect(dashboard.summary.totalRecharged).toBeCloseTo(88.5, 8);
      expect(dashboard.summary.pendingOrderCount).toBe(0);
      expect(dashboard.orders[0]).toMatchObject({
        id: created.id,
        status: "paid",
        providerOrderId: "trx-success-1",
      });
      expect(dashboard.ledger[0]).toMatchObject({
        category: "recharge",
        direction: "credit",
        amountPoints: 88.5,
        balanceAfter: 88.5,
        paymentOrderId: created.id,
      });
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("renders payment launch QR codes as inline SVG data URLs", () => {
    const dataUrl = buildQrSvgDataUrl(
      "https://example.com/tenant-platform-api/v1/tenant/admin/payment-orders/launch?token=abc123",
    );
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(dataUrl.split(",")[1] || "")).toContain("<svg");
    expect(decodeURIComponent(dataUrl.split(",")[1] || "")).toContain("支付二维码");
  });

  it("lists tenant payment orders with paging and search", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "tenant-wallet-order-list",
        name: "租户 Wallet Order List",
        adminUsername: "wallet-order-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const adminUser = getUserByUsername(db, "wallet-order-admin");
      if (!adminUser) {
        throw new Error("Expected tenant admin to exist");
      }

      const firstOrder = createTenantPaymentOrder(db, {
        tenantId: tenant.id,
        createdByUserId: adminUser.id,
        amountCny: 18,
        channel: "allinpay_h5_auto",
      });
      const secondOrder = createTenantPaymentOrder(db, {
        tenantId: tenant.id,
        createdByUserId: adminUser.id,
        amountCny: 28,
        channel: "allinpay_h5_auto",
      });
      updateTenantPaymentOrderStatus(db, {
        tenantId: tenant.id,
        orderId: secondOrder.id,
        status: "processing",
        providerOrderId: "trx-search-2",
      });

      const paged = listTenantPaymentOrdersPage(db, {
        tenantId: tenant.id,
        page: 1,
        pageSize: 1,
        search: "trx-search-2",
      });
      expect(paged).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 1,
      });
      expect(paged.items).toHaveLength(1);
      expect(paged.items[0]).toMatchObject({
        id: secondOrder.id,
        status: "processing",
        providerOrderId: "trx-search-2",
      });

      const statusSearch = listTenantPaymentOrdersPage(db, {
        tenantId: tenant.id,
        page: 1,
        pageSize: 10,
        search: "pending_payment",
      });
      expect(statusSearch.total).toBe(1);
      expect(statusSearch.items[0]?.id).toBe(firstOrder.id);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("uses the official allinpay endpoints and signtype field", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });
    const config = resolveAllinpaySidecarConfig(
      {
        OPENCLAW_TENANT_PLATFORM_PUBLIC_BASE_URL: "https://example.com",
        OPENCLAW_TENANT_PAYMENT_ALLINPAY_APP_ID: "app-demo",
        OPENCLAW_TENANT_PAYMENT_ALLINPAY_MERCHANT_ID: "merchant-demo",
        OPENCLAW_TENANT_PAYMENT_ALLINPAY_PRIVATE_KEY: privateKey,
        OPENCLAW_TENANT_PAYMENT_ALLINPAY_PUBLIC_KEY: publicKey,
      },
      {
        apiBasePath: "/tenant-platform-api/v1",
        publicBaseUrl: "https://example.com",
      },
    );

    expect(config.orderUrl).toBe("https://syb.allinpay.com/apiweb/h5unionpay/unionorder");
    expect(config.queryUrl).toBe("https://vsp.allinpay.com/apiweb/tranx/query");
    expect(config.returnUrl).toBe(
      "https://example.com/tenant-platform-api/v1/public/payment/allinpay/return",
    );
    expect(config.notifyUrl).toBe(
      "https://example.com/tenant-platform-api/v1/public/payment/allinpay/notify",
    );

    const descriptor = buildAllinpayLaunchDescriptor(
      {
        id: "payment_demo",
        amountCny: 1,
      },
      config,
    );
    expect(descriptor.fields.signtype).toBe("RSA");
    expect("sign_type" in descriptor.fields).toBe(false);
  });

  it("transfers wallet points to tenant agents and records budget ledger", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "tenant-wallet-transfer",
        name: "租户 Wallet Transfer",
        adminUsername: "wallet-transfer-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const adminUser = getUserByUsername(db, "wallet-transfer-admin");
      if (!adminUser) {
        throw new Error("Expected tenant admin to exist");
      }
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 0,
        status: "active",
      });

      const order = createTenantPaymentOrder(db, {
        tenantId: tenant.id,
        createdByUserId: adminUser.id,
        amountCny: 100,
        channel: "allinpay_h5_auto",
      });
      confirmTenantPaymentOrderPaid(db, {
        tenantId: tenant.id,
        orderId: order.id,
        providerOrderId: "trx-fund-transfer",
      });

      const transfer = transferTenantWalletToAgent(db, {
        tenantId: tenant.id,
        tenantAgentId,
        actorUserId: adminUser.id,
        amountPoints: 35.25,
        note: "首批预算",
      });
      expect(transfer).toMatchObject({
        tenantAgentId,
        walletBalance: 64.75,
        agentBalance: 35.25,
        amountPoints: 35.25,
      });

      const tenantAgents = listTenantAgents(
        db,
        tenant.id,
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(tenantAgents[0]?.balancePoints).toBeCloseTo(35.25, 8);

      const dashboard = getTenantWalletDashboard(
        db,
        { tenantId: tenant.id },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(dashboard.summary.walletBalance).toBeCloseTo(64.75, 8);
      expect(dashboard.summary.totalRecharged).toBeCloseTo(100, 8);
      expect(dashboard.summary.totalTransferred).toBeCloseTo(35.25, 8);
      expect(dashboard.ledger.find((entry) => entry.category === "agent_transfer")).toMatchObject({
        direction: "debit",
        amountPoints: 35.25,
        balanceAfter: 64.75,
        tenantAgentId,
        tenantAgentName: "财务分析助手",
      });

      const budgetRows = db
        .prepare(
          `SELECT amount_points AS amountPoints
           FROM tenant_agent_budgets
           WHERE tenant_id = ? AND tenant_agent_id = ?`,
        )
        .all(tenant.id, tenantAgentId);
      expect(budgetRows).toHaveLength(1);
      expect(budgetRows[0]?.amountPoints).toBeCloseTo(35.25, 8);
    } finally {
      closeTenantPlatformDb(db);
    }
  });

  it("lists model usage and wallet flow entries with paging and search", () => {
    const sandbox = createTempSandbox();
    const db = openTenantPlatformDb(sandbox.config);
    try {
      createBootstrapPlatformAdmin(db, {
        username: "platform-root",
        password: "secret",
      });

      const tenant = createTenantWithAdmin(db, {
        code: "tenant-wallet-ledger-list",
        name: "租户 Wallet Ledger List",
        adminUsername: "wallet-ledger-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
        licenseExpiresAt: null,
        renewalCode: null,
      });
      const adminUser = getUserByUsername(db, "wallet-ledger-admin");
      if (!adminUser) {
        throw new Error("Expected tenant admin to exist");
      }
      const tenantAgentId = upsertTenantAgent(db, {
        tenantId: tenant.id,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1,
        balancePoints: 0,
        status: "active",
      });
      const member = createTenantMember(db, {
        tenantId: tenant.id,
        username: "wallet-ledger-member",
        password: "secret",
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const order = createTenantPaymentOrder(db, {
        tenantId: tenant.id,
        createdByUserId: adminUser.id,
        amountCny: 100,
        channel: "allinpay_h5_auto",
      });
      confirmTenantPaymentOrderPaid(db, {
        tenantId: tenant.id,
        orderId: order.id,
        providerOrderId: "trx-ledger-list",
      });
      transferTenantWalletToAgent(db, {
        tenantId: tenant.id,
        tenantAgentId,
        actorUserId: adminUser.id,
        amountPoints: 35.25,
        note: "首批预算",
      });
      syncTenantUsageRecords(db, {
        tenantId: tenant.id,
        userId: member.id,
        tenantAgentId,
        openclawSessionKey: "agent:finance:tenant:wallet-ledger-member:chat:ledger",
        records: [
          {
            sourceFingerprint: "usage-flow-1",
            messageTimestamp: "2026-04-16T08:30:00.000Z",
            usageDay: "2026-04-16",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 1000,
            outputTokens: 400,
            totalTokens: 1400,
            totalCost: 0.12,
          },
        ],
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      const configAgents = readOpenClawAgentCatalog(sandbox.config.configPath);

      const paged = listTenantWalletLedgerEntriesPage(
        db,
        {
          tenantId: tenant.id,
          page: 1,
          pageSize: 1,
          search: "首批预算",
        },
        configAgents,
      );
      expect(paged).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 1,
      });
      expect(paged.items).toHaveLength(1);
      expect(paged.items[0]).toMatchObject({
        category: "agent_transfer",
        paymentOrderId: "",
        note: "首批预算",
        tenantAgentName: "财务分析助手",
      });

      const modelUsage = listTenantModelUsageEntriesPage(
        db,
        {
          tenantId: tenant.id,
          page: 1,
          pageSize: 10,
          search: "usage-flow-1",
        },
        configAgents,
      );
      expect(modelUsage.total).toBe(1);
      expect(modelUsage.items[0]).toMatchObject({
        category: "usage_charge",
        tenantAgentName: "财务分析助手",
      });

      const walletFlow = listTenantWalletFlowEntriesPage(
        db,
        {
          tenantId: tenant.id,
          page: 1,
          pageSize: 10,
          search: order.id,
        },
        configAgents,
      );
      expect(walletFlow.total).toBe(1);
      expect(walletFlow.items[0]?.paymentOrderId).toBe(order.id);

      const orderSearch = listTenantWalletLedgerEntriesPage(
        db,
        {
          tenantId: tenant.id,
          page: 1,
          pageSize: 10,
          search: order.id,
        },
        configAgents,
      );
      expect(orderSearch.total).toBe(1);
      expect(orderSearch.items[0]?.paymentOrderId).toBe(order.id);
    } finally {
      closeTenantPlatformDb(db);
    }
  });
});

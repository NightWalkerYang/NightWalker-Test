import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openTenantPlatformDb,
  closeTenantPlatformDb,
  createPlatformUpdateLog,
  createBootstrapPlatformAdmin,
  deleteTenantMember,
  deletePlatformUpdateLog,
  createTenantWithAdmin,
  createTenantMember,
  getUserByUsername,
  listPlatformUpdateLogs,
  listTenantAgents,
  listTenantMembers,
  readOpenClawAgentCatalog,
  repairTenantUsageCostGaps,
  upsertTenantAgent,
  assignTenantAgentToUser,
  revokePlatformTenantAgents,
  listAssignedAgentsForUser,
  listAssignedAgentVisualizationsForUser,
  getTenantOverview,
  listTenantUsageRecords,
  syncTenantUsageRecords,
  updatePlatformUpdateLog,
  updateTenantMemberLimit,
  updateTenantMemberPassword,
  updateTenantMemberStatus,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
import {
  buildDashboardManifestHtml,
  rewriteVisualizationHtml,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs";
import { verifyPassword } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/auth.mjs";

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
      const baseWorkspace = path.join(
        sandbox.config.configDir,
        "workspace-agents",
        "finance",
      );
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
        "{\"type\":\"assistant\"}\n",
        "utf8",
      );

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
          path.join(sandbox.config.configDir, "workspace-agents", String(assignment.derivedAgentId)),
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
      expect(fs.existsSync(path.join(derivedWorkspace, "sessions", "old.jsonl"))).toBe(false);

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
      fs.mkdirSync(visualizationDir, { recursive: true });
      fs.writeFileSync(path.join(visualizationDir, "销售数据可视化_index.html"), "<html></html>");
      fs.writeFileSync(path.join(visualizationDir, "折线图_index.html"), "<html></html>");
      fs.writeFileSync(
        path.join(visualizationDir, "财务驾驶舱_index.dashboard.json"),
        JSON.stringify({
          version: 1,
          title: "财务驾驶舱",
        }),
        "utf8",
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
        "折线图",
        "财务驾驶舱",
        "销售数据可视化",
      ]);
      expect(
        visualizations.every((item) => item.agentName === "财务分析助手"),
      ).toBe(true);
      expect(
        visualizations.find((item) => item.visualizationFileName === "财务驾驶舱_index.dashboard.json")
          ?.visualizationType,
      ).toBe("dashboard_manifest");
      expect(
        visualizations
          .filter((item) => item.visualizationType === "html")
          .every((item) => item.visualizationFileName.endsWith("_index.html")),
      ).toBe(true);
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
      expect(
        derivedBucket.allowlist.map((entry) => entry.pattern).toSorted(),
      ).toEqual(["/usr/bin/cat", "/usr/bin/head", "=command:shared"].toSorted());
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

  it("builds dashboard manifest wrappers that only depend on zero-intrusive runtime assets", () => {
    const html = buildDashboardManifestHtml(
      {
        version: 1,
        template: "financial-command-center-v1",
        title: "财务总览驾驶舱",
        dataSource: "data/dashboard.json",
        metrics: [{ label: "总资产", value: "128.6", unit: "亿元" }],
      },
      {
        visualizationName: "财务总览驾驶舱",
        visualizationFileName: "财务总览驾驶舱_index.dashboard.json",
        workspaceBaseHref: "/workspace-agent-downloads/tenant-agent-1/Echarts/",
        visualizationHref:
          "/workspace-agent-downloads/tenant-agent-1/Echarts/%E8%B4%A2%E5%8A%A1%E6%80%BB%E8%A7%88%E9%A9%BE%E9%A9%B6%E8%88%B1_index.dashboard.json",
        agentName: "财务分析助手",
        agentId: "tenant-agent-1",
        navigationHrefs: {
          "资金驾驶舱_index.dashboard.json": "/echarts-view/?token=next-token",
        },
      },
    );

    expect(html).toContain('/assets/runtime/dashboard-manifest/styles.css');
    expect(html).toContain('/assets/runtime/dashboard-manifest/bootstrap.js');
    expect(html).toContain('type="application/json"');
    expect(html).toContain('"visualizationType":"dashboard_manifest"');
    expect(html).toContain('"workspaceBaseHref":"/workspace-agent-downloads/tenant-agent-1/Echarts/"');
    expect(html).toContain('"dataSource":"data/dashboard.json"');
    expect(html).not.toContain("<script>");
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

      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: memberA.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });
      assignTenantAgentToUser(db, {
        tenantId: tenant.id,
        userId: memberB.id,
        tenantAgentId,
        configPath: sandbox.config.configPath,
        configDir: sandbox.config.configDir,
      });

      const result = revokePlatformTenantAgents(db, {
        tenantId: tenant.id,
        tenantAgentIds: [tenantAgentId],
      });
      expect(result).toMatchObject({
        revokedTenantAgentCount: 1,
        revokedAssignmentCount: 2,
        affectedMemberCount: 2,
      });
      expect(result.tenantAgentIds).toEqual([tenantAgentId]);
      expect(result.affectedUserIds.toSorted()).toEqual([memberA.id, memberB.id].toSorted());

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
        verifyPassword("new-secret", String(getUserByUsername(db, "member-a")?.password_hash || "")),
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
      const runtimeWorkspace = path.join(
        sandbox.config.configDir,
        `workspace-${derivedAgentId}`,
      );
      expect(fs.existsSync(canonicalWorkspace)).toBe(true);
      expect(fs.existsSync(runtimeWorkspace)).toBe(true);

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
      expect(syncResult.pointsDelta).toBeCloseTo(0.2, 8);
      expect(syncResult.agentBalancePoints).toBeCloseTo(9.8, 8);

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
          totalCost: 0.15,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.05,
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
        amountPoints: 0.15,
        balanceAfter: 9.85,
      });
      expect(ledgerRows[1]).toMatchObject({
        amountPoints: 0.05,
        balanceAfter: 9.8,
      });
      expect(String(ledgerRows[0]?.note || "")).toContain(sessionKey);
      expect(String(ledgerRows[1]?.note || "")).toContain(sessionKey);

      const overview = getTenantOverview(db, { tenantId: tenant.id });
      expect(overview?.summary.consumedCredits).toBeCloseTo(0.2, 8);
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
      const brokenSync = syncTenantUsageRecords(db, {
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
            inputTokens: 80,
            outputTokens: 40,
            totalTokens: 120,
          },
          {
            sourceFingerprint: "assistant-2",
            messageTimestamp: "2026-04-13T09:35:00.000Z",
            usageDay: "2026-04-13",
            provider: "openai",
            model: "openai/gpt-5.4",
            inputTokens: 40,
            outputTokens: 20,
            totalTokens: 60,
          },
        ],
      });
      expect(brokenSync.pointsDelta).toBe(0);
      expect(brokenSync.agentBalancePoints).toBeCloseTo(10, 8);
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
          totalCost: 0.12,
        }),
        expect.objectContaining({
          sourceFingerprint: "assistant-2",
          totalCost: 0.06,
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
        amountPoints: 0.12,
        balanceAfter: 9.88,
      });
      expect(ledgerRows[1]).toMatchObject({
        amountPoints: 0.06,
        balanceAfter: 9.82,
      });

      const assignedAgents = listAssignedAgentsForUser(
        db,
        { tenantId: tenant.id, userId: member.id },
        readOpenClawAgentCatalog(sandbox.config.configPath),
      );
      expect(assignedAgents[0]?.balancePoints).toBeCloseTo(9.82, 8);
      expect(getTenantOverview(db, { tenantId: tenant.id }).summary.consumedCredits).toBeCloseTo(
        0.18,
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
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openTenantPlatformDb,
  closeTenantPlatformDb,
  createBootstrapPlatformAdmin,
  deleteTenantMember,
  createTenantWithAdmin,
  createTenantMember,
  getUserByUsername,
  listTenantAgents,
  listTenantMembers,
  readOpenClawAgentCatalog,
  upsertTenantAgent,
  assignTenantAgentToUser,
  revokePlatformTenantAgents,
  listAssignedAgentsForUser,
  listAssignedAgentVisualizationsForUser,
  getTenantOverview,
  listTenantUsageRecords,
  syncTenantUsageRecords,
  updateTenantMemberLimit,
  updateTenantMemberPassword,
  updateTenantMemberStatus,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
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
      expect(visualizations).toHaveLength(2);
      expect(visualizations.map((item) => item.visualizationName).toSorted()).toEqual([
        "折线图",
        "销售数据可视化",
      ]);
      expect(
        visualizations.every(
          (item) => item.visualizationFileName.endsWith("_index.html") && item.agentName === "财务分析助手",
        ),
      ).toBe(true);
    } finally {
      closeTenantPlatformDb(db);
    }
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
        removedWorkspaceCount: 1,
      });
      expect(listTenantMembers(db, tenant.id)).toEqual([]);
      expect(getUserByUsername(db, "member-delete")?.status).toBe("inactive");
      expect(
        db
          .prepare(
            `SELECT status
             FROM tenant_memberships
             WHERE tenant_id = ? AND user_id = ? AND role = 'member'`,
          )
          .get(tenant.id, member.id)?.status,
      ).toBe("deleted");
      expect(
        db
          .prepare(
            `SELECT status
             FROM user_agent_assignments
             WHERE tenant_id = ? AND user_id = ? AND tenant_agent_id = ?`,
          )
          .get(tenant.id, member.id, tenantAgentId)?.status,
      ).toBe("inactive");
      expect(
        listAssignedAgentsForUser(
          db,
          { tenantId: tenant.id, userId: member.id },
          readOpenClawAgentCatalog(sandbox.config.configPath),
        ),
      ).toEqual([]);
      expect(fs.existsSync(canonicalWorkspace)).toBe(false);
      expect(fs.existsSync(runtimeWorkspace)).toBe(false);
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

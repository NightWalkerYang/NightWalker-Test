import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assignTenantAgentToUser,
  closeTenantPlatformDb,
  openTenantPlatformDb,
  upsertTenantAgent,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
import { runManagedNodeSyncOnce } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/managed-node-sync.mjs";
import { createTenantPlatformRouter } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs";

const cleanupRoots = new Set();
const cleanupServers = new Set();

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  return `{${Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

function encodeBase64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signLicense(privateKey, overrides = {}) {
  const unsigned = {
    licenseId: overrides.licenseId ?? "license-local-001",
    customerName: overrides.customerName ?? "禄丰本地客户",
    deploymentMode: "local",
    issuedAt: overrides.issuedAt ?? "2026-04-01T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2099-05-01T00:00:00.000Z",
  };
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(stableStringify(unsigned));
  signer.end();
  return {
    ...unsigned,
    signature: encodeBase64Url(signer.sign(privateKey)),
  };
}

function createSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-local-"));
  cleanupRoots.add(root);
  const configDir = path.join(root, ".openclaw");
  const stateDir = path.join(configDir, "tenant-platform");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "openclaw.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      agents: {
        list: [
          {
            id: "subotech-finance",
            name: "苏博泰克财务分析助手",
            identity: { emoji: "💼" },
          },
        ],
      },
    }),
    "utf8",
  );
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    root,
    privateKey,
    config: {
      edition: "local",
      nodeRole: "standalone-local",
      bindHost: "127.0.0.1",
      port: 0,
      apiBasePath: "/tenant-platform-api/v1",
      configDir,
      configPath,
      stateDir,
      dbPath: path.join(stateDir, "tenant-platform.sqlite"),
      sessionSecret: "tenant-platform-local-test-secret",
      localLicensePath: path.join(stateDir, "local-license.json"),
      localLicensePublicKey: publicKey.export({ type: "spki", format: "pem" }).toString("utf8"),
      localLicensePublicKeyPath: path.join(stateDir, "license-public.pem"),
    },
  };
}

function createCloudSandbox(
  options: {
    nodeRole?: string;
    controlPlaneUrl?: string;
    nodeId?: string;
    nodeName?: string;
    nodeSecret?: string;
  } = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-cloud-"));
  cleanupRoots.add(root);
  const configDir = path.join(root, ".openclaw");
  const stateDir = path.join(configDir, "tenant-platform");
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
            identity: { emoji: "💼" },
          },
        ],
      },
    }),
    "utf8",
  );
  return {
    root,
    config: {
      edition: "cloud",
      nodeRole: String(options.nodeRole || "control-plane"),
      bindHost: "127.0.0.1",
      port: 0,
      apiBasePath: "/tenant-platform-api/v1",
      configDir,
      configPath,
      stateDir,
      dbPath: path.join(stateDir, "tenant-platform.sqlite"),
      sessionSecret: `tenant-platform-${String(options.nodeRole || "control-plane")}-test-secret`,
      localLicensePath: path.join(stateDir, "local-license.json"),
      localLicensePublicKey: "",
      localLicensePublicKeyPath: path.join(stateDir, "license-public.pem"),
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayToken: "",
      gatewayPassword: "",
      publicBaseUrl: "",
      controlPlaneUrl: String(options.controlPlaneUrl || ""),
      nodeId: String(options.nodeId || ""),
      nodeName: String(options.nodeName || ""),
      nodeSecret: String(options.nodeSecret || ""),
      managedNodeSyncIntervalMs: 1000,
      payments: {
        allinpay: {
          enabled: false,
        },
      },
    },
  };
}

async function startSandboxServer(sandbox) {
  const db = openTenantPlatformDb(sandbox.config);
  const router = createTenantPlatformRouter({ config: sandbox.config, db });
  const server = http.createServer((request, response) => {
    Promise.resolve(router(request, response)).catch((error) => {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanupServers.add({ server, db });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("tenant_platform_server_address_invalid");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    baseUrl: `http://127.0.0.1:${address.port}${sandbox.config.apiBasePath}`,
    db,
    server,
  };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload,
  };
}

afterEach(async () => {
  for (const item of cleanupServers) {
    await new Promise((resolve) => item.server.close(resolve));
    closeTenantPlatformDb(item.db);
  }
  cleanupServers.clear();
  for (const root of cleanupRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  cleanupRoots.clear();
});

describe("tenant platform local edition", () => {
  it("bootstraps a local tenant admin and blocks writes until a local license is imported", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);

    const bootstrap = await requestJson(baseUrl, "/bootstrap");
    expect(bootstrap.payload.data.edition).toBe("local");
    expect(bootstrap.payload.data.initialized).toBe(false);
    expect(bootstrap.payload.data.platformAdminCount).toBe(0);
    expect(bootstrap.payload.data.localTenantAdminCount).toBe(0);
    expect(bootstrap.payload.data.localLicense.status).toBe("missing");

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const token = setup.payload.data.token;
    expect(setup.status).toBe(200);
    expect(setup.payload.data.session.role).toBe("tenant_admin");
    expect(setup.payload.data.session.deploymentMode).toBe("local");

    const initialized = await requestJson(baseUrl, "/bootstrap");
    expect(initialized.payload.data.initialized).toBe(true);
    expect(initialized.payload.data.localTenantAdminCount).toBe(1);

    const blockedCreate = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token,
      body: {
        username: "member-before-license",
        password: "secret",
      },
    });
    expect(blockedCreate.status).toBe(403);
    expect(blockedCreate.payload.error).toBe("license_unavailable");

    const importResponse = await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });
    expect(importResponse.payload.data.status).toBe("active");

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token,
      body: {
        username: "member-after-license",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);
    expect(createdMember.payload.data.username).toBe("member-after-license");
  });

  it("updates member password and active status through tenant admin member routes", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(createMember.status).toBe(200);

    const disabled = await requestJson(baseUrl, "/tenant/admin/members/status", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userId: createMember.payload.data.id,
        status: "inactive",
      },
    });
    expect(disabled.status).toBe(200);
    expect(disabled.payload.data.status).toBe("inactive");

    const disabledLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(disabledLogin.status).toBe(403);
    expect(disabledLogin.payload.error).toBe("account_disabled");

    const enabled = await requestJson(baseUrl, "/tenant/admin/members/status", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userId: createMember.payload.data.id,
        status: "active",
      },
    });
    expect(enabled.status).toBe(200);
    expect(enabled.payload.data.status).toBe("active");

    const originalLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(originalLogin.status).toBe(200);

    const passwordUpdate = await requestJson(baseUrl, "/tenant/admin/members/password", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userId: createMember.payload.data.id,
        password: "new-secret",
      },
    });
    expect(passwordUpdate.status).toBe(200);

    const oldPasswordLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(oldPasswordLogin.status).toBe(401);
    expect(oldPasswordLogin.payload.error).toBe("invalid_credentials");

    const newPasswordLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "new-secret",
      },
    });
    expect(newPasswordLogin.status).toBe(200);
    expect(newPasswordLogin.payload.data.session.role).toBe("member");
  });

  it("serves rewritten visualization inline scripts through the tenant sidecar asset route", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const memberCreate = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-visual",
        password: "secret",
      },
    });
    expect(memberCreate.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const assignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: memberCreate.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      String(assignment.derivedAgentId),
      "Echarts",
    );
    fs.mkdirSync(visualizationDir, { recursive: true });
    fs.writeFileSync(
      path.join(visualizationDir, "销售采购总览_index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <body>",
        '    <div id="ready">ready</div>',
        "    <script>",
        "      window.__tenantVisualizationReady = 'ok';",
        "    </script>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "utf8",
    );

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-visual",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);
    const memberToken = memberLogin.payload.data.token;

    const visualizations = await requestJson(baseUrl, "/member/visualizations", {
      token: memberToken,
    });
    expect(visualizations.status).toBe(200);
    expect(visualizations.payload.data).toHaveLength(1);
    const visualization = visualizations.payload.data[0];

    const resolved = await requestJson(
      baseUrl,
      `/member/visualizations/resolve?token=${encodeURIComponent(visualization.token)}`,
      { token: memberToken },
    );
    expect(resolved.status).toBe(200);
    expect(resolved.payload.data.baseHref).toContain(
      `/member/visualizations/assets/${assignment.derivedAgentId}/`,
    );
    expect(resolved.payload.data.baseHref).toContain("?token=");

    const inlineScriptMatch = String(resolved.payload.data.html || "").match(
      /<script\b[^>]*src="([^"]*inline-script-[^"]+\.js[^"]*)"[^>]*><\/script>/i,
    );
    expect(inlineScriptMatch).not.toBeNull();
    const inlineScriptPath = String(inlineScriptMatch?.[1] || "");
    const response = await fetch(`${baseUrl}${inlineScriptPath.replace("/tenant-platform-api/v1", "")}`, {
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    const scriptContent = await response.text();
    expect(scriptContent).toContain("window.__tenantVisualizationReady = 'ok';");
  });

  it("revokes multiple agent assignments through the tenant admin revoke route", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMemberA = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    const createdMemberB = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-b",
        password: "secret",
      },
    });
    expect(createdMemberA.status).toBe(200);
    expect(createdMemberB.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMemberA.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });
    assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMemberB.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const memberLoginA = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    const memberLoginB = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-b",
        password: "secret",
      },
    });
    expect(memberLoginA.status).toBe(200);
    expect(memberLoginB.status).toBe(200);

    const beforeRevokeA = await requestJson(baseUrl, "/member/agents", {
      token: memberLoginA.payload.data.token,
    });
    const beforeRevokeB = await requestJson(baseUrl, "/member/agents", {
      token: memberLoginB.payload.data.token,
    });
    expect(beforeRevokeA.payload.data).toHaveLength(1);
    expect(beforeRevokeB.payload.data).toHaveLength(1);

    const revoked = await requestJson(baseUrl, "/tenant/admin/revoke-agent-assignments", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userIds: [createdMemberA.payload.data.id, createdMemberB.payload.data.id],
      },
    });
    expect(revoked.status).toBe(200);
    expect(revoked.payload.data.revokedAssignmentCount).toBe(2);
    expect(revoked.payload.data.affectedMemberCount).toBe(2);

    const afterRevokeA = await requestJson(baseUrl, "/member/agents", {
      token: memberLoginA.payload.data.token,
    });
    const afterRevokeB = await requestJson(baseUrl, "/member/agents", {
      token: memberLoginB.payload.data.token,
    });
    expect(afterRevokeA.payload.data).toHaveLength(0);
    expect(afterRevokeB.payload.data).toHaveLength(0);
  });

  it("assigns multiple tenant agents to a member in a single request", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const firstTenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const secondTenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-writing",
      description: "文案辅助",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });

    const assigned = await requestJson(baseUrl, "/tenant/admin/assign-agent", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userId: createdMember.payload.data.id,
        tenantAgentIds: [firstTenantAgentId, secondTenantAgentId],
      },
    });
    expect(assigned.status).toBe(200);
    expect(assigned.payload.data.assignedAssignmentCount).toBe(2);
    expect(assigned.payload.data.assignmentIds).toHaveLength(2);

    const assignedAgents = await requestJson(
      baseUrl,
      `/tenant/admin/members/agents?userId=${createdMember.payload.data.id}`,
      {
        token: tenantAdminToken,
      },
    );
    expect(assignedAgents.status).toBe(200);
    expect(assignedAgents.payload.data).toHaveLength(2);

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);
    const memberAgents = await requestJson(baseUrl, "/member/agents", {
      token: memberLogin.payload.data.token,
    });
    expect(memberAgents.status).toBe(200);
    expect(memberAgents.payload.data).toHaveLength(2);
  });

  it("lists current member visualizations and externalizes inline scripts into workspace assets", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-visual",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const assignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMember.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      String(assignment.derivedAgentId),
      "Echarts",
    );
    fs.mkdirSync(visualizationDir, { recursive: true });
    fs.writeFileSync(
      path.join(visualizationDir, "销售数据可视化_index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <title>销售数据</title>",
        '    <script src="/assets/vendor/echarts.min.js"></script>',
        '    <script src="financial_data.js"></script>',
        "  </head>",
        "  <body>",
        '    <a href="资金大屏可视化_index.html">切换到资金大屏</a>',
        '    <button onclick="window.location.href=\'资金大屏可视化_index.html\'">按钮跳转</button>',
        '    <main id="viz"></main>',
        "    <script>",
        "      async function loadData() {",
        "        const response = await fetch('dashboard_data.json');",
        "        const data = await response.json();",
        "        document.getElementById('viz').textContent = data.summary.total_assets;",
        "      }",
        "      loadData();",
        "    </script>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "资金大屏可视化_index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <title>资金大屏</title>",
        "  </head>",
        "  <body>",
        "    <main>资金大屏</main>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "utf8",
    );

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-visual",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const listResponse = await requestJson(baseUrl, "/member/visualizations", {
      token: memberLogin.payload.data.token,
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.payload.data.map((item) => item.visualizationName).toSorted()).toEqual([
      "资金大屏可视化",
      "销售数据可视化",
    ]);
    const salesVisualization = listResponse.payload.data.find(
      (item) => item.visualizationName === "销售数据可视化",
    );
    expect(salesVisualization).toBeDefined();
    expect(salesVisualization?.href).toMatch(/^\/echarts-view\/\?token=/);
    expect(salesVisualization?.href).not.toMatch(/^https?:\/\//);

    const resolveResponse = await requestJson(
      baseUrl,
      `/member/visualizations/resolve?token=${encodeURIComponent(String(salesVisualization?.token || ""))}`,
    );
    const apiBasePrefix = "/tenant-platform-api/v1";
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.payload.data.visualizationName).toBe("销售数据可视化");
    expect(resolveResponse.payload.data.href).toMatch(
      new RegExp(
        `^${apiBasePrefix}/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("销售数据可视化_index.html")}\\?token=`,
      ),
    );
    expect(resolveResponse.payload.data.href).not.toMatch(/^https?:\/\//);
    expect(resolveResponse.payload.data.html).toContain("销售数据");
    expect(resolveResponse.payload.data.baseHref).toMatch(
      new RegExp(
        `^${apiBasePrefix}/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("销售数据可视化_index.html")}/\\?token=`,
      ),
    );
    expect(resolveResponse.payload.data.baseHref).not.toMatch(/^https?:\/\//);
    expect(resolveResponse.payload.data.href).toContain("?token=");
    expect(resolveResponse.payload.data.html).toContain('/echarts-view/?token=');
    expect(resolveResponse.payload.data.html).not.toContain('href="资金大屏可视化_index.html"');
    expect(resolveResponse.payload.data.html).toContain('target="_top"');
    expect(resolveResponse.payload.data.html).not.toContain("onclick=");
    expect(resolveResponse.payload.data.html).toContain("data-openclaw-inline-handler-1");
    expect(resolveResponse.payload.data.html).toContain(
      `${apiBasePrefix}/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("销售数据可视化_index.html")}/financial_data.js?token=`,
    );
    expect(resolveResponse.payload.data.html).toContain("__openclaw_echarts_view__");
    expect(resolveResponse.payload.data.html).not.toContain(
      "fetch('dashboard_data.json')",
    );
    expect(resolveResponse.payload.data.html).not.toContain('src="financial_data.js"');

    const generatedScriptMatch = resolveResponse.payload.data.html.match(
      /<script\b[^>]*src="([^"]*\/tenant-platform-api\/v1\/member\/visualizations\/assets\/[^"]*__openclaw_echarts_view__-[^"]+)"[^>]*><\/script>/i,
    );
    expect(generatedScriptMatch).not.toBeNull();
    const generatedScriptHref = generatedScriptMatch?.[1] || "";
    const generatedScriptPath = path.join(
      visualizationDir,
      generatedScriptHref.split("?")[0].replace(
        new RegExp(
          `^${apiBasePrefix}/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("销售数据可视化_index.html")}/`,
        ),
        "",
      ),
    );
    expect(fs.existsSync(generatedScriptPath)).toBe(true);
    const generatedScriptContent = fs.readFileSync(generatedScriptPath, "utf8");
    expect(generatedScriptContent).toContain(
      `${apiBasePrefix}/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("销售数据可视化_index.html")}/dashboard_data.json?token=`,
    );
    expect(generatedScriptContent).toContain("?token=");
    expect(generatedScriptContent).toContain("document.getElementById('viz').textContent");

    const generatedHandlerScriptMatch = resolveResponse.payload.data.html.match(
      /<script\b[^>]*src="([^"]*\/tenant-platform-api\/v1\/member\/visualizations\/assets\/[^"]*__openclaw_echarts_view__-[^"]*inline-handler-[^"]+)"[^>]*><\/script>/i,
    );
    expect(generatedHandlerScriptMatch).not.toBeNull();
    const generatedHandlerScriptPath = path.join(
      visualizationDir,
      String(generatedHandlerScriptMatch?.[1] || "").split("?")[0].replace(
        new RegExp(
          `^${apiBasePrefix}/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("销售数据可视化_index.html")}/`,
        ),
        "",
      ),
    );
    expect(fs.existsSync(generatedHandlerScriptPath)).toBe(true);
    const generatedHandlerScriptContent = fs.readFileSync(generatedHandlerScriptPath, "utf8");
    expect(generatedHandlerScriptContent).toContain('addEventListener("click"');
    expect(generatedHandlerScriptContent).toContain("window.top.location.href =");
  });

  it("serves visualization assets to public echarts-view token requests without a bearer session", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-public-echarts-assets",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-public-assets",
        password: "secret",
      },
    });
    const memberId = createdMember.payload.data.id;

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "销售分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const assignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: memberId,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });
    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      String(assignment.derivedAgentId),
      "Echarts",
    );
    fs.mkdirSync(visualizationDir, { recursive: true });
    fs.writeFileSync(
      path.join(visualizationDir, "销售驾驶舱_index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <body>",
        '    <div id=\"viz\"></div>',
        "    <script>",
        "      fetch('dashboard_data.json')",
        "        .then((response) => response.json())",
        "        .then((payload) => {",
        "          document.getElementById('viz').textContent = payload.title;",
        "        });",
        "    </script>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "dashboard_data.json"),
      JSON.stringify({ title: "public-ok" }),
      "utf8",
    );

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-public-assets",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const listResponse = await requestJson(baseUrl, "/member/visualizations", {
      token: memberLogin.payload.data.token,
    });
    expect(listResponse.status).toBe(200);
    const visualization = listResponse.payload.data.find(
      (item) => item.visualizationName === "销售驾驶舱",
    );
    expect(visualization?.token).toBeTruthy();

    const resolveResponse = await requestJson(
      baseUrl,
      `/member/visualizations/resolve?token=${encodeURIComponent(String(visualization?.token || ""))}`,
    );
    expect(resolveResponse.status).toBe(200);

    const generatedScriptMatch = String(resolveResponse.payload.data.html).match(
      /<script\b[^>]*src=\"([^\"]*inline-script-[^\"]+\.js[^\"]*)\"[^>]*><\/script>/i,
    );
    expect(generatedScriptMatch).not.toBeNull();
    const generatedScriptUrl = new URL(String(generatedScriptMatch?.[1] || ""), baseUrl);
    const generatedScriptResponse = await fetch(generatedScriptUrl, {
      headers: {
        accept: "application/javascript",
      },
    });
    expect(generatedScriptResponse.status).toBe(200);
    expect(generatedScriptResponse.headers.get("content-type") || "").toContain("javascript");
    const generatedScriptBody = await generatedScriptResponse.text();
    expect(generatedScriptBody).toContain("dashboard_data.json");
    expect(generatedScriptBody).toContain("?token=");

    const dataMatch = generatedScriptBody.match(
      /(\/tenant-platform-api\/v1\/member\/visualizations\/assets\/[^"'`]*dashboard_data\.json\?token=[^"'`\s]+)/,
    );
    expect(dataMatch).not.toBeNull();
    const dataResponse = await fetch(new URL(String(dataMatch?.[1] || ""), baseUrl), {
      headers: {
        accept: "application/json",
      },
    });
    expect(dataResponse.status).toBe(200);
    await expect(dataResponse.json()).resolves.toEqual({ title: "public-ok" });
  });

  it("resolves dashboard manifest visualizations into fixed zero-intrusive runtime wrappers", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-dashboard-manifest",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-manifest",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const assignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMember.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      String(assignment.derivedAgentId),
      "Echarts",
    );
    fs.mkdirSync(path.join(visualizationDir, "datasets"), { recursive: true });
    fs.writeFileSync(
      path.join(visualizationDir, "财务总览驾驶舱_index.dashboard.json"),
      JSON.stringify(
        {
          version: 1,
          template: "financial-command-center-v1",
          title: "财务总览驾驶舱",
          subtitle: "2026年3月经营态势",
          dataSource: "datasets/财务数据.json",
          navigation: [{ label: "切换资金屏", targetFileName: "资金总览驾驶舱_index.dashboard.json" }],
          metrics: [{ label: "总资产", value: "128.6", unit: "亿元" }],
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "资金总览驾驶舱_index.dashboard.json"),
      JSON.stringify(
        {
          version: 1,
          title: "资金总览驾驶舱",
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "datasets", "财务数据.json"),
      JSON.stringify({
        metrics: [
          { label: "总资产", value: "130.2", unit: "亿元" },
          { label: "营收完成", value: "43.8", unit: "亿元" },
        ],
      }),
      "utf8",
    );

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-manifest",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const listResponse = await requestJson(baseUrl, "/member/visualizations", {
      token: memberLogin.payload.data.token,
    });
    expect(listResponse.status).toBe(200);
    const manifestVisualization = listResponse.payload.data.find(
      (item) => item.visualizationName === "财务总览驾驶舱",
    );
    expect(manifestVisualization?.visualizationType).toBe("dashboard_manifest");

    const resolveResponse = await requestJson(
      baseUrl,
      `/member/visualizations/resolve?token=${encodeURIComponent(String(manifestVisualization?.token || ""))}`,
    );
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.payload.data.visualizationType).toBe("dashboard_manifest");
    expect(resolveResponse.payload.data.visualizationName).toBe("财务总览驾驶舱");
    expect(resolveResponse.payload.data.href).toMatch(
      new RegExp(
        `^/tenant-platform-api/v1/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("财务总览驾驶舱_index.dashboard.json")}\\?token=`,
      ),
    );
    expect(resolveResponse.payload.data.html).toContain("/assets/runtime/dashboard-manifest/styles.css");
    expect(resolveResponse.payload.data.html).toContain("/assets/runtime/dashboard-manifest/bootstrap.js");
    expect(resolveResponse.payload.data.html).toContain('"visualizationType":"dashboard_manifest"');
    expect(resolveResponse.payload.data.html).toContain('"dataSource":"datasets/财务数据.json"');
    expect(resolveResponse.payload.data.html).toContain(
      `"workspaceBaseHref":"/tenant-platform-api/v1/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("财务总览驾驶舱_index.dashboard.json")}/?token=`,
    );
    expect(resolveResponse.payload.data.html).toContain("资金总览驾驶舱_index.dashboard.json");
    expect(resolveResponse.payload.data.html).toContain("/echarts-view/?token=");
    expect(resolveResponse.payload.data.html).not.toContain("__openclaw_echarts_view__");
  });

  it("aliases non-ASCII external visualization assets into ASCII workspace files", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-non-ascii",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const assignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMember.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      String(assignment.derivedAgentId),
      "Echarts",
    );
    fs.mkdirSync(visualizationDir, { recursive: true });
    fs.writeFileSync(
      path.join(visualizationDir, "资金风险监控大屏_index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <title>资金风险监控</title>",
        '    <script src="/assets/vendor/echarts.min.js"></script>',
        '    <script src="./双屏联动数据_1776828040.js"></script>',
        "  </head>",
        "  <body>",
        '    <main id="viz"></main>',
        "  </body>",
        "</html>",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "双屏联动数据_1776828040.js"),
      [
        "window.__DUAL_DASHBOARD__ = { updatedAt: '2026-04-22 03:20 UTC' };",
        "async function loadRiskData() {",
        "  const response = await fetch('经营详情.json');",
        "  window.__DUAL_DASHBOARD_DETAIL__ = await response.json();",
        "}",
        "loadRiskData();",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "经营详情.json"),
      JSON.stringify({
        summary: {
          totalAssets: 123,
        },
      }),
      "utf8",
    );

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-non-ascii",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const listResponse = await requestJson(baseUrl, "/member/visualizations", {
      token: memberLogin.payload.data.token,
    });
    const riskVisualization = listResponse.payload.data.find(
      (item) => item.visualizationName === "资金风险监控大屏",
    );
    expect(riskVisualization).toBeDefined();

    const resolveResponse = await requestJson(
      baseUrl,
      `/member/visualizations/resolve?token=${encodeURIComponent(String(riskVisualization?.token || ""))}`,
    );
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.payload.data.html).not.toContain("双屏联动数据_1776828040.js");
    expect(resolveResponse.payload.data.html).not.toContain("经营详情.json");

    const assetPrefix = new RegExp(
      `^/tenant-platform-api/v1/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("资金风险监控大屏_index.html")}/`,
    );
    const generatedAssetMatches = [
      ...resolveResponse.payload.data.html.matchAll(
        /<script\b[^>]*src="([^"]*__openclaw_echarts_view__-[^"]*asset-[a-f0-9]{12}\.js[^"]*)"[^>]*><\/script>/gi,
      ),
    ];
    expect(generatedAssetMatches.length).toBeGreaterThanOrEqual(1);

    const generatedScriptHref = generatedAssetMatches[0]?.[1] || "";
    expect(generatedScriptHref).toMatch(assetPrefix);
    const generatedScriptPath = path.join(
      visualizationDir,
      generatedScriptHref.split("?")[0].replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedScriptPath)).toBe(true);
    expect(path.basename(generatedScriptPath)).toMatch(/^asset-[a-f0-9]{12}\.js$/);

    const generatedScriptContent = fs.readFileSync(generatedScriptPath, "utf8");
    expect(generatedScriptContent).toContain("window.__DUAL_DASHBOARD__");
    expect(generatedScriptContent).not.toContain("fetch('经营详情.json')");

    const generatedJsonPathMatch = generatedScriptContent.match(
      /\/tenant-platform-api\/v1\/member\/visualizations\/assets\/[^"'`]*__openclaw_echarts_view__-[^"'`]*asset-[a-f0-9]{12}\.json(?:\?token=[^"'`\s]+)?/,
    );
    expect(generatedJsonPathMatch).not.toBeNull();
    const generatedJsonPath = path.join(
      visualizationDir,
      String(generatedJsonPathMatch?.[0] || "").split("?")[0].replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedJsonPath)).toBe(true);
    expect(path.basename(generatedJsonPath)).toMatch(/^asset-[a-f0-9]{12}\.json$/);
  });

  it("rewrites module graphs and style assets so AI-generated 3D visualizations stay renderable", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-runtime-spec",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-runtime-spec",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const assignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMember.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const visualizationDir = path.join(
      sandbox.config.configDir,
      "workspace-agents",
      String(assignment.derivedAgentId),
      "Echarts",
    );
    fs.mkdirSync(path.join(visualizationDir, "styles"), { recursive: true });
    fs.mkdirSync(path.join(visualizationDir, "scripts", "helpers"), { recursive: true });
    fs.mkdirSync(path.join(visualizationDir, "scripts", "workers"), { recursive: true });
    fs.mkdirSync(path.join(visualizationDir, "scripts", "images"), { recursive: true });
    fs.mkdirSync(path.join(visualizationDir, "images"), { recursive: true });
    fs.mkdirSync(path.join(visualizationDir, "models"), { recursive: true });

    fs.writeFileSync(
      path.join(visualizationDir, "宇宙驾驶舱_index.html"),
      [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <title>宇宙驾驶舱</title>",
        '    <link rel="stylesheet" href="./styles/控制舱主题.css">',
        "    <style>",
        "      body { background-image: url('./images/背景 星空.png'); }",
        "    </style>",
        "  </head>",
        "  <body>",
        '    <main id="stage" style="background-image:url(\'./images/背景 星空.png\')">3D 舞台</main>',
        "    <script type=\"module\">",
        "      import { mountStage } from './scripts/scene.module.js';",
        "      mountStage();",
        "    </script>",
        "  </body>",
        "</html>",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "styles", "控制舱主题.css"),
      [
        "@import url('./base.css');",
        "#stage::before {",
        "  content: '';",
        "  background-image: url('../images/粒子 背景.png');",
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "styles", "base.css"),
      "#stage { color: #7fd1ff; }",
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "scripts", "scene.module.js"),
      [
        "import { createStage } from './helpers/create-stage.js';",
        "const stageWorker = new Worker('./workers/render.worker.js', { type: 'module' });",
        "const modelUrl = new URL('../models/command-center.glb', import.meta.url);",
        "const textureUrl = './images/hud-ring.png';",
        "export function mountStage() {",
        "  window.__stageAssets = {",
        "    stage: typeof createStage,",
        "    worker: Boolean(stageWorker),",
        "    modelUrl: String(modelUrl),",
        "    textureUrl,",
        "  };",
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "scripts", "helpers", "create-stage.js"),
      "export function createStage() { return 'stage'; }",
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "scripts", "workers", "render.worker.js"),
      "self.onmessage = () => self.postMessage('ok');",
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "scripts", "images", "hud-ring.png"),
      "png-placeholder",
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "images", "背景 星空.png"),
      "background-placeholder",
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "images", "粒子 背景.png"),
      "particle-placeholder",
      "utf8",
    );
    fs.writeFileSync(
      path.join(visualizationDir, "models", "command-center.glb"),
      "glb-placeholder",
      "utf8",
    );

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-runtime-spec",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const listResponse = await requestJson(baseUrl, "/member/visualizations", {
      token: memberLogin.payload.data.token,
    });
    const cockpitVisualization = listResponse.payload.data.find(
      (item) => item.visualizationName === "宇宙驾驶舱",
    );
    expect(cockpitVisualization).toBeDefined();

    const resolveResponse = await requestJson(
      baseUrl,
      `/member/visualizations/resolve?token=${encodeURIComponent(String(cockpitVisualization?.token || ""))}`,
    );
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.payload.data.html).toContain("宇宙驾驶舱");
    expect(resolveResponse.payload.data.html).not.toContain("./images/背景 星空.png");
    expect(resolveResponse.payload.data.html).not.toContain("./styles/控制舱主题.css");

    const assetPrefix = new RegExp(
      `^/tenant-platform-api/v1/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("宇宙驾驶舱_index.html")}/`,
    );
    const generatedInlineModuleMatch = resolveResponse.payload.data.html.match(
      /<script\b[^>]*src="([^"]*__openclaw_echarts_view__-[^"]*inline-script-[^"]+\.js[^"]*)"[^>]*><\/script>/i,
    );
    expect(generatedInlineModuleMatch).not.toBeNull();
    const generatedInlineModulePath = path.join(
      visualizationDir,
      String(generatedInlineModuleMatch?.[1] || "").split("?")[0].replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedInlineModulePath)).toBe(true);
    const generatedInlineModuleContent = fs.readFileSync(generatedInlineModulePath, "utf8");
    expect(generatedInlineModuleContent).not.toContain("./scripts/scene.module.js");
    expect(generatedInlineModuleContent).toMatch(/asset-[a-f0-9]{12}\.js/);

    const generatedModuleAliasMatch = generatedInlineModuleContent.match(
      /\/tenant-platform-api\/v1\/member\/visualizations\/assets\/[^"'`]*__openclaw_echarts_view__-[^"'`]*asset-[a-f0-9]{12}\.js(?:\?token=[^"'`\s]+)?/,
    );
    expect(generatedModuleAliasMatch).not.toBeNull();
    const generatedModuleAliasPath = path.join(
      visualizationDir,
      String(generatedModuleAliasMatch?.[0] || "").split("?")[0].replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedModuleAliasPath)).toBe(true);
    const generatedModuleAliasContent = fs.readFileSync(generatedModuleAliasPath, "utf8");
    expect(generatedModuleAliasContent).not.toContain("./helpers/create-stage.js");
    expect(generatedModuleAliasContent).not.toContain("new Worker('./workers/render.worker.js'");
    expect(generatedModuleAliasContent).toMatch(/asset-[a-f0-9]{12}\.js/);
    expect(generatedModuleAliasContent).toContain(
      `/tenant-platform-api/v1/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("宇宙驾驶舱_index.html")}/models/command-center.glb?token=`,
    );
    expect(generatedModuleAliasContent).toContain(
      `/tenant-platform-api/v1/member/visualizations/assets/${encodeURIComponent(String(assignment.derivedAgentId))}/${encodeURIComponent("宇宙驾驶舱_index.html")}/scripts/images/hud-ring.png?token=`,
    );

    const generatedCssMatch = resolveResponse.payload.data.html.match(
      /<link\b[^>]*href="([^"]*__openclaw_echarts_view__-[^"]*asset-[a-f0-9]{12}\.css[^"]*)"[^>]*>/i,
    );
    expect(generatedCssMatch).not.toBeNull();
    const generatedCssPath = path.join(
      visualizationDir,
      String(generatedCssMatch?.[1] || "").split("?")[0].replace(assetPrefix, ""),
    );
    expect(fs.existsSync(generatedCssPath)).toBe(true);
    const generatedCssContent = fs.readFileSync(generatedCssPath, "utf8");
    expect(generatedCssContent).not.toContain("../images/粒子 背景.png");
    expect(generatedCssContent).not.toContain("./base.css");
    expect(generatedCssContent).toMatch(/asset-[a-f0-9]{12}\.png/);
    expect(generatedCssContent).toContain("/tenant-platform-api/v1/member/visualizations/assets/");
  });

  it("lists assigned agents for a member and revokes selected assignments by assignment id", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createdMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const firstTenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const secondTenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-writing",
      description: "文案辅助",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    const firstAssignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMember.payload.data.id,
      tenantAgentId: firstTenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });
    const secondAssignment = assignTenantAgentToUser(db, {
      tenantId,
      userId: createdMember.payload.data.id,
      tenantAgentId: secondTenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const assignedAgentsBefore = await requestJson(
      baseUrl,
      `/tenant/admin/members/agents?userId=${encodeURIComponent(createdMember.payload.data.id)}`,
      {
        token: tenantAdminToken,
      },
    );
    expect(assignedAgentsBefore.status).toBe(200);
    expect(assignedAgentsBefore.payload.data).toHaveLength(2);
    expect(
      assignedAgentsBefore.payload.data.every(
        (entry) => String(entry.displayName || entry.agentName || "").trim() !== "not_found",
      ),
    ).toBe(true);
    expect(assignedAgentsBefore.payload.data.map((entry) => entry.assignmentId).toSorted()).toEqual(
      [firstAssignment.assignmentId, secondAssignment.assignmentId].toSorted(),
    );

    const revoked = await requestJson(baseUrl, "/tenant/admin/revoke-agent-assignments", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userId: createdMember.payload.data.id,
        assignmentIds: [firstAssignment.assignmentId, secondAssignment.assignmentId],
      },
    });
    expect(revoked.status).toBe(200);
    expect(revoked.payload.data.revokedAssignmentCount).toBe(2);
    expect(revoked.payload.data.affectedMemberCount).toBe(1);

    const assignedAgentsAfter = await requestJson(
      baseUrl,
      `/tenant/admin/members/agents?userId=${encodeURIComponent(createdMember.payload.data.id)}`,
      {
        token: tenantAdminToken,
      },
    );
    expect(assignedAgentsAfter.payload.data).toHaveLength(0);

    const memberAgentsAfter = await requestJson(baseUrl, "/member/agents", {
      token: memberLogin.payload.data.token,
    });
    expect(memberAgentsAfter.payload.data).toHaveLength(0);
  });

  it("allows readonly tenant login after expiry but blocks writes", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-expired",
            expiresAt: "2026-04-01T00:00:01.000Z",
          }),
        ),
      },
    });

    const login = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "local-admin",
        password: "secret",
      },
    });
    expect(login.status).toBe(200);
    expect(login.payload.data.session.readonly).toBe(true);
    expect(login.payload.data.session.licenseStatus).toBe("expired");

    const blockedMemberCreate = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: login.payload.data.token,
      body: {
        username: "readonly-member",
        password: "secret",
      },
    });
    expect(blockedMemberCreate.status).toBe(403);
    expect(blockedMemberCreate.payload.error).toBe("license_readonly");
  });

  it("blocks member login while the local license is missing but still allows tenant admins to log in", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(createMember.status).toBe(200);

    fs.rmSync(sandbox.config.localLicensePath, { force: true });

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(403);
    expect(memberLogin.payload.error).toBe("license_unavailable");

    const adminLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "local-admin",
        password: "secret",
      },
    });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.payload.data.session.role).toBe("tenant_admin");
  });

  it("syncs member usage records and exposes tenant usage stats for tenant admins", async () => {
    const sandbox = createSandbox();
    const { baseUrl, db } = await startSandboxServer(sandbox);

    const setup = await requestJson(baseUrl, "/setup/local-tenant-admin", {
      method: "POST",
      body: { username: "local-admin", password: "secret" },
    });
    const tenantAdminToken = setup.payload.data.token;
    const tenantId = setup.payload.data.session.tenantId;

    await requestJson(baseUrl, "/platform/local-license/import", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        licenseText: JSON.stringify(
          signLicense(sandbox.privateKey, {
            licenseId: "local-license-active",
            expiresAt: "2099-06-01T00:00:00.000Z",
          }),
        ),
      },
    });

    const createMember = await requestJson(baseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(createMember.status).toBe(200);

    const tenantAgentId = upsertTenantAgent(db, {
      tenantId,
      agentId: "subotech-finance",
      description: "财务分析",
      rateMultiplier: 1,
      balancePoints: 10,
      status: "active",
    });
    assignTenantAgentToUser(db, {
      tenantId,
      userId: createMember.payload.data.id,
      tenantAgentId,
      configPath: sandbox.config.configPath,
      configDir: sandbox.config.configDir,
    });

    const memberLogin = await requestJson(baseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(memberLogin.status).toBe(200);

    const sessionKey =
      "agent:subotech-finance:tenant:t-1:tenant-agent:tenant-agent-1:user:user-1:chat:usage";
    const firstSync = await requestJson(baseUrl, "/member/usage-records/sync", {
      method: "POST",
      token: memberLogin.payload.data.token,
      body: {
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
      },
    });
    expect(firstSync.status).toBe(200);
    expect(firstSync.payload.data.inserted).toBe(1);

    const secondSync = await requestJson(baseUrl, "/member/usage-records/sync", {
      method: "POST",
      token: memberLogin.payload.data.token,
      body: {
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
      },
    });
    expect(secondSync.status).toBe(200);
    expect(secondSync.payload.data.updated).toBe(1);
    expect(secondSync.payload.data.billingEnabled).toBe(false);
    expect(secondSync.payload.data.agentBalancePoints).toBe(10);

    const stats = await requestJson(
      baseUrl,
      "/tenant/admin/usage-stats?startDate=2026-04-13&endDate=2026-04-13",
      {
        token: tenantAdminToken,
      },
    );
    expect(stats.status).toBe(200);
    expect(stats.payload.data.totals.totalTokens).toBe(165);
    expect(stats.payload.data.totals.responseCount).toBe(1);
    expect(stats.payload.data.byMember).toEqual([
      expect.objectContaining({
        username: "member-a",
        totalTokens: 165,
      }),
    ]);
    expect(stats.payload.data.byAgent).toEqual([
      expect.objectContaining({
        tenantAgentId,
        agentId: "subotech-finance",
        agentName: "苏博泰克财务分析助手",
        totalTokens: 165,
      }),
    ]);
    expect(stats.payload.data.byDay).toEqual([
      expect.objectContaining({
        usageDay: "2026-04-13",
        totalTokens: 165,
      }),
    ]);

    const storedBalance = db
      .prepare("SELECT balance_points AS balancePoints FROM tenant_agents WHERE id = ?")
      .get(tenantAgentId);
    expect(storedBalance?.balancePoints).toBe(10);
    const ledgerCount = db
      .prepare("SELECT COUNT(*) AS total FROM tenant_wallet_ledger WHERE tenant_id = ?")
      .get(tenantId);
    expect(ledgerCount?.total).toBe(0);
  });
});

describe("tenant platform managed node sync", () => {
  it("syncs control-plane tenant state into a managed node and blocks local writes there", async () => {
    const controlPlane = createCloudSandbox();
    const { baseUrl: controlPlaneBaseUrl, origin: controlPlaneOrigin } =
      await startSandboxServer(controlPlane);

    const platformSetup = await requestJson(controlPlaneBaseUrl, "/setup/platform-admin", {
      method: "POST",
      body: {
        username: "platform-root",
        password: "secret",
      },
    });
    expect(platformSetup.status).toBe(200);
    const platformToken = platformSetup.payload.data.token;

    const createdTenant = await requestJson(controlPlaneBaseUrl, "/platform/tenants", {
      method: "POST",
      token: platformToken,
      body: {
        code: "managed-alpha",
        name: "受管租户 Alpha",
        adminUsername: "tenant-admin",
        adminPassword: "secret",
        memberLimit: 5,
        deploymentMode: "cloud",
      },
    });
    expect(createdTenant.status).toBe(200);
    const tenantId = createdTenant.payload.data.id;

    const tenantAdminLogin = await requestJson(controlPlaneBaseUrl, "/login", {
      method: "POST",
      body: {
        username: "tenant-admin",
        password: "secret",
      },
    });
    expect(tenantAdminLogin.status).toBe(200);
    const tenantAdminToken = tenantAdminLogin.payload.data.token;

    const createdMember = await requestJson(controlPlaneBaseUrl, "/tenant/admin/members", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(createdMember.status).toBe(200);

    const tenantAgent = await requestJson(controlPlaneBaseUrl, "/platform/tenant-agents", {
      method: "POST",
      token: platformToken,
      body: {
        tenantId,
        agentId: "finance",
        description: "财务分析",
        rateMultiplier: 1.25,
        balancePoints: 18,
      },
    });
    expect(tenantAgent.status).toBe(200);

    const assigned = await requestJson(controlPlaneBaseUrl, "/tenant/admin/assign-agent", {
      method: "POST",
      token: tenantAdminToken,
      body: {
        userId: createdMember.payload.data.id,
        tenantAgentIds: [tenantAgent.payload.data.id],
      },
    });
    expect(assigned.status).toBe(200);
    expect(assigned.payload.data.assignedAssignmentCount).toBe(1);

    const createdNode = await requestJson(controlPlaneBaseUrl, "/platform/nodes", {
      method: "POST",
      token: platformToken,
      body: {
        id: "node-shanghai",
        name: "上海受管节点",
        sharedSecret: "node-secret",
        status: "active",
        leaseStatus: "active",
        leaseExpiresAt: "2099-06-01T00:00:00.000Z",
      },
    });
    expect(createdNode.status).toBe(200);
    expect(createdNode.payload.data.id).toBe("node-shanghai");

    const binding = await requestJson(controlPlaneBaseUrl, "/platform/tenant-node-binding", {
      method: "POST",
      token: platformToken,
      body: {
        tenantId,
        nodeId: "node-shanghai",
      },
    });
    expect(binding.status).toBe(200);
    expect(binding.payload.data.boundNodeId).toBe("node-shanghai");

    const managedNode = createCloudSandbox({
      nodeRole: "managed-node",
      controlPlaneUrl: controlPlaneOrigin,
      nodeId: "node-shanghai",
      nodeName: "上海受管节点",
      nodeSecret: "node-secret",
    });
    const { baseUrl: managedNodeBaseUrl, db: managedNodeDb } = await startSandboxServer(managedNode);

    const syncResult = await runManagedNodeSyncOnce({
      config: managedNode.config,
      db: managedNodeDb,
      registration: true,
    });
    expect(syncResult?.tenantCount).toBe(1);
    expect(syncResult?.assignmentCount).toBe(1);

    const controlPlaneNodes = await requestJson(controlPlaneBaseUrl, "/platform/nodes", {
      token: platformToken,
    });
    expect(controlPlaneNodes.status).toBe(200);
    expect(controlPlaneNodes.payload.data).toEqual([
      expect.objectContaining({
        id: "node-shanghai",
        name: "上海受管节点",
        leaseStatus: "active",
      }),
    ]);
    expect(controlPlaneNodes.payload.data[0]?.lastHeartbeatAt).toBeTruthy();
    expect(Number(controlPlaneNodes.payload.data[0]?.lastAppliedRevision || 0)).toBeGreaterThan(0);

    const managedBootstrap = await requestJson(managedNodeBaseUrl, "/bootstrap");
    expect(managedBootstrap.status).toBe(200);
    expect(managedBootstrap.payload.data.nodeRole).toBe("managed-node");
    expect(managedBootstrap.payload.data.initialized).toBe(true);
    expect(managedBootstrap.payload.data.nodeLease.status).toBe("active");
    expect(managedBootstrap.payload.data.managedNode.id).toBe("node-shanghai");
    expect(Number(managedBootstrap.payload.data.managedNodeSync.lastAppliedRevision || 0)).toBeGreaterThan(
      0,
    );

    const managedTenantAdminLogin = await requestJson(managedNodeBaseUrl, "/login", {
      method: "POST",
      body: {
        username: "tenant-admin",
        password: "secret",
      },
    });
    expect(managedTenantAdminLogin.status).toBe(200);
    expect(managedTenantAdminLogin.payload.data.session.nodeRole).toBe("managed-node");

    const blockedWrite = await requestJson(managedNodeBaseUrl, "/tenant/admin/members", {
      method: "POST",
      token: managedTenantAdminLogin.payload.data.token,
      body: {
        username: "member-blocked",
        password: "secret",
      },
    });
    expect(blockedWrite.status).toBe(403);
    expect(blockedWrite.payload.error).toBe("managed_node_controlled");

    const managedMemberLogin = await requestJson(managedNodeBaseUrl, "/login", {
      method: "POST",
      body: {
        username: "member-a",
        password: "secret",
      },
    });
    expect(managedMemberLogin.status).toBe(200);
    expect(managedMemberLogin.payload.data.session.nodeRole).toBe("managed-node");

    const memberAgents = await requestJson(managedNodeBaseUrl, "/member/agents", {
      token: managedMemberLogin.payload.data.token,
    });
    expect(memberAgents.status).toBe(200);
    expect(memberAgents.payload.data).toEqual([
      expect.objectContaining({
        baseAgentId: "finance",
        agentName: "财务分析助手",
        balancePoints: 18,
      }),
    ]);
  });
});

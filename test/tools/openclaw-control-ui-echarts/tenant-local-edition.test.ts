import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openTenantPlatformDb, closeTenantPlatformDb } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
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
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

function encodeBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

async function startSandboxServer(sandbox) {
  const db = openTenantPlatformDb(sandbox.config);
  const router = createTenantPlatformRouter({ config: sandbox.config, db });
  const server = http.createServer((request, response) => {
    Promise.resolve(router(request, response)).catch((error) => {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanupServers.add({ server, db });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("tenant_platform_server_address_invalid");
  }
  return {
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
});

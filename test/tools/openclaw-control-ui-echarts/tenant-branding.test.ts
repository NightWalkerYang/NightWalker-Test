import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readBrandingState,
  restoreBrandingState,
  saveBrandingState,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/branding.mjs";
import { closeTenantPlatformDb, openTenantPlatformDb } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs";
import { createTenantPlatformRouter } from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs";

const cleanupRoots = new Set();
const cleanupServers = new Set();
const ONE_PIXEL_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nX9sAAAAASUVORK5CYII=";

function createSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-branding-"));
  cleanupRoots.add(root);
  const configDir = path.join(root, ".openclaw");
  const stateDir = path.join(configDir, "tenant-platform");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "openclaw.json"),
    JSON.stringify({
      agents: {
        list: [],
      },
    }),
    "utf8",
  );
  return {
    root,
    config: {
      edition: "cloud",
      bindHost: "127.0.0.1",
      port: 0,
      apiBasePath: "/tenant-platform-api/v1",
      configDir,
      configPath: path.join(configDir, "openclaw.json"),
      stateDir,
      dbPath: path.join(stateDir, "tenant-platform.sqlite"),
      sessionSecret: "tenant-platform-branding-test-secret",
      localLicensePath: path.join(stateDir, "local-license.json"),
      localLicensePublicKey: "",
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
    throw new Error("tenant_branding_server_address_invalid");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}${sandbox.config.apiBasePath}`,
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

async function createPlatformAdminSession(baseUrl) {
  const setup = await requestJson(baseUrl, "/setup/platform-admin", {
    method: "POST",
    body: {
      username: "platform-root",
      password: "secret",
    },
  });
  expect(setup.status).toBe(200);
  return String(setup.payload?.data?.token || "");
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

describe("tenant platform branding state", () => {
  it("returns built-in branding defaults when no machine-local brand file exists", () => {
    const sandbox = createSandbox();

    const state = readBrandingState(sandbox.config);

    expect(state.brandName).toBe("苏博泰克");
    expect(state.pageTitle).toBe("苏博泰克");
    expect(state.logoMode).toBe("text");
    expect(state.logoText).toBe("SPTC");
    expect(state.logoImage).toBeNull();
  });

  it("persists and restores machine-local text branding", () => {
    const sandbox = createSandbox();

    const saved = saveBrandingState(sandbox.config, {
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "text",
      logoText: "ACME",
    });

    expect(saved.brandName).toBe("Acme AI");
    expect(saved.pageTitle).toBe("Acme AI Console");
    expect(saved.logoMode).toBe("text");
    expect(saved.logoText).toBe("ACME");
    expect(saved.revision).toBeTruthy();

    const restored = readBrandingState(sandbox.config);
    expect(restored.brandName).toBe("Acme AI");
    expect(restored.logoText).toBe("ACME");

    const fallback = restoreBrandingState(sandbox.config);
    expect(fallback.brandName).toBe("苏博泰克");
    expect(fallback.logoText).toBe("SPTC");
  });

  it("persists machine-local image branding and exposes a public logo source", () => {
    const sandbox = createSandbox();

    const saved = saveBrandingState(sandbox.config, {
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "image",
      logoImageDataUrl: ONE_PIXEL_PNG_DATA_URL,
    });

    expect(saved.brandName).toBe("Acme AI");
    expect(saved.logoMode).toBe("image");
    expect(saved.logoText).toBe("");
    expect(saved.logoImage).toMatchObject({
      mimeType: "image/png",
    });
    expect(String(saved.logoImage?.src || "")).toContain("/tenant-platform-api/v1/public/branding/logo");
  });

  it("keeps the existing machine-local image logo when only the name or title changes", () => {
    const sandbox = createSandbox();

    saveBrandingState(sandbox.config, {
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "image",
      logoImageDataUrl: ONE_PIXEL_PNG_DATA_URL,
    });

    const updated = saveBrandingState(sandbox.config, {
      brandName: "Acme AI Plus",
      pageTitle: "Acme AI Console Plus",
      logoMode: "image",
      keepExistingLogoImage: true,
    });

    expect(updated.brandName).toBe("Acme AI Plus");
    expect(updated.pageTitle).toBe("Acme AI Console Plus");
    expect(updated.logoMode).toBe("image");
    expect(updated.logoImage).toMatchObject({
      mimeType: "image/png",
    });
    expect(String(updated.logoImage?.src || "")).toContain(
      "/tenant-platform-api/v1/public/branding/logo",
    );
  });
});

describe("tenant platform branding routes", () => {
  it("serves public branding without authentication", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);

    const response = await requestJson(baseUrl, "/public/branding");

    expect(response.status).toBe(200);
    expect(response.payload?.data?.brandName).toBe("苏博泰克");
    expect(response.payload?.data?.logoText).toBe("SPTC");
  });

  it("lets platform admins save branding and exposes the saved result publicly", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);
    const token = await createPlatformAdminSession(baseUrl);

    const saved = await requestJson(baseUrl, "/platform/branding", {
      method: "PUT",
      token,
      body: {
        brandName: "Acme AI",
        pageTitle: "Acme AI Console",
        logoMode: "text",
        logoText: "ACME",
      },
    });

    expect(saved.status).toBe(200);
    expect(saved.payload?.data?.brandName).toBe("Acme AI");
    expect(saved.payload?.data?.logoText).toBe("ACME");

    const publicState = await requestJson(baseUrl, "/public/branding");
    expect(publicState.status).toBe(200);
    expect(publicState.payload?.data?.brandName).toBe("Acme AI");
    expect(publicState.payload?.data?.logoText).toBe("ACME");
  });

  it("serves the stored logo asset publicly for image branding and restores defaults", async () => {
    const sandbox = createSandbox();
    const { baseUrl } = await startSandboxServer(sandbox);
    const token = await createPlatformAdminSession(baseUrl);

    const saved = await requestJson(baseUrl, "/platform/branding", {
      method: "PUT",
      token,
      body: {
        brandName: "Acme AI",
        pageTitle: "Acme AI Console",
        logoMode: "image",
        logoImageDataUrl: ONE_PIXEL_PNG_DATA_URL,
      },
    });

    expect(saved.status).toBe(200);
    expect(saved.payload?.data?.logoMode).toBe("image");
    expect(saved.payload?.data?.logoText).toBe("");

    const logoResponse = await fetch(`${baseUrl}/public/branding/logo`);
    expect(logoResponse.status).toBe(200);
    expect(logoResponse.headers.get("content-type")).toBe("image/png");
    expect((await logoResponse.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const restored = await requestJson(baseUrl, "/platform/branding", {
      method: "DELETE",
      token,
    });
    expect(restored.status).toBe(200);
    expect(restored.payload?.data?.brandName).toBe("苏博泰克");
    expect(restored.payload?.data?.logoMode).toBe("text");
    expect(restored.payload?.data?.logoText).toBe("SPTC");
  });
});

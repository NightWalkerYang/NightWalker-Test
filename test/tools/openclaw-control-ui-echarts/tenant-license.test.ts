import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyLocalRenewalCode,
  importLocalLicense,
  readLocalLicenseState,
} from "../../../tools/openclaw-control-ui-echarts/sidecar/tenant-platform/license.mjs";

const cleanupRoots = new Set();

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

function createSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-license-"));
  cleanupRoots.add(root);
  const stateDir = path.join(root, "tenant-platform");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    root,
    privateKey,
    config: {
      edition: "local",
      stateDir,
      localLicensePath: path.join(stateDir, "local-license.json"),
      localLicensePublicKey: publicKey.export({ type: "spki", format: "pem" }).toString("utf8"),
      localLicensePublicKeyPath: path.join(stateDir, "license-public.pem"),
    },
  };
}

function signLicense(privateKey, overrides = {}) {
  const issuedAt = overrides.issuedAt ?? "2026-04-01T00:00:00.000Z";
  const expiresAt = overrides.expiresAt ?? "2026-05-01T00:00:00.000Z";
  const unsigned = {
    licenseId: overrides.licenseId ?? "license-local-001",
    customerName: overrides.customerName ?? "苏博泰克本地客户",
    deploymentMode: overrides.deploymentMode ?? "local",
    issuedAt,
    expiresAt,
  };
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(stableStringify(unsigned));
  signer.end();
  const signature = encodeBase64Url(signer.sign(privateKey));
  return {
    ...unsigned,
    signature,
  };
}

afterEach(() => {
  for (const root of cleanupRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  cleanupRoots.clear();
});

describe("tenant local license", () => {
  it("imports a signed local license and reports an active state", () => {
    const sandbox = createSandbox();
    const license = signLicense(sandbox.privateKey, {
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const state = importLocalLicense(sandbox.config, license);

    expect(state.status).toBe("active");
    expect(state.valid).toBe(true);
    expect(state.customerName).toBe("苏博泰克本地客户");
    expect(fs.existsSync(sandbox.config.localLicensePath)).toBe(true);
    expect(readLocalLicenseState(sandbox.config).status).toBe("active");
  });

  it("accepts a renewal code and replaces the stored license snapshot", () => {
    const sandbox = createSandbox();
    importLocalLicense(
      sandbox.config,
      signLicense(sandbox.privateKey, {
        licenseId: "license-local-old",
        expiresAt: "2026-05-01T00:00:00.000Z",
      }),
    );

    const renewedPayload = signLicense(sandbox.privateKey, {
      licenseId: "license-local-new",
      expiresAt: "2099-06-01T00:00:00.000Z",
    });
    const renewalCode = encodeBase64Url(Buffer.from(JSON.stringify(renewedPayload), "utf8"));

    const state = applyLocalRenewalCode(sandbox.config, renewalCode);

    expect(state.status).toBe("active");
    expect(state.licenseId).toBe("license-local-new");
    expect(readLocalLicenseState(sandbox.config).licenseId).toBe("license-local-new");
  });

  it("reports expired licenses as readonly", () => {
    const sandbox = createSandbox();
    importLocalLicense(
      sandbox.config,
      signLicense(sandbox.privateKey, {
        expiresAt: "2026-04-01T00:00:01.000Z",
      }),
    );

    const state = readLocalLicenseState(sandbox.config);

    expect(state.status).toBe("expired");
    expect(state.readonly).toBe(true);
  });
});

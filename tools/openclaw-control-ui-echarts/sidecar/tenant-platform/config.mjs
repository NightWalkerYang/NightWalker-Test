import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_PORT = 18801;
const DEFAULT_API_BASE_PATH = "/tenant-platform-api/v1";
const DEFAULT_TENANT_PLATFORM_EDITION = "cloud";

function resolveHomeDir() {
  return process.env.HOME?.trim() || os.homedir();
}

function resolveConfigDir() {
  const explicit = process.env.OPENCLAW_CONFIG_DIR?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(resolveHomeDir(), ".openclaw");
}

function resolveConfigFilePath(configDir) {
  const explicit = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(configDir, "openclaw.json");
}

function resolveEdition(env) {
  return String(env.OPENCLAW_TENANT_PLATFORM_EDITION || DEFAULT_TENANT_PLATFORM_EDITION)
    .trim()
    .toLowerCase() === "local"
    ? "local"
    : "cloud";
}

function parsePort(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function resolveTenantPlatformConfig(env = process.env) {
  const configDir = resolveConfigDir();
  const stateDir = path.join(configDir, "tenant-platform");
  const edition = resolveEdition(env);
  const dbPath =
    env.OPENCLAW_TENANT_PLATFORM_DB_PATH?.trim() ||
    path.join(stateDir, "tenant-platform.sqlite");
  const bindHost = env.OPENCLAW_TENANT_PLATFORM_BIND?.trim() || "0.0.0.0";
  const port = parsePort(env.OPENCLAW_TENANT_PLATFORM_PORT, DEFAULT_PORT);
  const apiBasePath =
    env.OPENCLAW_TENANT_PLATFORM_API_BASE?.trim() || DEFAULT_API_BASE_PATH;
  const sessionSecret =
    env.OPENCLAW_TENANT_PLATFORM_SESSION_SECRET?.trim() ||
    env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    "openclaw-tenant-platform-dev-secret";
  const configPath = resolveConfigFilePath(configDir);
  const localLicensePath =
    env.OPENCLAW_TENANT_PLATFORM_LICENSE_PATH?.trim() ||
    path.join(stateDir, "local-license.json");
  const localLicensePublicKey =
    env.OPENCLAW_TENANT_PLATFORM_LICENSE_PUBLIC_KEY?.trim() || "";
  const localLicensePublicKeyPath =
    env.OPENCLAW_TENANT_PLATFORM_LICENSE_PUBLIC_KEY_PATH?.trim() ||
    path.join(stateDir, "license-public.pem");

  return {
    edition,
    bindHost,
    port,
    apiBasePath,
    configDir,
    configPath,
    stateDir,
    dbPath,
    sessionSecret,
    localLicensePath,
    localLicensePublicKey,
    localLicensePublicKeyPath,
  };
}

export function ensureTenantPlatformDirs(config) {
  fs.mkdirSync(config.stateDir, { recursive: true });
}

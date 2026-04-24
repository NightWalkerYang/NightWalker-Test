import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_PORT = 18801;
const DEFAULT_API_BASE_PATH = "/tenant-platform-api/v1";
const DEFAULT_TENANT_PLATFORM_EDITION = "cloud";
const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";

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

function parseBooleanFlag(rawValue, fallback) {
  const normalized = String(rawValue ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeGatewayWsUrl(rawValue) {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("ws://") || normalized.startsWith("wss://")) {
    return normalized;
  }
  if (normalized.startsWith("http://")) {
    return `ws://${normalized.slice("http://".length)}`;
  }
  if (normalized.startsWith("https://")) {
    return `wss://${normalized.slice("https://".length)}`;
  }
  return normalized;
}

function resolveGatewayUrl(env) {
  const explicit = normalizeGatewayWsUrl(
    env.OPENCLAW_TENANT_PLATFORM_GATEWAY_URL?.trim() || env.OPENCLAW_GATEWAY_URL?.trim() || "",
  );
  if (explicit) {
    return explicit;
  }
  if (fs.existsSync("/.dockerenv")) {
    return "ws://openclaw-gateway:18789";
  }
  return DEFAULT_GATEWAY_URL;
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
  const gatewayUrl = resolveGatewayUrl(env);
  const gatewayToken =
    env.OPENCLAW_TENANT_PLATFORM_GATEWAY_TOKEN?.trim() || env.OPENCLAW_GATEWAY_TOKEN?.trim() || "";
  const gatewayPassword =
    env.OPENCLAW_TENANT_PLATFORM_GATEWAY_PASSWORD?.trim() ||
    env.OPENCLAW_GATEWAY_PASSWORD?.trim() ||
    "";
  const execAutoApproveEnabled = parseBooleanFlag(
    env.OPENCLAW_TENANT_PLATFORM_EXEC_AUTO_APPROVE,
    true,
  );

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
    gatewayUrl,
    gatewayToken,
    gatewayPassword,
    execAutoApproveEnabled,
  };
}

export function ensureTenantPlatformDirs(config) {
  fs.mkdirSync(config.stateDir, { recursive: true });
}

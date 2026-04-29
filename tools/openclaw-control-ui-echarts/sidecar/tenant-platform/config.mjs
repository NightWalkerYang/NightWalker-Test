import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveAllinpaySidecarConfig } from "./allinpay.mjs";

const DEFAULT_PORT = 18801;
const DEFAULT_API_BASE_PATH = "/tenant-platform-api/v1";
const DEFAULT_TENANT_PLATFORM_EDITION = "cloud";
const DEFAULT_CONTROL_PLANE_NODE_ROLE = "control-plane";
const DEFAULT_MANAGED_NODE_ROLE = "managed-node";
const DEFAULT_STANDALONE_LOCAL_NODE_ROLE = "standalone-local";
const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const DEFAULT_MANAGED_NODE_SYNC_INTERVAL_MS = 15_000;

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

function resolveNodeRole(env, edition) {
  const explicit = String(env.OPENCLAW_TENANT_PLATFORM_NODE_ROLE || "")
    .trim()
    .toLowerCase();
  if (
    explicit === DEFAULT_CONTROL_PLANE_NODE_ROLE ||
    explicit === DEFAULT_MANAGED_NODE_ROLE ||
    explicit === DEFAULT_STANDALONE_LOCAL_NODE_ROLE
  ) {
    return explicit;
  }
  return edition === "local"
    ? DEFAULT_STANDALONE_LOCAL_NODE_ROLE
    : DEFAULT_CONTROL_PLANE_NODE_ROLE;
}

function parsePort(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parsePositiveInteger(rawValue, fallback) {
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

function normalizePublicBaseUrl(rawValue) {
  return String(rawValue ?? "")
    .trim()
    .replace(/\/+$/, "");
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

function resolveControlPlaneUrl(env) {
  return normalizePublicBaseUrl(env.OPENCLAW_TENANT_PLATFORM_CONTROL_PLANE_URL);
}

function resolveNodeId(env, nodeRole) {
  const explicit = String(env.OPENCLAW_TENANT_PLATFORM_NODE_ID || "")
    .trim()
    .toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (nodeRole === DEFAULT_MANAGED_NODE_ROLE) {
    return String(os.hostname() || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  return "";
}

function resolveNodeName(env) {
  return String(env.OPENCLAW_TENANT_PLATFORM_NODE_NAME || os.hostname() || "").trim();
}

export function resolveTenantPlatformConfig(env = process.env) {
  const configDir = resolveConfigDir();
  const stateDir = path.join(configDir, "tenant-platform");
  const edition = resolveEdition(env);
  const nodeRole = resolveNodeRole(env, edition);
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
  const publicBaseUrl = normalizePublicBaseUrl(env.OPENCLAW_TENANT_PLATFORM_PUBLIC_BASE_URL);
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
  const controlPlaneUrl = resolveControlPlaneUrl(env);
  const nodeId = resolveNodeId(env, nodeRole);
  const nodeName = resolveNodeName(env);
  const nodeSecret = String(env.OPENCLAW_TENANT_PLATFORM_NODE_SECRET || "").trim();
  const managedNodeSyncIntervalMs = parsePositiveInteger(
    env.OPENCLAW_TENANT_PLATFORM_SYNC_INTERVAL_MS,
    DEFAULT_MANAGED_NODE_SYNC_INTERVAL_MS,
  );
  const execAutoApproveEnabled = parseBooleanFlag(
    env.OPENCLAW_TENANT_PLATFORM_EXEC_AUTO_APPROVE,
    true,
  );
  const payments = {
    allinpay: resolveAllinpaySidecarConfig(env, {
      apiBasePath,
      publicBaseUrl,
    }),
  };

  return {
    edition,
    nodeRole,
    bindHost,
    port,
    apiBasePath,
    configDir,
    configPath,
    stateDir,
    dbPath,
    publicBaseUrl,
    sessionSecret,
    localLicensePath,
    localLicensePublicKey,
    localLicensePublicKeyPath,
    gatewayUrl,
    gatewayToken,
    gatewayPassword,
    controlPlaneUrl,
    nodeId,
    nodeName,
    nodeSecret,
    managedNodeSyncIntervalMs,
    execAutoApproveEnabled,
    payments,
  };
}

export function ensureTenantPlatformDirs(config) {
  fs.mkdirSync(config.stateDir, { recursive: true });
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_GATEWAY_TOKEN = "local-runtime-shared-token";
const AUTO_TOKEN_MARKER = "data-openclaw-auto-token-bootstrap";
const LUFENG_TOKEN_MARKER = "data-openclaw-lufeng-bootstrap";
const ECHARTS_VIEW_TOKEN_MARKER = "data-openclaw-echarts-view-bootstrap";
const TENANT_MEMBER_BOOTSTRAP_HOOK_NAME = "tenant-member-bootstrap-filter";
const MAIN_BUNDLE_PATTERN =
  /^\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+"><\/script>\s*$/m;
const AUTO_TOKEN_SRC = "./assets/runtime/branding/auto-token-preboot.js";
const LUFENG_TOKEN_SRC = "./assets/runtime/lufeng/preboot.js";
const ECHARTS_VIEW_SRC = "./assets/runtime/echarts-view/preboot.js";

function normalizeLine(line) {
  return String(line ?? "").replace(/^\uFEFF/, "").trim();
}

function unquoteEnvValue(value) {
  const normalized = String(value ?? "").trim();
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith("\"") && normalized.endsWith("\"")) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function resolvePathFromRoot(rootDir, rawPath, fallbackRelative) {
  const candidate = String(rawPath || "").trim() || fallbackRelative;
  return path.isAbsolute(candidate) ? candidate : path.resolve(rootDir, candidate);
}

function escapeHtmlAttribute(value) {
  return String(value ?? "").replace(/[&"<>\u2028\u2029]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "\"":
        return "&quot;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\u2028":
        return "&#8232;";
      case "\u2029":
        return "&#8233;";
      default:
        return char;
    }
  });
}

function buildBootstrapTag(marker, scriptSrc, token) {
  const normalizedToken = String(token ?? "").trim();
  if (!normalizedToken) {
    return "";
  }
  return `    <script src="${scriptSrc}" ${marker} data-gateway-token="${escapeHtmlAttribute(normalizedToken)}"></script>`;
}

function buildStaticBootstrapTag(marker, scriptSrc) {
  return `    <script type="module" src="${scriptSrc}" ${marker}></script>`;
}

function replaceTaggedScript(indexHtml, marker, nextTag) {
  const pattern = new RegExp(
    `^\\s*<script[^>]*${marker}[^>]*><\\/script>\\s*$`,
    "gm",
  );
  const cleaned = indexHtml.replace(pattern, "");
  if (!nextTag) {
    return cleaned;
  }
  if (MAIN_BUNDLE_PATTERN.test(cleaned)) {
    return cleaned.replace(MAIN_BUNDLE_PATTERN, `${nextTag}\n$&`);
  }
  if (!cleaned.includes("</head>")) {
    throw new Error("control_ui_index_missing_head");
  }
  return cleaned.replace("  </head>", `${nextTag}\n  </head>`);
}

export function parseRuntimeEnvFile(text) {
  const env = {};
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }
    env[key] = unquoteEnvValue(line.slice(separatorIndex + 1));
  }
  return env;
}

export function resolveRuntimePackageRoot(moduleUrl) {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..");
}

export function resolveRuntimeEnv(rootDir, processEnv = process.env) {
  const absoluteRootDir = path.resolve(rootDir);
  const runtimeEnvPath = path.join(absoluteRootDir, "runtime.env");
  const fileEnv = fs.existsSync(runtimeEnvPath)
    ? parseRuntimeEnvFile(fs.readFileSync(runtimeEnvPath, "utf8"))
    : {};
  const merged = { ...fileEnv, ...processEnv };
  const configDir = resolvePathFromRoot(
    absoluteRootDir,
    merged.OPENCLAW_CONFIG_DIR,
    "data/.openclaw",
  );
  const workspaceDir = resolvePathFromRoot(
    absoluteRootDir,
    merged.OPENCLAW_WORKSPACE_DIR,
    "data/workspace",
  );
  const runtimeDir = path.join(absoluteRootDir, "runtime");
  const packageRoot = path.join(runtimeDir, "node_modules", "openclaw");
  const tenantPlatformStateDir = path.join(configDir, "tenant-platform");
  const resolved = {
    ...merged,
    OPENCLAW_CONFIG_DIR: configDir,
    OPENCLAW_CONFIG_PATH: resolvePathFromRoot(
      absoluteRootDir,
      merged.OPENCLAW_CONFIG_PATH,
      path.join("data", ".openclaw", "openclaw.json"),
    ),
    OPENCLAW_WORKSPACE_DIR: workspaceDir,
    OPENCLAW_GATEWAY_BIND: String(merged.OPENCLAW_GATEWAY_BIND || "loopback").trim(),
    OPENCLAW_GATEWAY_PORT: String(merged.OPENCLAW_GATEWAY_PORT || "18789").trim(),
    OPENCLAW_GATEWAY_TOKEN: String(
      merged.OPENCLAW_GATEWAY_TOKEN || DEFAULT_GATEWAY_TOKEN,
    ).trim(),
    OPENCLAW_TENANT_PLATFORM_EDITION: "local",
    OPENCLAW_TENANT_PLATFORM_NODE_ROLE: "standalone-local",
    OPENCLAW_TENANT_PLATFORM_BIND: String(
      merged.OPENCLAW_TENANT_PLATFORM_BIND || "0.0.0.0",
    ).trim(),
    OPENCLAW_TENANT_PLATFORM_PORT: String(
      merged.OPENCLAW_TENANT_PLATFORM_PORT || "18801",
    ).trim(),
    OPENCLAW_TENANT_PLATFORM_API_BASE: String(
      merged.OPENCLAW_TENANT_PLATFORM_API_BASE || "/tenant-platform-api/v1",
    ).trim(),
    OPENCLAW_TENANT_PLATFORM_LICENSE_PATH: resolvePathFromRoot(
      absoluteRootDir,
      merged.OPENCLAW_TENANT_PLATFORM_LICENSE_PATH,
      path.join("data", ".openclaw", "tenant-platform", "local-license.json"),
    ),
    OPENCLAW_TENANT_PLATFORM_LICENSE_PUBLIC_KEY_PATH: resolvePathFromRoot(
      absoluteRootDir,
      merged.OPENCLAW_TENANT_PLATFORM_LICENSE_PUBLIC_KEY_PATH,
      path.join("data", ".openclaw", "tenant-platform", "license-public.pem"),
    ),
    OPENCLAW_TENANT_PLATFORM_LICENSE_PUBLIC_KEY: String(
      merged.OPENCLAW_TENANT_PLATFORM_LICENSE_PUBLIC_KEY || "",
    ).trim(),
  };
  return {
    env: resolved,
    runtimeEnvPath,
    runtimeDir,
    packageRoot,
    openclawEntry: path.join(packageRoot, "openclaw.mjs"),
    tenantPlatformEntry: path.join(
      packageRoot,
      "tools",
      "openclaw-control-ui-echarts",
      "sidecar",
      "tenant-platform",
      "server.mjs",
    ),
    controlUiIndexPath: path.join(packageRoot, "dist", "control-ui", "index.html"),
    workspaceDownloadsPath: path.join(packageRoot, "dist", "control-ui", "workspace-downloads"),
    workspaceAgentDownloadsPath: path.join(
      packageRoot,
      "dist",
      "control-ui",
      "workspace-agent-downloads",
    ),
    workspaceDir,
    workspaceAgentsDir: path.join(configDir, "workspace-agents"),
    tenantPlatformStateDir,
    logsDir: path.join(absoluteRootDir, "logs"),
  };
}

export function syncControlUiBootstrapScripts(indexHtml, gatewayToken) {
  const nextEchartsTag = buildStaticBootstrapTag(
    ECHARTS_VIEW_TOKEN_MARKER,
    ECHARTS_VIEW_SRC,
  );
  const nextAutoTokenTag = buildBootstrapTag(AUTO_TOKEN_MARKER, AUTO_TOKEN_SRC, gatewayToken);
  const nextLufengTag = buildBootstrapTag(LUFENG_TOKEN_MARKER, LUFENG_TOKEN_SRC, gatewayToken);
  return replaceTaggedScript(
    replaceTaggedScript(
      replaceTaggedScript(indexHtml, ECHARTS_VIEW_TOKEN_MARKER, nextEchartsTag),
      LUFENG_TOKEN_MARKER,
      nextLufengTag,
    ),
    AUTO_TOKEN_MARKER,
    nextAutoTokenTag,
  );
}

function readLinkTarget(linkPath) {
  try {
    return fs.realpathSync.native?.(linkPath) || fs.realpathSync(linkPath);
  } catch {
    return null;
  }
}

function ensureDirectoryLink(linkPath, targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  const normalizedTarget = path.normalize(targetPath);
  try {
    const currentStats = fs.lstatSync(linkPath);
    if (currentStats.isSymbolicLink()) {
      const currentTarget = readLinkTarget(linkPath);
      if (currentTarget && path.normalize(currentTarget) === normalizedTarget) {
        return;
      }
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {
    // create fresh below
  }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(
    targetPath,
    linkPath,
    process.platform === "win32" ? "junction" : "dir",
  );
}

function syncManagedHook(runtime, rootDir) {
  const sourceDir = path.join(
    rootDir,
    "runtime",
    "node_modules",
    "openclaw",
    "tools",
    "openclaw-control-ui-echarts",
    "workspace-overlays",
    "kingdee-cloud",
    "hooks",
    TENANT_MEMBER_BOOTSTRAP_HOOK_NAME,
  );
  if (!fs.existsSync(sourceDir)) {
    return;
  }
  const targetDir = path.join(
    runtime.env.OPENCLAW_CONFIG_DIR,
    "hooks",
    TENANT_MEMBER_BOOTSTRAP_HOOK_NAME,
  );
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

export function prepareLocalRuntime(rootDir, processEnv = process.env) {
  const resolved = resolveRuntimeEnv(rootDir, processEnv);
  fs.mkdirSync(resolved.env.OPENCLAW_CONFIG_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(resolved.env.OPENCLAW_CONFIG_PATH), { recursive: true });
  fs.mkdirSync(resolved.workspaceDir, { recursive: true });
  fs.mkdirSync(resolved.workspaceAgentsDir, { recursive: true });
  fs.mkdirSync(resolved.tenantPlatformStateDir, { recursive: true });
  fs.mkdirSync(resolved.logsDir, { recursive: true });
  if (!fs.existsSync(resolved.env.OPENCLAW_CONFIG_PATH)) {
    const defaultConfigTemplatePath = path.join(rootDir, "openclaw.local.example.json5");
    if (fs.existsSync(defaultConfigTemplatePath)) {
      fs.copyFileSync(defaultConfigTemplatePath, resolved.env.OPENCLAW_CONFIG_PATH);
    }
  }
  if (!fs.existsSync(resolved.openclawEntry)) {
    throw new Error(`missing_openclaw_entry:${resolved.openclawEntry}`);
  }
  if (!fs.existsSync(resolved.tenantPlatformEntry)) {
    throw new Error(`missing_tenant_platform_entry:${resolved.tenantPlatformEntry}`);
  }
  if (!fs.existsSync(resolved.controlUiIndexPath)) {
    throw new Error(`missing_control_ui_index:${resolved.controlUiIndexPath}`);
  }
  const nextIndexHtml = syncControlUiBootstrapScripts(
    fs.readFileSync(resolved.controlUiIndexPath, "utf8"),
    resolved.env.OPENCLAW_GATEWAY_TOKEN,
  );
  fs.writeFileSync(resolved.controlUiIndexPath, nextIndexHtml, "utf8");
  ensureDirectoryLink(resolved.workspaceDownloadsPath, resolved.workspaceDir);
  ensureDirectoryLink(resolved.workspaceAgentDownloadsPath, resolved.workspaceAgentsDir);
  syncManagedHook(resolved, rootDir);
  return resolved;
}

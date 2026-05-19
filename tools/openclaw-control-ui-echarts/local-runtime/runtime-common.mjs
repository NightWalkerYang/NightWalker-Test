import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_GATEWAY_TOKEN = "local-runtime-shared-token";
const DEFAULT_DIRECT_DOCKER_PACKAGE_ROOT = "/app";
const AUTO_TOKEN_MARKER = "data-openclaw-auto-token-bootstrap";
const LUFENG_TOKEN_MARKER = "data-openclaw-lufeng-bootstrap";
const ECHARTS_VIEW_TOKEN_MARKER = "data-openclaw-echarts-view-bootstrap";
const TENANT_PREBOOT_MARKER = "data-openclaw-tenant-preboot";
const TENANT_BOOT_LOCK_STYLE_MARKER = "data-openclaw-tenant-boot-lock-style";
const BUILD_MANIFEST_FILENAME = "openclaw-control-ui-build-manifest.json";
const TENANT_MEMBER_BOOTSTRAP_HOOK_NAME = "tenant-member-bootstrap-filter";
const DIRECT_DOCKER_PROXY_CONFIG_RELATIVE_PATH = path.join("docker-local-proxy", "nginx.conf");
const MAIN_BUNDLE_PATTERN =
  /^\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+"><\/script>\s*$/m;
const DEFAULT_RUNTIME_ASSET_BASE_PATH = "./assets/runtime";

function normalizeLine(line) {
  return String(line ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizePosixPath(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function collectFilesRecursively(rootDir) {
  const files = [];
  const walk = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      files.push({
        fullPath,
        relativePath: normalizePosixPath(path.relative(rootDir, fullPath)),
      });
    }
  };
  walk(rootDir);
  return files;
}

function unquoteEnvValue(value) {
  const normalized = String(value ?? "").trim();
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
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
      case '"':
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

function normalizeRuntimeAssetBasePath(basePath) {
  const normalized = String(basePath || "").trim() || DEFAULT_RUNTIME_ASSET_BASE_PATH;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function resolveRuntimeAssetBasePath(indexHtml) {
  const html = String(indexHtml ?? "");
  const patterns = [
    /<script[^>]*\ssrc="([^"]+)"[^>]*\sdata-openclaw-echarts-view-bootstrap[^>]*><\/script>/i,
    /<script[^>]*\ssrc="([^"]+)"[^>]*\sdata-openclaw-auto-token-bootstrap[^>]*><\/script>/i,
    /<script[^>]*\ssrc="([^"]+)"[^>]*\sdata-openclaw-lufeng-bootstrap[^>]*><\/script>/i,
    /<script[^>]*\sdata-openclaw-echarts-view-bootstrap[^>]*\ssrc="([^"]+)"[^>]*><\/script>/i,
    /<script[^>]*\sdata-openclaw-auto-token-bootstrap[^>]*\ssrc="([^"]+)"[^>]*><\/script>/i,
    /<script[^>]*\sdata-openclaw-lufeng-bootstrap[^>]*\ssrc="([^"]+)"[^>]*><\/script>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const scriptSrc = String(match?.[1] || "").trim();
    if (!scriptSrc) {
      continue;
    }
    const runtimeSuffixes = [
      "/echarts-view/preboot.js",
      "/branding/auto-token-preboot.js",
      "/lufeng/preboot.js",
    ];
    for (const suffix of runtimeSuffixes) {
      if (scriptSrc.endsWith(suffix)) {
        const basePath = scriptSrc.slice(0, -suffix.length);
        if (basePath) {
          return basePath;
        }
      }
    }
  }
  return DEFAULT_RUNTIME_ASSET_BASE_PATH;
}

function replaceTaggedScript(indexHtml, marker, nextTag) {
  const pattern = new RegExp(`^\\s*<script[^>]*${marker}[^>]*><\\/script>\\s*$`, "gm");
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

function escapeRegexFragment(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMarker(indexHtml, marker) {
  const matches = String(indexHtml ?? "").match(new RegExp(escapeRegexFragment(marker), "g"));
  return matches ? matches.length : 0;
}

function resolveMarkerScriptSrc(indexHtml, marker) {
  const escapedMarker = escapeRegexFragment(marker);
  const patterns = [
    new RegExp(`<script[^>]*\\ssrc="([^"]+)"[^>]*\\s${escapedMarker}[^>]*><\\/script>`, "i"),
    new RegExp(`<script[^>]*\\s${escapedMarker}[^>]*\\ssrc="([^"]+)"[^>]*><\\/script>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = String(indexHtml ?? "").match(pattern);
    const src = String(match?.[1] ?? "").trim();
    if (src) {
      return src;
    }
  }
  return "";
}

function resolveMarkerGatewayToken(indexHtml, marker) {
  const escapedMarker = escapeRegexFragment(marker);
  const patterns = [
    new RegExp(
      `<script[^>]*\\sdata-gateway-token="([^"]*)"[^>]*\\s${escapedMarker}[^>]*><\\/script>`,
      "i",
    ),
    new RegExp(
      `<script[^>]*\\s${escapedMarker}[^>]*\\sdata-gateway-token="([^"]*)"[^>]*><\\/script>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = String(indexHtml ?? "").match(pattern);
    if (match) {
      return String(match[1] ?? "").trim();
    }
  }
  return "";
}

function resolveControlUiAssetPath(controlUiRoot, scriptSrc) {
  const trimmed = String(scriptSrc ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const withoutQuery = trimmed.split("?")[0].split("#")[0];
  if (withoutQuery.startsWith("/")) {
    return path.join(controlUiRoot, withoutQuery.slice(1));
  }
  const withoutDotSlash = withoutQuery.startsWith("./") ? withoutQuery.slice(2) : withoutQuery;
  return path.join(controlUiRoot, withoutDotSlash);
}

function ensurePreflight(condition, code, detail) {
  if (!condition) {
    throw new Error(`${code}:${detail}`);
  }
}

function readControlUiBuildManifest(controlUiRoot) {
  const manifestPath = path.join(controlUiRoot, BUILD_MANIFEST_FILENAME);
  ensurePreflight(
    fs.existsSync(manifestPath),
    "control_ui_preflight_manifest_missing",
    `${manifestPath} not found. Rebuild via tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs.`,
  );
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`control_ui_preflight_manifest_invalid:${manifestPath}: ${message}`);
  }
  ensurePreflight(
    manifest && typeof manifest === "object",
    "control_ui_preflight_manifest_invalid",
    `${manifestPath} must contain a JSON object.`,
  );
  return { manifestPath, manifest };
}

function computeRuntimeAssetFingerprint(toolRoot) {
  const normalizedToolRoot = path.resolve(String(toolRoot || ""));
  const runtimeScriptPath = path.join(normalizedToolRoot, "openclaw-echarts-renderer.js");
  const runtimeDir = path.join(normalizedToolRoot, "runtime");
  const staticDir = path.join(normalizedToolRoot, "static");
  const vendorDir = path.join(normalizedToolRoot, "vendor");
  const proxyConfigPath = path.join(normalizedToolRoot, DIRECT_DOCKER_PROXY_CONFIG_RELATIVE_PATH);

  ensurePreflight(
    fs.existsSync(runtimeScriptPath) && fs.statSync(runtimeScriptPath).isFile(),
    "control_ui_preflight_source_missing",
    `${runtimeScriptPath} missing`,
  );
  for (const directory of [runtimeDir, staticDir, vendorDir]) {
    ensurePreflight(
      fs.existsSync(directory) && fs.statSync(directory).isDirectory(),
      "control_ui_preflight_source_missing",
      `${directory} missing`,
    );
  }

  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(runtimeScriptPath));
  for (const directory of [runtimeDir, staticDir, vendorDir]) {
    for (const file of collectFilesRecursively(directory)) {
      hash.update(`\nfile:${file.relativePath}\n`);
      hash.update(fs.readFileSync(file.fullPath));
    }
  }
  ensurePreflight(
    fs.existsSync(proxyConfigPath) && fs.statSync(proxyConfigPath).isFile(),
    "control_ui_preflight_proxy_config_missing",
    `${proxyConfigPath} missing`,
  );
  hash.update("\nfile:docker-local-proxy/nginx.conf\n");
  hash.update(fs.readFileSync(proxyConfigPath));
  return hash.digest("hex").slice(0, 16);
}

function assertDirectDockerProxySourceContract(toolRoot) {
  const normalizedToolRoot = path.resolve(String(toolRoot || ""));
  const proxyConfigPath = path.join(normalizedToolRoot, DIRECT_DOCKER_PROXY_CONFIG_RELATIVE_PATH);
  ensurePreflight(
    fs.existsSync(proxyConfigPath) && fs.statSync(proxyConfigPath).isFile(),
    "control_ui_preflight_proxy_config_missing",
    `${proxyConfigPath} missing`,
  );
  const proxyConfigText = fs.readFileSync(proxyConfigPath, "utf8");
  ensurePreflight(
    /^\s*include\s+\/etc\/nginx\/mime\.types;/m.test(proxyConfigText),
    "control_ui_preflight_proxy_mime_missing",
    `${proxyConfigPath} must include /etc/nginx/mime.types so /workspace-agent-downloads/*.js does not return text/plain.`,
  );
  ensurePreflight(
    /location\s+\/workspace-downloads\//m.test(proxyConfigText),
    "control_ui_preflight_proxy_workspace_downloads_missing",
    `${proxyConfigPath} must expose /workspace-downloads/.`,
  );
  ensurePreflight(
    /location\s+\/workspace-agent-downloads\//m.test(proxyConfigText),
    "control_ui_preflight_proxy_workspace_agent_downloads_missing",
    `${proxyConfigPath} must expose /workspace-agent-downloads/.`,
  );
}

function readManifestString(manifest, key, label) {
  const value = String(manifest?.[key] ?? "").trim();
  ensurePreflight(
    !!value,
    "control_ui_preflight_manifest_field_missing",
    `${label} is missing in ${BUILD_MANIFEST_FILENAME}. Rebuild via build-custom-control-ui.mjs.`,
  );
  return value;
}

function assertManifestPathExists(controlUiRoot, manifestPathValue, label) {
  const assetPath = resolveControlUiAssetPath(controlUiRoot, manifestPathValue);
  ensurePreflight(
    !!assetPath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile(),
    "control_ui_preflight_asset_missing",
    `${label} is missing at ${assetPath || "unknown path"}`,
  );
  return assetPath;
}

function shouldSkipControlUiPreflight(env) {
  const value = String(env?.OPENCLAW_SKIP_CONTROL_UI_PREFLIGHT ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

export function runControlUiPreflight(resolvedRuntime) {
  const controlUiIndexPath = resolvedRuntime.controlUiIndexPath;
  ensurePreflight(
    fs.existsSync(controlUiIndexPath),
    "control_ui_preflight_index_missing",
    controlUiIndexPath,
  );
  const controlUiRoot = path.dirname(controlUiIndexPath);
  const indexHtml = fs.readFileSync(controlUiIndexPath, "utf8");
  const { manifest } = readControlUiBuildManifest(controlUiRoot);
  const sourceMainBundleScriptSrc = readManifestString(
    manifest,
    "sourceMainBundleScriptSrc",
    "sourceMainBundleScriptSrc",
  );
  const runtimeAssetBaseRelativePath = normalizeRuntimeAssetBasePath(
    readManifestString(manifest, "runtimeAssetBaseRelativePath", "runtimeAssetBaseRelativePath"),
  );
  const rendererAssetRelativePath = readManifestString(
    manifest,
    "rendererAssetRelativePath",
    "rendererAssetRelativePath",
  );
  const rendererAssetAbsolutePath = readManifestString(
    manifest,
    "rendererAssetAbsolutePath",
    "rendererAssetAbsolutePath",
  );

  ensurePreflight(
    indexHtml.includes(sourceMainBundleScriptSrc),
    "control_ui_preflight_main_bundle_missing",
    `main bundle ${sourceMainBundleScriptSrc} is missing from index.html`,
  );

  const markers = [
    {
      marker: TENANT_BOOT_LOCK_STYLE_MARKER,
      expectedSrc: "",
      requireToken: false,
      isInlineStyle: true,
    },
    {
      marker: ECHARTS_VIEW_TOKEN_MARKER,
      expectedSrc: `${runtimeAssetBaseRelativePath}/echarts-view/preboot.js`,
      requireToken: false,
    },
    {
      marker: TENANT_PREBOOT_MARKER,
      expectedSrc: `${runtimeAssetBaseRelativePath}/tenant/preboot.js`,
      requireToken: false,
    },
    {
      marker: LUFENG_TOKEN_MARKER,
      expectedSrc: `${runtimeAssetBaseRelativePath}/lufeng/preboot.js`,
      requireToken: true,
    },
    {
      marker: AUTO_TOKEN_MARKER,
      expectedSrc: `${runtimeAssetBaseRelativePath}/branding/auto-token-preboot.js`,
      requireToken: true,
    },
  ];

  for (const { marker, expectedSrc, requireToken, isInlineStyle } of markers) {
    const markerCount = countMarker(indexHtml, marker);
    ensurePreflight(
      markerCount === 1,
      "control_ui_preflight_marker_count_mismatch",
      `${marker} expected 1, got ${markerCount}`,
    );
    if (isInlineStyle) {
      ensurePreflight(
        indexHtml.includes("data-oc-tenant-boot-lock"),
        "control_ui_preflight_boot_lock_style_missing",
        `${marker} is missing the data-oc-tenant-boot-lock selector`,
      );
      continue;
    }
    const markerSrc = resolveMarkerScriptSrc(indexHtml, marker);
    ensurePreflight(
      markerSrc === expectedSrc,
      "control_ui_preflight_marker_src_mismatch",
      `${marker} expected ${expectedSrc}, got ${markerSrc || "missing"}`,
    );
    assertManifestPathExists(controlUiRoot, markerSrc, `${marker} script`);
    if (requireToken) {
      const markerToken = resolveMarkerGatewayToken(indexHtml, marker);
      ensurePreflight(
        !!markerToken,
        "control_ui_preflight_marker_token_missing",
        `${marker} missing data-gateway-token. Rebuild with OPENCLAW_GATEWAY_TOKEN set.`,
      );
    }
  }

  assertManifestPathExists(controlUiRoot, rendererAssetRelativePath, "renderer asset");

  const loginIndexPath = path.join(controlUiRoot, "login", "index.html");
  const loginHtmlPath = path.join(controlUiRoot, "login.html");
  const echartsViewIndexPath = path.join(controlUiRoot, "echarts-view", "index.html");
  ensurePreflight(
    fs.existsSync(loginIndexPath) && fs.statSync(loginIndexPath).isFile(),
    "control_ui_preflight_login_alias_missing",
    `${loginIndexPath} missing`,
  );
  ensurePreflight(
    fs.existsSync(loginHtmlPath) && fs.statSync(loginHtmlPath).isFile(),
    "control_ui_preflight_login_alias_missing",
    `${loginHtmlPath} missing`,
  );
  ensurePreflight(
    fs.existsSync(echartsViewIndexPath) && fs.statSync(echartsViewIndexPath).isFile(),
    "control_ui_preflight_echarts_view_missing",
    `${echartsViewIndexPath} missing`,
  );

  const loginIndexHtml = fs.readFileSync(loginIndexPath, "utf8");
  const loginHtml = fs.readFileSync(loginHtmlPath, "utf8");
  ensurePreflight(
    loginIndexHtml.includes('<base href="/" />') && loginHtml.includes('<base href="/" />'),
    "control_ui_preflight_login_base_missing",
    'login aliases must include <base href="/" />',
  );

  const echartsViewIndexHtml = fs.readFileSync(echartsViewIndexPath, "utf8");
  ensurePreflight(
    echartsViewIndexHtml.includes(rendererAssetAbsolutePath),
    "control_ui_preflight_echarts_view_renderer_mismatch",
    `${echartsViewIndexPath} is missing ${rendererAssetAbsolutePath}`,
  );

  return {
    runtimeAssetBaseRelativePath,
    rendererAssetRelativePath,
    rendererAssetAbsolutePath,
    deploymentDecision: manifest?.deploymentDecision ?? null,
  };
}

export function runDirectDockerControlUiFreshnessPreflight({
  controlUiRoot,
  toolRoot,
  gatewayToken,
}) {
  const normalizedControlUiRoot = path.resolve(String(controlUiRoot || ""));
  const normalizedToolRoot = path.resolve(String(toolRoot || ""));
  assertDirectDockerProxySourceContract(normalizedToolRoot);
  const { manifestPath, manifest } = readControlUiBuildManifest(normalizedControlUiRoot);
  const runtimeFingerprint = readManifestString(
    manifest,
    "runtimeFingerprint",
    "runtimeFingerprint",
  );
  const expectedRuntimeFingerprint = computeRuntimeAssetFingerprint(normalizedToolRoot);

  ensurePreflight(
    runtimeFingerprint === expectedRuntimeFingerprint,
    "control_ui_preflight_runtime_fingerprint_mismatch",
    [
      `${manifestPath} runtimeFingerprint=${runtimeFingerprint} does not match current zero-intrusive source fingerprint ${expectedRuntimeFingerprint}.`,
      `Mounted source root: ${normalizedToolRoot}.`,
      "Rebuild via node tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs or bash tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh.",
    ].join(" "),
  );

  const expectedGatewayToken = String(gatewayToken ?? "").trim();
  if (expectedGatewayToken) {
    const indexHtml = fs.readFileSync(path.join(normalizedControlUiRoot, "index.html"), "utf8");
    for (const marker of [AUTO_TOKEN_MARKER, LUFENG_TOKEN_MARKER]) {
      const markerToken = resolveMarkerGatewayToken(indexHtml, marker);
      ensurePreflight(
        markerToken === expectedGatewayToken,
        "control_ui_preflight_marker_token_mismatch",
        [
          `${marker} token does not match the current OPENCLAW_GATEWAY_TOKEN.`,
          "Rebuild via node tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs or bash tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh.",
        ].join(" "),
      );
    }
  }

  return {
    runtimeFingerprint,
    expectedRuntimeFingerprint,
  };
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
    OPENCLAW_GATEWAY_TOKEN: String(merged.OPENCLAW_GATEWAY_TOKEN || DEFAULT_GATEWAY_TOKEN).trim(),
    OPENCLAW_TENANT_PLATFORM_EDITION: "local",
    OPENCLAW_TENANT_PLATFORM_NODE_ROLE: "standalone-local",
    OPENCLAW_TENANT_PLATFORM_BIND: String(merged.OPENCLAW_TENANT_PLATFORM_BIND || "0.0.0.0").trim(),
    OPENCLAW_TENANT_PLATFORM_PORT: String(merged.OPENCLAW_TENANT_PLATFORM_PORT || "18801").trim(),
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

export function prepareDirectDockerGatewayRuntime(processEnv = process.env) {
  const packageRoot = path.resolve(
    String(processEnv.OPENCLAW_DIRECT_DOCKER_PACKAGE_ROOT || DEFAULT_DIRECT_DOCKER_PACKAGE_ROOT),
  );
  const env = {
    ...processEnv,
    OPENCLAW_GATEWAY_BIND: String(processEnv.OPENCLAW_GATEWAY_BIND || "lan").trim(),
    OPENCLAW_GATEWAY_PORT: String(processEnv.OPENCLAW_GATEWAY_PORT || "18789").trim(),
    OPENCLAW_GATEWAY_TOKEN: String(processEnv.OPENCLAW_GATEWAY_TOKEN || "").trim(),
  };
  const gatewayEntry = path.join(packageRoot, "dist", "index.js");
  const controlUiIndexPath = path.join(packageRoot, "dist", "control-ui", "index.html");

  ensurePreflight(
    fs.existsSync(gatewayEntry) && fs.statSync(gatewayEntry).isFile(),
    "missing_direct_docker_gateway_entry",
    gatewayEntry,
  );
  ensurePreflight(
    fs.existsSync(controlUiIndexPath) && fs.statSync(controlUiIndexPath).isFile(),
    "missing_control_ui_index",
    controlUiIndexPath,
  );

  const resolved = {
    env,
    packageRoot,
    gatewayEntry,
    controlUiIndexPath,
  };
  const controlUiPreflight = shouldSkipControlUiPreflight(env)
    ? null
    : runControlUiPreflight(resolved);
  let overlayFreshnessPreflight = null;
  if (!shouldSkipControlUiPreflight(env)) {
    const sourceRoot = String(env.OPENCLAW_DIRECT_DOCKER_CONTROL_UI_SOURCE_ROOT || "").trim();
    ensurePreflight(
      !!sourceRoot,
      "control_ui_preflight_direct_docker_source_root_missing",
      "OPENCLAW_DIRECT_DOCKER_CONTROL_UI_SOURCE_ROOT is required for direct-docker control-ui freshness checks.",
    );
    overlayFreshnessPreflight = runDirectDockerControlUiFreshnessPreflight({
      controlUiRoot: path.dirname(controlUiIndexPath),
      toolRoot: sourceRoot,
      gatewayToken: env.OPENCLAW_GATEWAY_TOKEN,
    });
  }

  return {
    ...resolved,
    controlUiPreflight,
    overlayFreshnessPreflight,
  };
}

export function syncControlUiBootstrapScripts(indexHtml, gatewayToken) {
  const runtimeAssetBasePath = resolveRuntimeAssetBasePath(indexHtml);
  const runtimeBasePath = normalizeRuntimeAssetBasePath(runtimeAssetBasePath);
  const nextEchartsTag = buildStaticBootstrapTag(
    ECHARTS_VIEW_TOKEN_MARKER,
    `${runtimeBasePath}/echarts-view/preboot.js`,
  );
  const nextAutoTokenTag = buildBootstrapTag(
    AUTO_TOKEN_MARKER,
    `${runtimeBasePath}/branding/auto-token-preboot.js`,
    gatewayToken,
  );
  const nextLufengTag = buildBootstrapTag(
    LUFENG_TOKEN_MARKER,
    `${runtimeBasePath}/lufeng/preboot.js`,
    gatewayToken,
  );
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
  fs.symlinkSync(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
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
  const controlUiPreflight = shouldSkipControlUiPreflight(resolved.env)
    ? null
    : runControlUiPreflight(resolved);
  const nextIndexHtml = syncControlUiBootstrapScripts(
    fs.readFileSync(resolved.controlUiIndexPath, "utf8"),
    resolved.env.OPENCLAW_GATEWAY_TOKEN,
  );
  fs.writeFileSync(resolved.controlUiIndexPath, nextIndexHtml, "utf8");
  ensureDirectoryLink(resolved.workspaceDownloadsPath, resolved.workspaceDir);
  ensureDirectoryLink(resolved.workspaceAgentDownloadsPath, resolved.workspaceAgentsDir);
  syncManagedHook(resolved, rootDir);
  return {
    ...resolved,
    controlUiPreflight,
  };
}

#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectAutoGatewayTokenBootstrap } from "./runtime/branding/auto-token.js";
import { getBrandFaviconDataUrl } from "./runtime/branding/favicon.js";
import { injectEchartsViewPublicBootstrap } from "./runtime/echarts-view/bootstrap.js";
import { injectLufengPublicBootstrap } from "./runtime/lufeng/bootstrap.js";
import { injectSandboxViewPublicBootstrap } from "./runtime/sandbox-view/bootstrap.js";

const MAIN_BUNDLE_PATTERN =
  /^\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+"><\/script>\s*$/m;
const MAIN_BUNDLE_CAPTURE_PATTERN =
  /<script type="module" crossorigin src="(?<src>\.\/assets\/index-[^"]+)"><\/script>/;
const RUNTIME_RENDERER_SCRIPT_PATTERN =
  /<script\s+type="module"\s+src="(?<src>[^"]*openclaw-echarts-renderer\.js[^"]*)"><\/script>/g;
const BOOTSTRAP_MARKERS = {
  tenantPreboot: "data-openclaw-tenant-preboot",
  autoToken: "data-openclaw-auto-token-bootstrap",
  lufeng: "data-openclaw-lufeng-bootstrap",
  echartsView: "data-openclaw-echarts-view-bootstrap",
  sandboxView: "data-openclaw-sandbox-view-bootstrap",
};
const TENANT_PREBOOT_PATTERN = /^\s*<script[^>]*data-openclaw-tenant-preboot[^>]*><\/script>\s*$/gm;
const DEFAULT_RUNTIME_ASSET_BASE_PATH = "./assets/runtime";
const BUILD_MANIFEST_FILENAME = "openclaw-control-ui-build-manifest.json";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const DEFAULT_SOURCE_DIR = path.join(repoRoot, "dist", "control-ui");
const DEFAULT_OUTPUT_DIR = path.join(here, "generated", "control-ui");
const ENV_FILE_PATH = path.join(repoRoot, ".env");
const CONTROL_UI_RUNTIME_SCRIPT_SOURCE = path.join(here, "openclaw-echarts-renderer.js");
const CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE = path.join(here, "runtime");
const CONTROL_UI_STATIC_DIR_SOURCE = path.join(here, "static");
const CONTROL_UI_VENDOR_DIR_SOURCE = path.join(here, "vendor");
const OFFLINE_BUNDLED_USERSCRIPT_SOURCE = path.join(
  repoRoot,
  "tools",
  "openclaw-echarts-userscript",
  "openclaw-echarts-renderer.user.js",
);
const EMBEDDED_LIBRARY_PATTERN =
  /const EMBEDDED_LIBRARY_SOURCES = \{\s*echarts:\s*(?<echarts>"(?:\\.|[^"\\])*"),\s*json5:\s*(?<json5>"(?:\\.|[^"\\])*"),\s*\};/s;

function usage() {
  process.stderr.write(
    [
      "Usage: node tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs [options]",
      "",
      "Options:",
      "  --source <path>  Source control-ui directory. Default: dist/control-ui",
      "  --output <path>  Output directory for the custom UI root.",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--source") {
      options.source = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--output") {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function resolveRepoPath(value, fallback) {
  if (!value) {
    return fallback;
  }
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function readDotenvValue(key) {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return undefined;
  }
  const lines = fs.readFileSync(ENV_FILE_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(`${key}=`)) {
      return line.slice(key.length + 1);
    }
  }
  return undefined;
}

function resolveConfigDir() {
  const configured = (
    process.env.OPENCLAW_CONFIG_DIR ??
    readDotenvValue("OPENCLAW_CONFIG_DIR") ??
    ""
  ).trim();
  if (!configured) {
    return path.join(os.homedir(), ".openclaw");
  }
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
}

function readGatewayTokenFromConfig() {
  const configPath = path.join(resolveConfigDir(), "openclaw.json");
  if (!fs.existsSync(configPath)) {
    return "";
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return String(parsed?.gateway?.auth?.token ?? "").trim();
  } catch {
    return "";
  }
}

function resolveAutoGatewayToken() {
  return (
    process.env.OPENCLAW_GATEWAY_TOKEN ??
    readDotenvValue("OPENCLAW_GATEWAY_TOKEN") ??
    readGatewayTokenFromConfig()
  ).trim();
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}`);
  }
}

function ensureDirectoryExists(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`${label} not found at ${dirPath}`);
  }
}

function ensureValuePresent(value, errorMessage) {
  if (!String(value ?? "").trim()) {
    throw new Error(errorMessage);
  }
}

function resetDirectoryContents(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    return;
  }
  if (!fs.statSync(outputDir).isDirectory()) {
    throw new Error(`Output directory path is not a directory: ${outputDir}`);
  }
  for (const entry of fs.readdirSync(outputDir)) {
    fs.rmSync(path.join(outputDir, entry), { recursive: true, force: true });
  }
}

function injectBeforeMainBundle(indexHtml, nextTag, cleanupPattern, label) {
  const cleaned = cleanupPattern ? indexHtml.replace(cleanupPattern, "") : indexHtml;
  if (!nextTag) {
    return cleaned;
  }
  if (MAIN_BUNDLE_PATTERN.test(cleaned)) {
    return cleaned.replace(MAIN_BUNDLE_PATTERN, `${nextTag}\n$&`);
  }
  if (!cleaned.includes("</head>")) {
    throw new Error(`index.html is missing </head>; cannot inject the ${label}.`);
  }
  return cleaned.replace("  </head>", `${nextTag}\n  </head>`);
}

function resolveRuntimeScriptSrc(runtimeAssetBasePath, relativePath) {
  const basePath = String(runtimeAssetBasePath ?? "").trim();
  const normalizedBasePath = basePath || DEFAULT_RUNTIME_ASSET_BASE_PATH;
  const baseWithSlash = normalizedBasePath.endsWith("/")
    ? normalizedBasePath
    : `${normalizedBasePath}/`;
  return `${baseWithSlash}${relativePath}`;
}

function injectTenantPreboot(indexHtml, options = {}) {
  const scriptTag = `    <script src="${resolveRuntimeScriptSrc(
    options.runtimeAssetBasePath,
    "tenant/preboot.js",
  )}" data-openclaw-tenant-preboot></script>`;
  return injectBeforeMainBundle(indexHtml, scriptTag, TENANT_PREBOOT_PATTERN, "tenant preboot");
}

function replaceBrandFavicons(indexHtml) {
  const lines = indexHtml.split(/\r?\n/);
  const filtered = lines.filter(
    (line) =>
      !/<link\s+rel="icon"/i.test(line) &&
      !/<link\s+rel="shortcut icon"/i.test(line) &&
      !/<link\s+rel="apple-touch-icon"/i.test(line),
  );

  const headCloseIndex = filtered.findIndex((line) => line.includes("</head>"));
  if (headCloseIndex === -1) {
    throw new Error("index.html is missing </head>; cannot replace favicon links.");
  }

  const href = getBrandFaviconDataUrl();
  filtered.splice(
    headCloseIndex,
    0,
    `    <link rel="icon" type="image/svg+xml" href="${href}" />`,
    `    <link rel="shortcut icon" type="image/svg+xml" href="${href}" />`,
    `    <link rel="apple-touch-icon" type="image/svg+xml" href="${href}" />`,
  );

  return filtered.join("\n");
}

function copyFileIntoOutput(sourceFile, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.copyFileSync(sourceFile, outputFile);
}

function writeTextIntoOutput(content, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, content, "utf8");
}

function copyVendorDirectoryIntoOutput(sourceDir, outputDir) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    return;
  }
  fs.cpSync(sourceDir, outputDir, {
    recursive: true,
    force: true,
  });
}

function buildLoginEntryHtml(indexHtml) {
  if (/<base\s+[^>]*href\s*=/.test(indexHtml)) {
    return indexHtml;
  }
  if (!indexHtml.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot create /login entry.");
  }
  return indexHtml.replace("</head>", '    <base href="/" />\n  </head>');
}

function normalizePosixPath(value) {
  return value.replace(/\\/g, "/");
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
      const relativePath = normalizePosixPath(path.relative(rootDir, fullPath));
      files.push({ fullPath, relativePath });
    }
  };
  walk(rootDir);
  return files;
}

function computeRuntimeAssetFingerprint() {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(CONTROL_UI_RUNTIME_SCRIPT_SOURCE));

  const directories = [
    CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE,
    CONTROL_UI_STATIC_DIR_SOURCE,
    CONTROL_UI_VENDOR_DIR_SOURCE,
  ];
  for (const directory of directories) {
    const files = collectFilesRecursively(directory);
    for (const file of files) {
      hash.update(`\nfile:${file.relativePath}\n`);
      hash.update(fs.readFileSync(file.fullPath));
    }
  }
  return hash.digest("hex").slice(0, 16);
}

function computeDirectoryFingerprint(rootDir) {
  const hash = crypto.createHash("sha256");
  const files = collectFilesRecursively(rootDir);
  for (const file of files) {
    hash.update(`\nfile:${file.relativePath}\n`);
    hash.update(fs.readFileSync(file.fullPath));
  }
  return hash.digest("hex").slice(0, 16);
}

function extractMainBundleScriptSrc(indexHtml) {
  const match = String(indexHtml ?? "").match(MAIN_BUNDLE_CAPTURE_PATTERN);
  const src = String(match?.groups?.src ?? "").trim();
  if (!src) {
    throw new Error(
      "source index is missing the main Vite bundle script; upstream Control UI HTML changed and injection selectors must be updated.",
    );
  }
  return src;
}

function readPreviousBuildManifest(outputDir) {
  const manifestPath = path.join(outputDir, BUILD_MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse previous build manifest at ${manifestPath}: ${message}`);
  }
}

function classifyDeploymentDecision(previousManifest, sourceFingerprint, runtimeFingerprint) {
  if (!previousManifest || typeof previousManifest !== "object") {
    return {
      mode: "overlay-baseline-missing",
      zeroIntrusiveOnly: false,
      requiresGatewayImageRebuild: true,
      requiresGatewayImageRebuildForImageSourcedDeploy: true,
      requiresGatewayImageRebuildForHostDistDeploy: false,
      reason:
        "No previous build manifest found. Image-sourced deploys should rebuild the gateway image before extracting /app/dist/control-ui. Host-dist deploys can regenerate the zero-intrusive overlay without forcing a gateway image rebuild from this script.",
    };
  }
  const previousSourceFingerprint = String(previousManifest.sourceFingerprint ?? "").trim();
  const previousRuntimeFingerprint = String(previousManifest.runtimeFingerprint ?? "").trim();

  if (!previousSourceFingerprint || !previousRuntimeFingerprint) {
    return {
      mode: "previous-manifest-invalid",
      zeroIntrusiveOnly: false,
      requiresGatewayImageRebuild: true,
      requiresGatewayImageRebuildForImageSourcedDeploy: true,
      requiresGatewayImageRebuildForHostDistDeploy: false,
      reason:
        "Previous build manifest is missing source/runtime fingerprints. Image-sourced deploys should rebuild the gateway image before extracting /app/dist/control-ui. Host-dist deploys can regenerate the zero-intrusive overlay without forcing a gateway image rebuild from this script.",
    };
  }

  const sourceChanged = previousSourceFingerprint !== sourceFingerprint;
  const runtimeChanged = previousRuntimeFingerprint !== runtimeFingerprint;

  if (sourceChanged) {
    return {
      mode: "upstream-control-ui-changed",
      zeroIntrusiveOnly: false,
      requiresGatewayImageRebuild: true,
      requiresGatewayImageRebuildForImageSourcedDeploy: true,
      requiresGatewayImageRebuildForHostDistDeploy: false,
      reason:
        "Upstream Control UI source changed since the previous build. This is not a zero-intrusive-only update. Rebuild the gateway image only when the deploy flow extracts /app/dist/control-ui from that image; host-dist deploys can reuse the current host build output.",
    };
  }
  if (runtimeChanged) {
    return {
      mode: "update-zero-intrusive-artifacts-only",
      zeroIntrusiveOnly: true,
      requiresGatewayImageRebuild: false,
      requiresGatewayImageRebuildForImageSourcedDeploy: false,
      requiresGatewayImageRebuildForHostDistDeploy: false,
      reason:
        "Only zero-intrusive runtime/assets changed while upstream Control UI source stayed unchanged.",
    };
  }
  return {
    mode: "already-in-sync",
    zeroIntrusiveOnly: true,
    requiresGatewayImageRebuild: false,
    requiresGatewayImageRebuildForImageSourcedDeploy: false,
    requiresGatewayImageRebuildForHostDistDeploy: false,
    reason: "Source and zero-intrusive fingerprints are unchanged from the previous build.",
  };
}

function buildFingerprintAssetPaths(runtimeFingerprint) {
  const runtimeAssetBaseRelativePath = `./assets/openclaw-echarts/${runtimeFingerprint}/runtime`;
  const rendererAssetRelativePath = `./assets/openclaw-echarts/${runtimeFingerprint}/openclaw-echarts-renderer.js`;
  const rendererAssetAbsolutePath = `/assets/openclaw-echarts/${runtimeFingerprint}/openclaw-echarts-renderer.js`;
  return {
    runtimeFingerprint,
    runtimeAssetBaseRelativePath,
    rendererAssetRelativePath,
    rendererAssetAbsolutePath,
    fingerprintAssetDirectoryPath: path.join("assets", "openclaw-echarts", runtimeFingerprint),
  };
}

function countMarker(indexHtml, marker) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = String(indexHtml ?? "").match(new RegExp(escapedMarker, "g"));
  return matches ? matches.length : 0;
}

function resolveMarkerScriptSrc(indexHtml, marker) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function resolveOutputAssetPath(outputDir, scriptSrc) {
  const trimmed = String(scriptSrc ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const withoutQuery = trimmed.split("?")[0].split("#")[0];
  if (withoutQuery.startsWith("/")) {
    return path.join(outputDir, withoutQuery.slice(1));
  }
  const withoutDotSlash = withoutQuery.startsWith("./") ? withoutQuery.slice(2) : withoutQuery;
  return path.join(outputDir, withoutDotSlash);
}

function ensureOutputFileExists(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`output smoke failed: missing ${label} at ${filePath}`);
  }
}

function assertCriticalInjectionAndSmoke({
  outputDir,
  indexHtml,
  expectedMainBundleScriptSrc,
  expectedRuntimeBasePath,
  expectedRendererRelativePath,
  expectedRendererAbsolutePath,
}) {
  const mainBundlePosition = indexHtml.indexOf(expectedMainBundleScriptSrc);
  if (mainBundlePosition < 0) {
    throw new Error(
      `output smoke failed: main bundle script ${expectedMainBundleScriptSrc} is missing from index.html`,
    );
  }

  const expectedMarkerSources = [
    {
      marker: BOOTSTRAP_MARKERS.echartsView,
      expectedSrc: `${expectedRuntimeBasePath}/echarts-view/preboot.js`,
    },
    {
      marker: BOOTSTRAP_MARKERS.sandboxView,
      expectedSrc: `${expectedRuntimeBasePath}/sandbox-view/preboot.js`,
    },
    {
      marker: BOOTSTRAP_MARKERS.tenantPreboot,
      expectedSrc: `${expectedRuntimeBasePath}/tenant/preboot.js`,
    },
    {
      marker: BOOTSTRAP_MARKERS.lufeng,
      expectedSrc: `${expectedRuntimeBasePath}/lufeng/preboot.js`,
    },
    {
      marker: BOOTSTRAP_MARKERS.autoToken,
      expectedSrc: `${expectedRuntimeBasePath}/branding/auto-token-preboot.js`,
    },
  ];

  for (const { marker, expectedSrc } of expectedMarkerSources) {
    const markerCount = countMarker(indexHtml, marker);
    if (markerCount !== 1) {
      throw new Error(
        `output smoke failed: expected exactly 1 '${marker}' marker in index.html, found ${markerCount}`,
      );
    }
    const markerSrc = resolveMarkerScriptSrc(indexHtml, marker);
    if (markerSrc !== expectedSrc) {
      throw new Error(
        `output smoke failed: marker '${marker}' src mismatch. expected '${expectedSrc}', got '${markerSrc || "missing"}'`,
      );
    }
    const markerPosition = indexHtml.indexOf(marker);
    if (markerPosition < 0 || markerPosition > mainBundlePosition) {
      throw new Error(
        `output smoke failed: marker '${marker}' is not injected before the main bundle script`,
      );
    }
    const markerOutputPath = resolveOutputAssetPath(outputDir, markerSrc);
    ensureOutputFileExists(markerOutputPath, `${marker} script`);
  }

  const autoToken = resolveMarkerGatewayToken(indexHtml, BOOTSTRAP_MARKERS.autoToken);
  const lufengToken = resolveMarkerGatewayToken(indexHtml, BOOTSTRAP_MARKERS.lufeng);
  ensureValuePresent(
    autoToken,
    "output smoke failed: auto-token bootstrap is missing data-gateway-token. Set OPENCLAW_GATEWAY_TOKEN before building.",
  );
  ensureValuePresent(
    lufengToken,
    "output smoke failed: lufeng bootstrap is missing data-gateway-token. Set OPENCLAW_GATEWAY_TOKEN before building.",
  );

  const rendererMatches = Array.from(indexHtml.matchAll(RUNTIME_RENDERER_SCRIPT_PATTERN));
  if (rendererMatches.length !== 1) {
    throw new Error(
      `output smoke failed: expected exactly 1 renderer script in index.html, found ${rendererMatches.length}`,
    );
  }
  const rendererSrc = String(rendererMatches[0]?.groups?.src ?? "").trim();
  if (rendererSrc !== expectedRendererRelativePath) {
    throw new Error(
      `output smoke failed: renderer script src mismatch. expected '${expectedRendererRelativePath}', got '${rendererSrc || "missing"}'`,
    );
  }
  ensureOutputFileExists(
    resolveOutputAssetPath(outputDir, rendererSrc),
    "fingerprinted openclaw-echarts renderer",
  );

  const loginIndexPath = path.join(outputDir, "login", "index.html");
  const loginHtmlPath = path.join(outputDir, "login.html");
  const echartsViewIndexPath = path.join(outputDir, "echarts-view", "index.html");
  const sandboxViewIndexPath = path.join(outputDir, "sandbox-view", "index.html");
  ensureOutputFileExists(loginIndexPath, "login/index.html");
  ensureOutputFileExists(loginHtmlPath, "login.html");
  ensureOutputFileExists(echartsViewIndexPath, "echarts-view/index.html");
  ensureOutputFileExists(sandboxViewIndexPath, "sandbox-view/index.html");

  const loginIndexHtml = fs.readFileSync(loginIndexPath, "utf8");
  const loginHtml = fs.readFileSync(loginHtmlPath, "utf8");
  if (!loginIndexHtml.includes('<base href="/" />') || !loginHtml.includes('<base href="/" />')) {
    throw new Error('output smoke failed: login route aliases are missing <base href="/" />');
  }

  const echartsViewIndexHtml = fs.readFileSync(echartsViewIndexPath, "utf8");
  if (!echartsViewIndexHtml.includes(expectedRendererAbsolutePath)) {
    throw new Error(
      `output smoke failed: echarts-view entry is missing renderer '${expectedRendererAbsolutePath}'`,
    );
  }
  const sandboxViewIndexHtml = fs.readFileSync(sandboxViewIndexPath, "utf8");
  if (!sandboxViewIndexHtml.includes(expectedRendererAbsolutePath)) {
    throw new Error(
      `output smoke failed: sandbox-view entry is missing renderer '${expectedRendererAbsolutePath}'`,
    );
  }

  const knowledgeGraphPath = path.join(outputDir, "knowledge-graph.html");
  if (fs.existsSync(knowledgeGraphPath)) {
    const knowledgeGraphHtml = fs.readFileSync(knowledgeGraphPath, "utf8");
    const expectedKnowledgeGraphVendor = expectedRendererRelativePath.replace(
      /\/openclaw-echarts-renderer\.js$/,
      "/vendor/echarts.min.js",
    );
    const expectedKnowledgeGraphCss = `${expectedRuntimeBasePath}/knowledge-graph/page.css`;
    const expectedKnowledgeGraphJs = `${expectedRuntimeBasePath}/knowledge-graph/page.js`;
    if (!knowledgeGraphHtml.includes(expectedKnowledgeGraphVendor)) {
      throw new Error(
        `output smoke failed: knowledge-graph entry is missing vendor script '${expectedKnowledgeGraphVendor}'`,
      );
    }
    if (!knowledgeGraphHtml.includes(expectedKnowledgeGraphCss)) {
      throw new Error(
        `output smoke failed: knowledge-graph entry is missing stylesheet '${expectedKnowledgeGraphCss}'`,
      );
    }
    if (!knowledgeGraphHtml.includes(expectedKnowledgeGraphJs)) {
      throw new Error(
        `output smoke failed: knowledge-graph entry is missing script '${expectedKnowledgeGraphJs}'`,
      );
    }
    ensureOutputFileExists(
      resolveOutputAssetPath(outputDir, expectedKnowledgeGraphVendor),
      "fingerprinted knowledge-graph vendor script",
    );
    ensureOutputFileExists(
      resolveOutputAssetPath(outputDir, expectedKnowledgeGraphCss),
      "fingerprinted knowledge-graph stylesheet",
    );
    ensureOutputFileExists(
      resolveOutputAssetPath(outputDir, expectedKnowledgeGraphJs),
      "fingerprinted knowledge-graph script",
    );
  }
}

function writeBuildManifest(outputDir, manifest) {
  const manifestPath = path.join(outputDir, BUILD_MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function injectRuntimeScriptWithSrc(indexHtml, runtimeScriptSrc) {
  const scriptTag = `    <script type="module" src="${runtimeScriptSrc}"></script>\n`;
  const scriptPattern =
    /^\s*<script\s+type="module"\s+src="[^"]*openclaw-echarts-renderer\.js[^"]*"><\/script>\s*$/m;
  const cleaned = scriptPattern.test(indexHtml) ? indexHtml.replace(scriptPattern, "") : indexHtml;
  if (!cleaned.includes("</body>")) {
    throw new Error("index.html is missing </body>; cannot inject the ECharts runtime.");
  }
  return cleaned.replace("  </body>", `${scriptTag}  </body>`);
}

function writeLoginRouteAliases(outputDir, indexContent) {
  const loginIndexPath = path.join(outputDir, "login", "index.html");
  const loginHtmlPath = path.join(outputDir, "login.html");
  writeTextIntoOutput(indexContent, loginIndexPath);
  writeTextIntoOutput(indexContent, loginHtmlPath);
}

function buildEchartsViewEntryHtmlWithRendererSrc(rendererScriptSrc) {
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>可视化展示</title>",
    "  </head>",
    "  <body>",
    `    <script type="module" src="${rendererScriptSrc}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function writeEchartsViewRouteEntry(outputDir, rendererScriptSrc) {
  const echartsViewIndexPath = path.join(outputDir, "echarts-view", "index.html");
  writeTextIntoOutput(
    buildEchartsViewEntryHtmlWithRendererSrc(rendererScriptSrc),
    echartsViewIndexPath,
  );
}

function writeSandboxViewRouteEntry(outputDir, rendererScriptSrc) {
  const sandboxViewIndexPath = path.join(outputDir, "sandbox-view", "index.html");
  writeTextIntoOutput(
    buildEchartsViewEntryHtmlWithRendererSrc(rendererScriptSrc),
    sandboxViewIndexPath,
  );
}

function rewriteKnowledgeGraphEntry(outputDir, runtimeAssetBasePath, runtimeFingerprint) {
  const knowledgeGraphPath = path.join(outputDir, "knowledge-graph.html");
  if (!fs.existsSync(knowledgeGraphPath)) {
    return;
  }

  const fingerprintedVendorBasePath = `./assets/openclaw-echarts/${runtimeFingerprint}/vendor`;
  const nextHtml = fs
    .readFileSync(knowledgeGraphPath, "utf8")
    .replace(
      /\.\/assets\/runtime\/knowledge-graph\/page\.css/g,
      `${runtimeAssetBasePath}/knowledge-graph/page.css`,
    )
    .replace(
      /\.\/assets\/runtime\/knowledge-graph\/page\.js/g,
      `${runtimeAssetBasePath}/knowledge-graph/page.js`,
    )
    .replace(
      /\.\/assets\/vendor\/echarts\.min\.js/g,
      `${fingerprintedVendorBasePath}/echarts.min.js`,
    );

  fs.writeFileSync(knowledgeGraphPath, nextHtml, "utf8");
}

function extractEmbeddedLibraries(bundleSource) {
  const match = bundleSource.match(EMBEDDED_LIBRARY_PATTERN);
  if (!match?.groups) {
    throw new Error(
      `Could not extract embedded vendor libraries from ${OFFLINE_BUNDLED_USERSCRIPT_SOURCE}.`,
    );
  }

  return {
    echarts: JSON.parse(match.groups.echarts),
    json5: JSON.parse(match.groups.json5),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }

  const sourceDir = resolveRepoPath(options.source, DEFAULT_SOURCE_DIR);
  const outputDir = resolveRepoPath(options.output, DEFAULT_OUTPUT_DIR);
  const previousManifest = readPreviousBuildManifest(outputDir);

  if (path.resolve(sourceDir) === path.resolve(outputDir)) {
    throw new Error("Refusing to write the custom Control UI root over the source directory.");
  }

  ensureDirectoryExists(sourceDir, "Source control-ui directory");
  ensureFileExists(path.join(sourceDir, "index.html"), "Source control-ui index.html");
  ensureFileExists(CONTROL_UI_RUNTIME_SCRIPT_SOURCE, "Control UI ECharts runtime");
  ensureDirectoryExists(CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE, "Control UI ECharts runtime modules");
  ensureDirectoryExists(CONTROL_UI_STATIC_DIR_SOURCE, "Control UI static overlay assets");
  ensureFileExists(OFFLINE_BUNDLED_USERSCRIPT_SOURCE, "Offline bundled ECharts userscript");

  const sourceIndexPath = path.join(sourceDir, "index.html");
  const sourceIndexHtml = fs.readFileSync(sourceIndexPath, "utf8");
  const sourceMainBundleScriptSrc = extractMainBundleScriptSrc(sourceIndexHtml);
  const sourceFingerprint = computeDirectoryFingerprint(sourceDir);

  resetDirectoryContents(outputDir);
  fs.cpSync(sourceDir, outputDir, { recursive: true, force: true });
  fs.cpSync(CONTROL_UI_STATIC_DIR_SOURCE, outputDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outputDir, "workspace-downloads"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "workspace-agent-downloads"), { recursive: true });

  const outputIndexPath = path.join(outputDir, "index.html");
  const outputIndex = fs.readFileSync(outputIndexPath, "utf8");
  const autoGatewayToken = resolveAutoGatewayToken();
  ensureValuePresent(
    autoGatewayToken,
    [
      "OPENCLAW_GATEWAY_TOKEN is missing.",
      "Set OPENCLAW_GATEWAY_TOKEN in env/.env, or set gateway.auth.token in OPENCLAW_CONFIG_DIR/openclaw.json before building.",
    ].join(" "),
  );
  const runtimeFingerprint = computeRuntimeAssetFingerprint();
  const fingerprintPaths = buildFingerprintAssetPaths(runtimeFingerprint);
  const deploymentDecision = classifyDeploymentDecision(
    previousManifest,
    sourceFingerprint,
    runtimeFingerprint,
  );
  const finalizedIndexHtml = replaceBrandFavicons(
    injectAutoGatewayTokenBootstrap(
      injectLufengPublicBootstrap(
        injectTenantPreboot(
          injectSandboxViewPublicBootstrap(
            injectEchartsViewPublicBootstrap(outputIndex, {
              runtimeAssetBasePath: fingerprintPaths.runtimeAssetBaseRelativePath,
            }),
            { runtimeAssetBasePath: fingerprintPaths.runtimeAssetBaseRelativePath },
          ),
          { runtimeAssetBasePath: fingerprintPaths.runtimeAssetBaseRelativePath },
        ),
        autoGatewayToken,
        { runtimeAssetBasePath: fingerprintPaths.runtimeAssetBaseRelativePath },
      ),
      autoGatewayToken,
      { runtimeAssetBasePath: fingerprintPaths.runtimeAssetBaseRelativePath },
    ),
  );
  const indexWithFingerprintedRuntime = injectRuntimeScriptWithSrc(
    finalizedIndexHtml,
    fingerprintPaths.rendererAssetRelativePath,
  );
  fs.writeFileSync(outputIndexPath, indexWithFingerprintedRuntime, "utf8");
  writeLoginRouteAliases(outputDir, buildLoginEntryHtml(indexWithFingerprintedRuntime));
  writeEchartsViewRouteEntry(outputDir, fingerprintPaths.rendererAssetAbsolutePath);
  writeSandboxViewRouteEntry(outputDir, fingerprintPaths.rendererAssetAbsolutePath);
  rewriteKnowledgeGraphEntry(
    outputDir,
    fingerprintPaths.runtimeAssetBaseRelativePath,
    fingerprintPaths.runtimeFingerprint,
  );

  const embeddedLibraries = extractEmbeddedLibraries(
    fs.readFileSync(OFFLINE_BUNDLED_USERSCRIPT_SOURCE, "utf8"),
  );

  const fingerprintAssetRoot = path.join(outputDir, fingerprintPaths.fingerprintAssetDirectoryPath);
  copyFileIntoOutput(
    CONTROL_UI_RUNTIME_SCRIPT_SOURCE,
    path.join(fingerprintAssetRoot, "openclaw-echarts-renderer.js"),
  );
  fs.cpSync(CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE, path.join(fingerprintAssetRoot, "runtime"), {
    recursive: true,
    force: true,
  });
  copyVendorDirectoryIntoOutput(
    CONTROL_UI_VENDOR_DIR_SOURCE,
    path.join(fingerprintAssetRoot, "vendor"),
  );
  copyVendorDirectoryIntoOutput(
    CONTROL_UI_VENDOR_DIR_SOURCE,
    path.join(outputDir, "assets", "vendor"),
  );
  writeTextIntoOutput(
    embeddedLibraries.echarts,
    path.join(outputDir, "assets", "vendor", "echarts.min.js"),
  );
  writeTextIntoOutput(
    embeddedLibraries.json5,
    path.join(outputDir, "assets", "vendor", "json5.min.js"),
  );
  // Keep the legacy runtime path alive for older bundles and cached clients.
  writeTextIntoOutput(
    embeddedLibraries.echarts,
    path.join(outputDir, "assets", "runtime", "echarts", "echarts.min.js"),
  );
  writeTextIntoOutput(
    embeddedLibraries.json5,
    path.join(outputDir, "assets", "runtime", "echarts", "json5.min.js"),
  );

  assertCriticalInjectionAndSmoke({
    outputDir,
    indexHtml: fs.readFileSync(outputIndexPath, "utf8"),
    expectedMainBundleScriptSrc: sourceMainBundleScriptSrc,
    expectedRuntimeBasePath: fingerprintPaths.runtimeAssetBaseRelativePath,
    expectedRendererRelativePath: fingerprintPaths.rendererAssetRelativePath,
    expectedRendererAbsolutePath: fingerprintPaths.rendererAssetAbsolutePath,
  });

  const buildManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceFingerprint,
    sourceMainBundleScriptSrc,
    runtimeFingerprint,
    runtimeAssetBaseRelativePath: fingerprintPaths.runtimeAssetBaseRelativePath,
    rendererAssetRelativePath: fingerprintPaths.rendererAssetRelativePath,
    rendererAssetAbsolutePath: fingerprintPaths.rendererAssetAbsolutePath,
    deploymentDecision,
    checks: {
      verifiedMarkers: [
        BOOTSTRAP_MARKERS.echartsView,
        BOOTSTRAP_MARKERS.sandboxView,
        BOOTSTRAP_MARKERS.tenantPreboot,
        BOOTSTRAP_MARKERS.lufeng,
        BOOTSTRAP_MARKERS.autoToken,
      ],
      smokeChecksPassed: true,
    },
  };
  writeBuildManifest(outputDir, buildManifest);

  process.stdout.write(
    [
      `Custom Control UI root written to: ${outputDir}`,
      `Set gateway.controlUi.root to this directory (or mount it into your container and point gateway.controlUi.root there).`,
      `Deployment decision: ${deploymentDecision.mode}`,
      `Zero-intrusive-only update: ${deploymentDecision.zeroIntrusiveOnly ? "yes" : "no"}`,
      `Gateway image rebuild required for image-sourced deploy: ${deploymentDecision.requiresGatewayImageRebuildForImageSourcedDeploy ? "yes" : "no"}`,
      `Gateway image rebuild required for host-dist deploy: ${deploymentDecision.requiresGatewayImageRebuildForHostDistDeploy ? "yes" : "no"}`,
      `Reason: ${deploymentDecision.reason}`,
    ].join("\n"),
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBrandFaviconDataUrl } from "./runtime/branding/favicon.js";
import { injectAutoGatewayTokenBootstrap } from "./runtime/branding/auto-token.js";
import { injectEchartsViewPublicBootstrap } from "./runtime/echarts-view/bootstrap.js";
import { injectLufengPublicBootstrap } from "./runtime/lufeng/bootstrap.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const DEFAULT_SOURCE_DIR = path.join(repoRoot, "dist", "control-ui");
const DEFAULT_OUTPUT_DIR = path.join(here, "generated", "control-ui");
const ENV_FILE_PATH = path.join(repoRoot, ".env");
const CONTROL_UI_RUNTIME_SCRIPT_SOURCE = path.join(
  here,
  "openclaw-echarts-renderer.js",
);
const CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE = path.join(here, "runtime");
const CONTROL_UI_STATIC_DIR_SOURCE = path.join(here, "static");
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
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
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

function injectRuntimeScript(indexHtml) {
  const scriptTag =
    '    <script type="module" src="./assets/openclaw-echarts-renderer.js"></script>\n';
  if (indexHtml.includes("openclaw-echarts-renderer.js")) {
    return indexHtml;
  }
  if (!indexHtml.includes("</body>")) {
    throw new Error("index.html is missing </body>; cannot inject the ECharts runtime.");
  }
  return indexHtml.replace("  </body>", `${scriptTag}  </body>`);
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

function buildLoginEntryHtml(indexHtml) {
  if (/<base\s+[^>]*href\s*=/.test(indexHtml)) {
    return indexHtml;
  }
  if (!indexHtml.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot create /login entry.");
  }
  return indexHtml.replace("</head>", '    <base href="/" />\n  </head>');
}

function buildEchartsViewEntryHtml() {
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>可视化展示</title>",
    "  </head>",
    "  <body>",
    '    <script type="module" src="/assets/openclaw-echarts-renderer.js"></script>',
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function writeLoginRouteAliases(outputDir, indexContent) {
  const loginIndexPath = path.join(outputDir, "login", "index.html");
  const loginHtmlPath = path.join(outputDir, "login.html");
  writeTextIntoOutput(indexContent, loginIndexPath);
  writeTextIntoOutput(indexContent, loginHtmlPath);
}

function writeEchartsViewRouteEntry(outputDir) {
  const echartsViewIndexPath = path.join(outputDir, "echarts-view", "index.html");
  writeTextIntoOutput(buildEchartsViewEntryHtml(), echartsViewIndexPath);
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

  if (path.resolve(sourceDir) === path.resolve(outputDir)) {
    throw new Error("Refusing to write the custom Control UI root over the source directory.");
  }

  ensureDirectoryExists(sourceDir, "Source control-ui directory");
  ensureFileExists(path.join(sourceDir, "index.html"), "Source control-ui index.html");
  ensureFileExists(CONTROL_UI_RUNTIME_SCRIPT_SOURCE, "Control UI ECharts runtime");
  ensureDirectoryExists(CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE, "Control UI ECharts runtime modules");
  ensureDirectoryExists(CONTROL_UI_STATIC_DIR_SOURCE, "Control UI static overlay assets");
  ensureFileExists(OFFLINE_BUNDLED_USERSCRIPT_SOURCE, "Offline bundled ECharts userscript");

  resetDirectoryContents(outputDir);
  fs.cpSync(sourceDir, outputDir, { recursive: true, force: true });
  fs.cpSync(CONTROL_UI_STATIC_DIR_SOURCE, outputDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outputDir, "workspace-downloads"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "workspace-agent-downloads"), { recursive: true });

  const outputIndexPath = path.join(outputDir, "index.html");
  const outputIndex = fs.readFileSync(outputIndexPath, "utf8");
  const autoGatewayToken = resolveAutoGatewayToken();
  const finalizedIndexHtml = injectRuntimeScript(
    replaceBrandFavicons(
      injectAutoGatewayTokenBootstrap(
        injectLufengPublicBootstrap(
          injectEchartsViewPublicBootstrap(outputIndex),
          autoGatewayToken,
        ),
        autoGatewayToken,
      ),
    ),
  );
  fs.writeFileSync(outputIndexPath, finalizedIndexHtml, "utf8");
  writeLoginRouteAliases(outputDir, buildLoginEntryHtml(finalizedIndexHtml));
  writeEchartsViewRouteEntry(outputDir);

  const embeddedLibraries = extractEmbeddedLibraries(
    fs.readFileSync(OFFLINE_BUNDLED_USERSCRIPT_SOURCE, "utf8"),
  );

  copyFileIntoOutput(
    CONTROL_UI_RUNTIME_SCRIPT_SOURCE,
    path.join(outputDir, "assets", "openclaw-echarts-renderer.js"),
  );
  fs.cpSync(
    CONTROL_UI_RUNTIME_MODULE_DIR_SOURCE,
    path.join(outputDir, "assets", "runtime"),
    {
      recursive: true,
      force: true,
    },
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

  process.stdout.write(
    [
      `Custom Control UI root written to: ${outputDir}`,
      `Set gateway.controlUi.root to this directory (or mount it into your container and point gateway.controlUi.root there).`,
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

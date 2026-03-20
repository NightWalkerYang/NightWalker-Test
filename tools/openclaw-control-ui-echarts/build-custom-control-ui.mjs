#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const DEFAULT_SOURCE_DIR = path.join(repoRoot, "dist", "control-ui");
const DEFAULT_OUTPUT_DIR = path.join(here, "generated", "control-ui");
const RUNTIME_SCRIPT_SOURCE = path.join(here, "openclaw-echarts-renderer.js");
const CONTROL_UI_VENDOR_DIR = path.join(here, "vendor");
const LEGACY_SHARED_VENDOR_DIR = path.join(
  repoRoot,
  "tools",
  "openclaw-echarts-userscript",
  "vendor",
);
const ECHARTS_VENDOR_FILE = path.join(CONTROL_UI_VENDOR_DIR, "echarts.min.js");
const JSON5_VENDOR_FILE = path.join(CONTROL_UI_VENDOR_DIR, "json5.min.js");
const ECHARTS_VENDOR_URL = "https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js";
const JSON5_VENDOR_URL = "https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.min.js";

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

async function downloadFile(url, outputPath, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} download failed from ${url} with HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

async function ensureVendorFile(options) {
  if (fs.existsSync(options.outputPath)) {
    return options.outputPath;
  }

  for (const fallbackPath of options.fallbackPaths) {
    if (!fallbackPath || !fs.existsSync(fallbackPath)) {
      continue;
    }
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.copyFileSync(fallbackPath, options.outputPath);
    return options.outputPath;
  }

  await downloadFile(options.url, options.outputPath, options.label);
  return options.outputPath;
}

function injectRuntimeScript(indexHtml) {
  const scriptTag = '    <script defer src="./assets/openclaw-echarts-renderer.js"></script>\n';
  if (indexHtml.includes("openclaw-echarts-renderer.js")) {
    return indexHtml;
  }
  if (!indexHtml.includes("</body>")) {
    throw new Error("index.html is missing </body>; cannot inject the ECharts runtime.");
  }
  return indexHtml.replace("  </body>", `${scriptTag}  </body>`);
}

function copyFileIntoOutput(sourceFile, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.copyFileSync(sourceFile, outputFile);
}

async function main() {
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
  ensureFileExists(RUNTIME_SCRIPT_SOURCE, "Custom ECharts runtime");
  const echartsVendorPath = await ensureVendorFile({
    label: "Vendored ECharts runtime",
    outputPath: ECHARTS_VENDOR_FILE,
    fallbackPaths: [path.join(LEGACY_SHARED_VENDOR_DIR, "echarts.min.js")],
    url: ECHARTS_VENDOR_URL,
  });
  const json5VendorPath = await ensureVendorFile({
    label: "Vendored JSON5 runtime",
    outputPath: JSON5_VENDOR_FILE,
    fallbackPaths: [path.join(LEGACY_SHARED_VENDOR_DIR, "json5.min.js")],
    url: JSON5_VENDOR_URL,
  });

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(sourceDir, outputDir, { recursive: true, force: true });

  const outputIndexPath = path.join(outputDir, "index.html");
  const outputIndex = fs.readFileSync(outputIndexPath, "utf8");
  fs.writeFileSync(outputIndexPath, injectRuntimeScript(outputIndex), "utf8");

  copyFileIntoOutput(
    RUNTIME_SCRIPT_SOURCE,
    path.join(outputDir, "assets", "openclaw-echarts-renderer.js"),
  );
  copyFileIntoOutput(
    echartsVendorPath,
    path.join(outputDir, "assets", "vendor", "echarts.min.js"),
  );
  copyFileIntoOutput(
    json5VendorPath,
    path.join(outputDir, "assets", "vendor", "json5.min.js"),
  );

  process.stdout.write(
    [
      `Custom Control UI root written to: ${outputDir}`,
      `Set gateway.controlUi.root to this directory (or mount it into your container and point gateway.controlUi.root there).`,
    ].join("\n"),
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

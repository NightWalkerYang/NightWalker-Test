#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const defaultOutputDir = path.join(here, "generated", "local-runtime");
const localRuntimeTemplateDir = path.join(here, "local-runtime");
const buildCustomControlUiScript = path.join(here, "build-custom-control-ui.mjs");
const controlUiSourceDir = path.join(repoRoot, "dist", "control-ui");
const sidecarSourceDir = path.join(here, "sidecar", "tenant-platform");
const defaultGatewayToken = "local-runtime-shared-token";

function usage() {
  process.stdout.write(
    [
      "Usage: node tools/openclaw-control-ui-echarts/package-local-runtime.mjs [options]",
      "",
      "Options:",
      "  --output <path>    Output directory. Default: tools/openclaw-control-ui-echarts/generated/local-runtime",
      "  --skip-install     Skip npm runtime install and only stage artifacts/templates.",
      "  --help             Show this help.",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    skipInstall: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--skip-install") {
      options.skipInstall = true;
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

function ensureDirectoryExists(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`${label} not found at ${dirPath}`);
  }
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}`);
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    shell: false,
    stdio: options.captureOutput ? "pipe" : "inherit",
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(
      `${command} ${args.join(" ")} failed before execution: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
  return result;
}

function quoteCommandArg(value) {
  const normalized = String(value ?? "");
  if (!normalized || /[\s"]/u.test(normalized)) {
    return `"${normalized.replace(/"/g, '\\"')}"`;
  }
  return normalized;
}

function runNpmCommand(args, options = {}) {
  if (process.platform === "win32") {
    const commandLine = ["npm", ...args].map((entry) => quoteCommandArg(entry)).join(" ");
    return runCommand("cmd.exe", ["/d", "/s", "/c", commandLine], options);
  }
  return runCommand("npm", args, options);
}

function ensureControlUiSourceReady() {
  if (fs.existsSync(controlUiSourceDir) && fs.statSync(controlUiSourceDir).isDirectory()) {
    return;
  }
  if (process.platform === "win32") {
    runCommand("cmd.exe", ["/d", "/s", "/c", "corepack pnpm ui:build"]);
  } else {
    runCommand("corepack", ["pnpm", "ui:build"]);
  }
  ensureDirectoryExists(controlUiSourceDir, "Built control-ui directory");
}

function copyTemplateFile(sourceRelativePath, outputPath) {
  const sourcePath = path.join(localRuntimeTemplateDir, sourceRelativePath);
  ensureFileExists(sourcePath, `Local runtime template ${sourceRelativePath}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
}

function writeLauncherScript(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function createLaunchers(outputDir) {
  const shScripts = {
    "start-gateway.sh": `#!/usr/bin/env bash
set -euo pipefail
node "$(dirname "$0")/scripts/start-gateway.mjs" "$@"
`,
    "start-tenant-platform.sh": `#!/usr/bin/env bash
set -euo pipefail
node "$(dirname "$0")/scripts/start-tenant-platform.mjs" "$@"
`,
    "start-local-runtime.sh": `#!/usr/bin/env bash
set -euo pipefail
node "$(dirname "$0")/scripts/start-local-runtime.mjs" "$@"
`,
  };
  const cmdScripts = {
    "start-gateway.cmd": `@echo off
setlocal
node "%~dp0scripts\\start-gateway.mjs" %*
`,
    "start-tenant-platform.cmd": `@echo off
setlocal
node "%~dp0scripts\\start-tenant-platform.mjs" %*
`,
    "start-local-runtime.cmd": `@echo off
setlocal
node "%~dp0scripts\\start-local-runtime.mjs" %*
`,
  };

  for (const [name, content] of Object.entries(shScripts)) {
    const target = path.join(outputDir, name);
    writeLauncherScript(target, content);
    try {
      fs.chmodSync(target, 0o755);
    } catch {
      // Windows checkout can ignore chmod.
    }
  }
  for (const [name, content] of Object.entries(cmdScripts)) {
    writeLauncherScript(path.join(outputDir, name), content);
  }
}

function buildCustomControlUi(tempDir) {
  const controlUiOutputDir = path.join(tempDir, "control-ui");
  const env = {
    ...process.env,
    OPENCLAW_GATEWAY_TOKEN: defaultGatewayToken,
  };
  runCommand(
    process.execPath,
    [buildCustomControlUiScript, "--source", controlUiSourceDir, "--output", controlUiOutputDir],
    { env },
  );
  return controlUiOutputDir;
}

function buildNpmTarball(tempDir) {
  const packDir = path.join(tempDir, "pack");
  fs.mkdirSync(packDir, { recursive: true });
  const result = runNpmCommand(
    ["pack", "--ignore-scripts", "--json", "--pack-destination", packDir],
    { captureOutput: true },
  );
  const parsed = JSON.parse(result.stdout);
  const entry = Array.isArray(parsed) ? parsed[0] : null;
  if (!entry?.filename) {
    throw new Error("npm pack did not return a tarball filename.");
  }
  return {
    packDir,
    tarballPath: path.join(packDir, entry.filename),
  };
}

function installRuntimeTarball(outputDir, tarballPath) {
  const runtimeDir = path.join(outputDir, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  runNpmCommand([
    "install",
    "--omit=dev",
    "--ignore-scripts",
    "--no-fund",
    "--no-audit",
    "--prefix",
    runtimeDir,
    tarballPath,
  ]);
  const packageRoot = path.join(runtimeDir, "node_modules", "openclaw");
  ensureFileExists(path.join(packageRoot, "openclaw.mjs"), "Installed OpenClaw entry");
  return packageRoot;
}

function stageRuntimePackage(outputDir, packageRoot, controlUiOutputDir, tarballPath) {
  const controlUiTarget = path.join(packageRoot, "dist", "control-ui");
  fs.rmSync(controlUiTarget, { recursive: true, force: true });
  fs.cpSync(controlUiOutputDir, controlUiTarget, { recursive: true, force: true });
  fs.cpSync(
    sidecarSourceDir,
    path.join(packageRoot, "tools", "openclaw-control-ui-echarts", "sidecar", "tenant-platform"),
    {
      recursive: true,
      force: true,
    },
  );

  const artifactsDir = path.join(outputDir, "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.copyFileSync(tarballPath, path.join(artifactsDir, path.basename(tarballPath)));
}

function stageTemplates(outputDir) {
  copyTemplateFile("README.md", path.join(outputDir, "README-local-runtime.md"));
  copyTemplateFile(
    "CUSTOMER_DEPLOYMENT_GUIDE.md",
    path.join(outputDir, "README-customer-deploy.md"),
  );
  copyTemplateFile("runtime.env.example", path.join(outputDir, "runtime.env.example"));
  copyTemplateFile(
    "openclaw.local.example.json5",
    path.join(outputDir, "openclaw.local.example.json5"),
  );
  copyTemplateFile("runtime-common.mjs", path.join(outputDir, "scripts", "runtime-common.mjs"));
  copyTemplateFile("start-gateway.mjs", path.join(outputDir, "scripts", "start-gateway.mjs"));
  copyTemplateFile(
    "start-tenant-platform.mjs",
    path.join(outputDir, "scripts", "start-tenant-platform.mjs"),
  );
  copyTemplateFile(
    "start-local-runtime.mjs",
    path.join(outputDir, "scripts", "start-local-runtime.mjs"),
  );
  createLaunchers(outputDir);
}

function stageDataSkeleton(outputDir) {
  const dirs = [
    path.join(outputDir, "data", ".openclaw", "tenant-platform"),
    path.join(outputDir, "data", "workspace"),
    path.join(outputDir, "logs"),
  ];
  for (const dirPath of dirs) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const outputDir = resolveRepoPath(options.output, defaultOutputDir);
  ensureControlUiSourceReady();
  ensureDirectoryExists(sidecarSourceDir, "Tenant platform sidecar directory");
  ensureDirectoryExists(localRuntimeTemplateDir, "Local runtime template directory");

  if (path.resolve(outputDir) === path.resolve(repoRoot)) {
    throw new Error("Refusing to overwrite the repository root.");
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-local-runtime-"));
  try {
    const controlUiOutputDir = buildCustomControlUi(tempDir);
    const { tarballPath } = buildNpmTarball(tempDir);
    stageTemplates(outputDir);
    stageDataSkeleton(outputDir);
    if (!options.skipInstall) {
      const packageRoot = installRuntimeTarball(outputDir, tarballPath);
      stageRuntimePackage(outputDir, packageRoot, controlUiOutputDir, tarballPath);
    } else {
      const artifactsDir = path.join(outputDir, "artifacts");
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.copyFileSync(tarballPath, path.join(artifactsDir, path.basename(tarballPath)));
      fs.cpSync(controlUiOutputDir, path.join(outputDir, "artifacts", "control-ui"), {
        recursive: true,
        force: true,
      });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  process.stdout.write(
    [
      `Local runtime package written to: ${outputDir}`,
      options.skipInstall
        ? "Runtime install skipped; artifacts and templates have been staged."
        : "The package includes the installed OpenClaw runtime, tenant sidecar, and the generated zero-intrusive Control UI.",
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

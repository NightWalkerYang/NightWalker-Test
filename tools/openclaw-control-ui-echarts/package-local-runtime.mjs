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
const workspaceOverlaySourceDir = path.join(here, "workspace-overlays", "kingdee-cloud");
const defaultGatewayToken = "local-runtime-shared-token";
const localRuntimeExtraPackages = [
  "@aws-sdk/client-bedrock",
  "jimp",
  "@jimp/utils",
  "p-queue",
];

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

function removeDirectorySafe(targetPath) {
  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}

function createPackagingEnv(tempDir, extraEnv = {}) {
  const cacheDir = path.join(tempDir, "npm-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  return {
    ...process.env,
    TMP: tempDir,
    TEMP: tempDir,
    TMPDIR: tempDir,
    npm_config_cache: cacheDir,
    ...extraEnv,
  };
}

function packageNameToPathSegments(packageName) {
  return packageName.split("/");
}

function resolvePackageJsonPath(nodeModulesRoot, packageName) {
  return path.join(nodeModulesRoot, ...packageNameToPathSegments(packageName), "package.json");
}

export function resolveInstalledPackageVersion(nodeModulesRoot, packageName) {
  const packageJsonPath = resolvePackageJsonPath(nodeModulesRoot, packageName);
  ensureFileExists(packageJsonPath, `Installed package ${packageName}`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = String(packageJson.version || "").trim();
  if (!version) {
    throw new Error(`Installed package ${packageName} is missing a version.`);
  }
  return version;
}

export function buildRuntimeExtraDependencySpecs(nodeModulesRoot) {
  return localRuntimeExtraPackages.map((packageName) => {
    const version = resolveInstalledPackageVersion(nodeModulesRoot, packageName);
    return `${packageName}@${version}`;
  });
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

function resolveNpmCliEntry() {
  const candidates = [];
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (npmExecPath) {
    candidates.push(npmExecPath);
  }
  candidates.push(path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"));
  candidates.push(path.join(path.dirname(path.dirname(process.execPath)), "lib", "node_modules", "npm", "bin", "npm-cli.js"));
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Unable to resolve npm CLI entrypoint for local runtime packaging.");
}

function runNpmCommand(args, options = {}) {
  return runCommand(process.execPath, [resolveNpmCliEntry(), ...args], options);
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
  const env = createPackagingEnv(tempDir, {
    OPENCLAW_GATEWAY_TOKEN: defaultGatewayToken,
  });
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
    { captureOutput: true, env: createPackagingEnv(tempDir) },
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

function installRuntimeTarball(outputDir, tarballPath, tempDir) {
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
  ], { env: createPackagingEnv(tempDir) });
  const packageRoot = path.join(runtimeDir, "node_modules", "openclaw");
  ensureFileExists(path.join(packageRoot, "openclaw.mjs"), "Installed OpenClaw entry");
  return packageRoot;
}

function installRuntimeExtraPackages(outputDir, tempDir) {
  const runtimeDir = path.join(outputDir, "runtime");
  const extraSpecs = buildRuntimeExtraDependencySpecs(path.join(repoRoot, "node_modules"));
  runNpmCommand([
    "install",
    "--omit=dev",
    "--ignore-scripts",
    "--no-fund",
    "--no-audit",
    "--prefix",
    runtimeDir,
    ...extraSpecs,
  ], { env: createPackagingEnv(tempDir) });
}

export function patchFileTypeRuntimeCompat(runtimeDir) {
  const fileTypeDir = path.join(runtimeDir, "node_modules", "file-type");
  ensureDirectoryExists(fileTypeDir, "Installed file-type package");
  const packageJsonPath = path.join(fileTypeDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const compatPath = path.join(fileTypeDir, "core.js");
  const compatSource = `import {
  fileTypeFromBlob,
  fileTypeFromBuffer,
  fileTypeFromFile,
  fileTypeFromStream,
  FileTypeParser,
  supportedExtensions,
  supportedMimeTypes,
} from "./source/index.js";

const fileTypeCoreCompat = {
  fromBlob: fileTypeFromBlob,
  fromBuffer: fileTypeFromBuffer,
  fromFile: fileTypeFromFile,
  fromStream: fileTypeFromStream,
  FileTypeParser,
  supportedExtensions,
  supportedMimeTypes,
};

export const fromBlob = fileTypeFromBlob;
export const fromBuffer = fileTypeFromBuffer;
export const fromFile = fileTypeFromFile;
export const fromStream = fileTypeFromStream;
export { FileTypeParser, supportedExtensions, supportedMimeTypes };
export default fileTypeCoreCompat;
`;
  fs.writeFileSync(compatPath, compatSource, "utf8");
  const currentExports =
    packageJson.exports && typeof packageJson.exports === "object" ? packageJson.exports : {};
  const hasConditionalMainSugar =
    !currentExports["."] &&
    Object.keys(currentExports).some((key) => !key.startsWith("."));
  const normalizedExports = hasConditionalMainSugar
    ? {
        ".": { ...currentExports },
      }
    : { ...currentExports };
  if (!normalizedExports["./core.js"]) {
    normalizedExports["./core.js"] = "./core.js";
    packageJson.exports = normalizedExports;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  }
}

function verifyRuntimePackage(outputDir, packageRoot) {
  const runtimeDir = path.join(outputDir, "runtime");
  const requiredFiles = [
    path.join(packageRoot, "openclaw.mjs"),
    path.join(runtimeDir, "node_modules", "@aws-sdk", "client-bedrock", "package.json"),
    path.join(runtimeDir, "node_modules", "jimp", "package.json"),
    path.join(runtimeDir, "node_modules", "@jimp", "utils", "package.json"),
    path.join(runtimeDir, "node_modules", "p-queue", "package.json"),
    path.join(runtimeDir, "node_modules", "file-type", "core.js"),
  ];
  for (const requiredFile of requiredFiles) {
    ensureFileExists(requiredFile, "Packaged local runtime dependency");
  }
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
  fs.cpSync(
    workspaceOverlaySourceDir,
    path.join(
      packageRoot,
      "tools",
      "openclaw-control-ui-echarts",
      "workspace-overlays",
      "kingdee-cloud",
    ),
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
  copyTemplateFile(
    "openclaw.local.example.json5",
    path.join(outputDir, "data", ".openclaw", "openclaw.json"),
  );
  copyTemplateFile("runtime.env.example", path.join(outputDir, "runtime.env"));
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

  removeDirectorySafe(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const tempRoot = path.join(path.dirname(outputDir), ".openclaw-local-runtime-tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "build-"));
  try {
    const controlUiOutputDir = buildCustomControlUi(tempDir);
    const { tarballPath } = buildNpmTarball(tempDir);
    stageTemplates(outputDir);
    stageDataSkeleton(outputDir);
    if (!options.skipInstall) {
      const packageRoot = installRuntimeTarball(outputDir, tarballPath, tempDir);
      installRuntimeExtraPackages(outputDir, tempDir);
      patchFileTypeRuntimeCompat(path.join(outputDir, "runtime"));
      stageRuntimePackage(outputDir, packageRoot, controlUiOutputDir, tarballPath);
      verifyRuntimePackage(outputDir, packageRoot);
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
    removeDirectorySafe(tempDir);
    try {
      fs.rmdirSync(tempRoot);
    } catch {
      // Ignore non-empty or missing temp root.
    }
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

const isEntrypoint =
  !!process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

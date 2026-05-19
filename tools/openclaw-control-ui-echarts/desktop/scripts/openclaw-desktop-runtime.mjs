#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptDir, "..");
const runtimePackageRoot = path.resolve(desktopDir, "..");

function parseRuntimeEnv(text) {
  const env = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) {
      env[key] = value;
    }
  }
  return env;
}

export function resolveDesktopRuntimePackage(rootDir = runtimePackageRoot) {
  const startScript = path.join(rootDir, "scripts", "start-local-runtime.mjs");
  if (!fs.existsSync(startScript)) {
    throw new Error(`missing_local_runtime_launcher:${startScript}`);
  }
  const runtimeEnvPath = path.join(rootDir, "runtime.env");
  const runtimeEnv = fs.existsSync(runtimeEnvPath)
    ? parseRuntimeEnv(fs.readFileSync(runtimeEnvPath, "utf8"))
    : {};
  const gatewayPort = String(runtimeEnv.OPENCLAW_GATEWAY_PORT || "18789").trim() || "18789";
  const tenantPort = String(runtimeEnv.OPENCLAW_TENANT_PLATFORM_PORT || "18801").trim() || "18801";
  const modelProxyEndpoint = runtimeEnv.OPENCLAW_MODEL_PROXY_ENDPOINT || null;
  const configPath = path.join(desktopDir, "..", "desktop-config.json");
  let desktopConfig = { mode: null, cloudEndpoint: null };
  if (fs.existsSync(configPath)) {
    try {
      desktopConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {}
  }
  return {
    rootDir,
    startScript,
    gatewayPort,
    tenantPort,
    modelProxyEndpoint,
    desktopConfig,
    controlUiUrl: `http://127.0.0.1:${gatewayPort}`,
    gatewayHealthUrl: `http://127.0.0.1:${gatewayPort}/healthz`,
    tenantHealthUrl: `http://127.0.0.1:${tenantPort}/tenant-platform-api/v1/healthz`,
  };
}

function requestOk(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 1500 }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode >= 200 && response.statusCode < 500));
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

export async function waitForRuntime(urls, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 60000);
  const intervalMs = Number(options.intervalMs || 500);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const results = await Promise.all(urls.map((url) => requestOk(url)));
    if (results.every(Boolean)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

async function main() {
  const runtime = resolveDesktopRuntimePackage();
  const child = spawn(process.execPath, [runtime.startScript, ...process.argv.slice(2)], {
    cwd: runtime.rootDir,
    env: process.env,
    stdio: "inherit",
  });

  const terminate = () => {
    if (!child.killed) {
      child.kill();
    }
  };
  process.on("SIGINT", terminate);
  process.on("SIGTERM", terminate);

  const ready = await waitForRuntime([runtime.gatewayHealthUrl, runtime.tenantHealthUrl]);
  if (ready) {
    process.stdout.write(`OpenClaw desktop runtime ready: ${runtime.controlUiUrl}\n`);
  } else {
    process.stderr.write(
      `Timed out waiting for OpenClaw desktop runtime: ${runtime.controlUiUrl}\n`,
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

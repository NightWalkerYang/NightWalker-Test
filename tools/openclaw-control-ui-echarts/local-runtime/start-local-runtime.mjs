import { spawn } from "node:child_process";
import { prepareLocalRuntime, resolveRuntimePackageRoot } from "./runtime-common.mjs";

const rootDir = resolveRuntimePackageRoot(import.meta.url);
const runtime = prepareLocalRuntime(rootDir);
const deploymentDecision = runtime?.controlUiPreflight?.deploymentDecision;
if (deploymentDecision && typeof deploymentDecision === "object") {
  const mode = String(deploymentDecision.mode ?? "").trim();
  const requiresGatewayImageRebuild = Boolean(deploymentDecision.requiresGatewayImageRebuild);
  const reason = String(deploymentDecision.reason ?? "").trim();
  if (mode || reason) {
    process.stdout.write(
      [
        `[control-ui-preflight] deployment mode: ${mode || "unknown"}`,
        `[control-ui-preflight] requires gateway image rebuild: ${requiresGatewayImageRebuild ? "yes" : "no"}`,
        reason ? `[control-ui-preflight] reason: ${reason}` : "",
      ]
        .filter(Boolean)
        .join("\n") + "\n",
    );
  }
}
const extraGatewayArgs = process.argv.slice(2);

const sidecar = spawn(process.execPath, [runtime.tenantPlatformEntry], {
  cwd: runtime.packageRoot,
  env: runtime.env,
  stdio: "inherit",
});

const gateway = spawn(
  process.execPath,
  [
    runtime.openclawEntry,
    "gateway",
    "run",
    "--bind",
    runtime.env.OPENCLAW_GATEWAY_BIND,
    "--port",
    runtime.env.OPENCLAW_GATEWAY_PORT,
    ...extraGatewayArgs,
  ],
  {
    cwd: runtime.packageRoot,
    env: runtime.env,
    stdio: "inherit",
  },
);

let shuttingDown = false;

function terminateChildren() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of [gateway, sidecar]) {
    if (!child.killed) {
      child.kill();
    }
  }
}

function bindExit(child, label) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    terminateChildren();
    if (signal) {
      process.stderr.write(`${label} exited with signal ${signal}\n`);
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });
}

bindExit(sidecar, "tenant-platform");
bindExit(gateway, "gateway");

process.on("SIGINT", () => {
  terminateChildren();
});

process.on("SIGTERM", () => {
  terminateChildren();
});

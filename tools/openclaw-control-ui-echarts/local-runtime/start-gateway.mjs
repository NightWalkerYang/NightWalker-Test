import { spawn } from "node:child_process";
import {
  prepareDirectDockerGatewayRuntime,
  prepareLocalRuntime,
  resolveRuntimePackageRoot,
} from "./runtime-common.mjs";

const directDockerSourceRoot = String(
  process.env.OPENCLAW_DIRECT_DOCKER_CONTROL_UI_SOURCE_ROOT || "",
).trim();
const isDirectDockerMode = Boolean(directDockerSourceRoot);
const rootDir = resolveRuntimePackageRoot(import.meta.url);
const runtime = isDirectDockerMode
  ? prepareDirectDockerGatewayRuntime(process.env)
  : prepareLocalRuntime(rootDir);
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
const child = spawn(
  process.execPath,
  isDirectDockerMode
    ? [
        runtime.gatewayEntry,
        "gateway",
        "--bind",
        runtime.env.OPENCLAW_GATEWAY_BIND,
        "--port",
        runtime.env.OPENCLAW_GATEWAY_PORT,
        ...process.argv.slice(2),
      ]
    : [
        runtime.openclawEntry,
        "gateway",
        "run",
        "--bind",
        runtime.env.OPENCLAW_GATEWAY_BIND,
        "--port",
        runtime.env.OPENCLAW_GATEWAY_PORT,
        ...process.argv.slice(2),
      ],
  {
    cwd: runtime.packageRoot,
    env: runtime.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

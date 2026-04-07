import { spawn } from "node:child_process";
import { prepareLocalRuntime, resolveRuntimePackageRoot } from "./runtime-common.mjs";

const rootDir = resolveRuntimePackageRoot(import.meta.url);
const runtime = prepareLocalRuntime(rootDir);
const child = spawn(process.execPath, [runtime.tenantPlatformEntry, ...process.argv.slice(2)], {
  cwd: runtime.packageRoot,
  env: runtime.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

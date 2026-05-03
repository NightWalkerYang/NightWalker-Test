import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveTenantPlatformConfig } from "./config.mjs";
import { createManagedNodeSyncWorker } from "./managed-node-sync.mjs";
import { listActiveSyncSchedules, openTenantPlatformDb, updateSyncScheduleRunResult } from "./db.mjs";
import { createTenantExecApprovalAutoApprover } from "./exec-approval-auto-approve.mjs";
import { createTenantPlatformRouter } from "./routes.mjs";

const config = resolveTenantPlatformConfig();
const db = openTenantPlatformDb(config);
const handler = createTenantPlatformRouter({ config, db });
const execApprovalAutoApprover = createTenantExecApprovalAutoApprover({ config });
const managedNodeSyncWorker = createManagedNodeSyncWorker({ config, db });
const runningSyncSchedules = new Set();

function resolveSyncCommand(schedule) {
  const workspaceDir = String(schedule?.derivedWorkspaceDir || "").trim();
  const scriptPath = path.join(
    workspaceDir,
    "skills",
    "kingdee-analytics-ops",
    "scripts",
    "manage_analytics_db.py",
  );
  if (!workspaceDir || !fs.existsSync(scriptPath)) {
    return null;
  }
  const moduleName = String(schedule?.moduleName || "").trim().toLowerCase();
  const objectCode = String(schedule?.objectCode || "").trim();
  if (!objectCode) {
    return null;
  }
  const args = [
    scriptPath,
    "--cli",
    "sync-object",
    "--default-start",
    String(schedule?.defaultStart || "2023-01-01").trim() || "2023-01-01",
    "--format",
    "json",
  ];
  args.push("--object-code", objectCode);
  return {
    command: "python3",
    args,
    cwd: workspaceDir,
  };
}

function shouldRunSchedule(schedule) {
  const intervalMinutes = Math.max(1, Number(schedule?.intervalMinutes || 5));
  const lastRunAt = String(schedule?.lastRunAt || "").trim();
  if (!lastRunAt) {
    return true;
  }
  const lastRunMs = Date.parse(lastRunAt);
  if (Number.isNaN(lastRunMs)) {
    return true;
  }
  return Date.now() - lastRunMs >= intervalMinutes * 60 * 1000;
}

function runScheduledSyncs() {
  let schedules = [];
  try {
    schedules = listActiveSyncSchedules(db);
  } catch (error) {
    process.stderr.write(
      `[tenant-platform sync-scheduler] list failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return;
  }

  for (const schedule of schedules) {
    if (!schedule?.id || runningSyncSchedules.has(schedule.id) || !shouldRunSchedule(schedule)) {
      continue;
    }
    const command = resolveSyncCommand(schedule);
    if (!command) {
      updateSyncScheduleRunResult(db, schedule.id, {
        status: "failure",
        error: "sync_command_not_resolved",
        durationMs: 0,
      });
      continue;
    }
    runningSyncSchedules.add(schedule.id);
    const startedAt = Date.now();
    updateSyncScheduleRunResult(db, schedule.id, {
      status: "running",
      error: null,
      durationMs: 0,
    });
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stderrChunks = [];
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });
    child.on("error", (error) => {
      runningSyncSchedules.delete(schedule.id);
      updateSyncScheduleRunResult(db, schedule.id, {
        status: "failure",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", (code) => {
      runningSyncSchedules.delete(schedule.id);
      const stderrText = stderrChunks.length
        ? Buffer.concat(stderrChunks).toString("utf8").trim().slice(0, 1000)
        : "";
      updateSyncScheduleRunResult(db, schedule.id, {
        status: code === 0 ? "success" : "failure",
        error: code === 0 ? null : stderrText || `process_exit_${code}`,
        durationMs: Date.now() - startedAt,
      });
    });
  }
}

void execApprovalAutoApprover.start().catch((error) => {
  process.stderr.write(
    `[tenant-platform exec-auto-approve] startup failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
});

void managedNodeSyncWorker.start().catch((error) => {
  process.stderr.write(
    `[tenant-platform managed-node-sync] startup failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
});

setTimeout(() => {
  runScheduledSyncs();
}, 15_000);
setInterval(() => {
  runScheduledSyncs();
}, 60_000);

const server = http.createServer((request, response) => {
  Promise.resolve(handler(request, response)).catch((error) => {
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

server.listen(config.port, config.bindHost, () => {
  process.stdout.write(
    `openclaw tenant platform sidecar listening on http://${config.bindHost}:${config.port}${config.apiBasePath}\n`,
  );
});

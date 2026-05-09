import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  resolveWorkspaceSandboxRunDir,
  readWorkspaceSandboxRunJson,
} from "./db.mjs";

const SIDE_CAR_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SIDE_CAR_DIR, "../../../../");
const PYTHON_RUNNER_PATH = path.join(
  REPO_ROOT,
  "tools",
  "openclaw-sandbox-simulation-starter",
  "python",
  "run_sandbox_simulation.py",
);

function nowIso() {
  return new Date().toISOString();
}

function buildAnalyticsDsn(connection) {
  const host = String(connection?.host || "").trim();
  const database = String(connection?.database || "").trim();
  const user = String(connection?.user || "").trim();
  if (!host || !database || !user) {
    throw new Error("tenant_data_source_invalid");
  }
  const port = Number.parseInt(String(connection?.port || "5432"), 10) || 5432;
  const password = encodeURIComponent(String(connection?.password || ""));
  return `postgresql+psycopg://${encodeURIComponent(user)}:${password}@${host}:${port}/${database}`;
}

function writeRunJson(runDir, fileName, payload) {
  fs.writeFileSync(path.join(runDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readRunJson(runDir, fileName, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

function buildStatusPayload(runId, status, { resultAvailable = false, errorMessage = null } = {}) {
  return {
    runId,
    status,
    resultAvailable,
    errorMessage,
    updatedAt: nowIso(),
  };
}

function buildRunnerInput({ runId, sandbox, binding, orgScope, input }) {
  return {
    runId,
    token: input.token,
    sandboxName: String(sandbox?.sandboxName || "沙盒模拟").trim(),
    agentName: String(sandbox?.agentName || "沙盒模拟助手").trim(),
    question: String(input?.question || "").trim(),
    inputPeriod: {
      startDate: String(input?.inputPeriod?.startDate || "").trim(),
      endDate: String(input?.inputPeriod?.endDate || "").trim(),
    },
    targetPeriod: {
      startDate: String(input?.targetPeriod?.startDate || "").trim(),
      endDate: String(input?.targetPeriod?.endDate || "").trim(),
    },
    selectedDatasetIds: Array.isArray(input?.selectedDatasetIds)
      ? input.selectedDatasetIds.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    selectedMaterialIds: Array.isArray(input?.selectedMaterialIds)
      ? input.selectedMaterialIds.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    dataSource: {
      dataSourceId: binding?.dataSourceId,
      dataSourceName: binding?.dataSourceName,
      sourceTenantCode: binding?.sourceTenantCode ?? null,
      sourceDbid: binding?.sourceDbid ?? null,
      connection: binding?.connection ?? {},
    },
    orgScope: {
      mode: String(orgScope?.scopeMode || "all").trim() || "all",
      allowedOrgIds:
        orgScope?.scopeMode === "custom"
          ? (orgScope?.orgScopes ?? [])
              .map((entry) => String(entry?.orgId || "").trim())
              .filter(Boolean)
          : [],
    },
  };
}

export function getPythonExecutableCandidates(pythonExecutable, platformName = os.platform()) {
  const normalized = String(pythonExecutable || "").trim();
  if (normalized) {
    return [normalized];
  }
  return platformName === "win32" ? ["python", "python3"] : ["python3", "python"];
}

function startPythonRunner({ executable, inputPath, env, cwd, runDir, runId }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const stdoutPath = path.join(runDir, "runner.stdout.log");
    const stderrPath = path.join(runDir, "runner.stderr.log");
    const stdoutFd = fs.openSync(stdoutPath, "a");
    const stderrFd = fs.openSync(stderrPath, "a");
    const child = spawn(executable, [PYTHON_RUNNER_PATH, "--input", inputPath], {
      cwd,
      env,
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd],
      windowsHide: true,
    });

    child.once("spawn", () => {
      settled = true;
      child.on("exit", (code, signal) => {
        const status = readRunJson(runDir, "status.json", null);
        const normalizedStatus = String(status?.status || "").trim().toLowerCase();
        if ((normalizedStatus === "queued" || normalizedStatus === "running") && code !== 0) {
          writeRunJson(
            runDir,
            "status.json",
            buildStatusPayload(runId, "failed", {
              resultAvailable: false,
              errorMessage: signal
                ? `sandbox_runner_exited_signal_${signal}`
                : `sandbox_runner_exit_${String(code ?? "unknown")}`,
            }),
          );
        }
        try {
          fs.closeSync(stdoutFd);
        } catch {}
        try {
          fs.closeSync(stderrFd);
        } catch {}
      });
      child.unref();
      resolve();
    });

    child.once("error", (error) => {
      try {
        fs.closeSync(stdoutFd);
      } catch {}
      try {
        fs.closeSync(stderrFd);
      } catch {}
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
  });
}

export async function submitSandboxRunJob({ sandbox, binding, orgScope, input, pythonExecutable = "" }) {
  const workspaceDir = String(sandbox?.derivedWorkspaceDir || "").trim();
  if (!workspaceDir) {
    throw new Error("sandbox_not_found");
  }
  const runId = `run_${crypto.randomUUID().replace(/-/g, "")}`;
  const runDir = resolveWorkspaceSandboxRunDir(workspaceDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const runnerInput = buildRunnerInput({ runId, sandbox, binding, orgScope, input });
  const inputPath = path.join(runDir, "input.json");
  writeRunJson(runDir, "input.json", runnerInput);
  writeRunJson(runDir, "status.json", buildStatusPayload(runId, "queued"));

  const env = {
    ...process.env,
    SANDBOX_PG_DSN: buildAnalyticsDsn(binding?.connection ?? {}),
    SANDBOX_PG_SCHEMA: String(process.env.SANDBOX_PG_SCHEMA || "sandbox_v1").trim() || "sandbox_v1",
  };
  const candidates = getPythonExecutableCandidates(pythonExecutable);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      await startPythonRunner({
        executable: candidate,
        inputPath,
        env,
        cwd: REPO_ROOT,
        runDir,
        runId,
      });
      return buildStatusPayload(runId, "queued");
    } catch (error) {
      lastError = error;
      if (error?.code !== "ENOENT") {
        break;
      }
    }
  }

  writeRunJson(
    runDir,
    "status.json",
    buildStatusPayload(runId, "failed", {
      resultAvailable: false,
      errorMessage:
        lastError?.code === "ENOENT" ? "sandbox_python_runtime_unavailable" : String(lastError?.message || "sandbox_run_spawn_failed"),
    }),
  );
  throw new Error(
    lastError?.code === "ENOENT" ? "sandbox_python_runtime_unavailable" : String(lastError?.message || "sandbox_run_spawn_failed"),
  );

}

export async function getSandboxRunStatusJob({ sandbox, runId }) {
  const workspaceDir = String(sandbox?.derivedWorkspaceDir || "").trim();
  if (!workspaceDir) {
    throw new Error("sandbox_run_not_found");
  }
  const status =
    readWorkspaceSandboxRunJson(workspaceDir, runId, "status.json", null) ??
    buildStatusPayload(runId, "failed", {
      resultAvailable: false,
      errorMessage: "run_status_unavailable",
    });
  return {
    runId: String(status?.runId || runId).trim() || String(runId || "").trim(),
    status: String(status?.status || "failed").trim() || "failed",
    resultAvailable: Boolean(status?.resultAvailable),
    errorMessage: status?.errorMessage ? String(status.errorMessage) : null,
  };
}

export async function getSandboxRunResultJob({ sandbox, runId }) {
  const workspaceDir = String(sandbox?.derivedWorkspaceDir || "").trim();
  if (!workspaceDir) {
    throw new Error("sandbox_run_not_found");
  }
  const result = readWorkspaceSandboxRunJson(workspaceDir, runId, "result.json", null);
  if (!result) {
    throw new Error("sandbox_run_result_not_found");
  }
  return result;
}

import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRuntimeExtraDependencySpecs,
  resolveInstalledPackageVersion,
} from "../../../tools/openclaw-control-ui-echarts/package-local-runtime.mjs";
import {
  buildOverrideContent,
  buildTenantPlatformExtraDependencySpecs,
  buildTenantPlatformPythonRuntimeDockerArgs,
} from "../../../tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs";

describe("tenant platform runtime deps", () => {
  it("keeps pg in the zero-intrusive runtime dependency set", () => {
    const nodeModulesRoot = path.join(process.cwd(), "node_modules");
    expect(buildRuntimeExtraDependencySpecs(nodeModulesRoot)).toEqual([
      `@aws-sdk/client-bedrock@${resolveInstalledPackageVersion(nodeModulesRoot, "@aws-sdk/client-bedrock")}`,
      `jimp@${resolveInstalledPackageVersion(nodeModulesRoot, "jimp")}`,
      `@jimp/utils@${resolveInstalledPackageVersion(nodeModulesRoot, "@jimp/utils")}`,
      `p-queue@${resolveInstalledPackageVersion(nodeModulesRoot, "p-queue")}`,
      "pg@8.20.0",
    ]);
    expect(buildTenantPlatformExtraDependencySpecs()).toEqual(["pg@8.20.0"]);
  });

  it("injects analytics env and sidecar node_modules through the generated override", () => {
    const override = buildOverrideContent([]);
    expect(override).toContain(
      "OPENCLAW_TENANT_PLATFORM_ANALYTICS_PG_DSN: ${OPENCLAW_TENANT_PLATFORM_ANALYTICS_PG_DSN:-}",
    );
    expect(override).toContain(
      "OPENCLAW_TENANT_PLATFORM_ANALYTICS_DBID: ${OPENCLAW_TENANT_PLATFORM_ANALYTICS_DBID:-}",
    );
    expect(override).toContain(
      "OPENCLAW_TENANT_PLATFORM_ANALYTICS_TENANT_CODE: ${OPENCLAW_TENANT_PLATFORM_ANALYTICS_TENANT_CODE:-}",
    );
    expect(override).toContain(
      "OPENCLAW_TENANT_PLATFORM_ANALYTICS_ENV_FILE: ${OPENCLAW_TENANT_PLATFORM_ANALYTICS_ENV_FILE:-}",
    );
    expect(override).toContain(
      "./tools/openclaw-control-ui-echarts/generated/tenant-platform-runtime/node_modules:/app/tools/openclaw-control-ui-echarts/node_modules:ro",
    );
    expect(override).toContain(
      "./tools/openclaw-sandbox-simulation-starter:/app/tools/openclaw-sandbox-simulation-starter:ro",
    );
    expect(override).toContain(
      "PYTHONPATH: /app/tools/openclaw-control-ui-echarts/generated/tenant-platform-runtime/python-packages",
    );
    expect(override).toContain(
      "./tools/openclaw-control-ui-echarts/generated/tenant-platform-runtime/python-packages:/app/tools/openclaw-control-ui-echarts/generated/tenant-platform-runtime/python-packages:ro",
    );
    expect(override).toContain("${OPENCLAW_WORKSPACE_DIR}:/srv/workspace-downloads:ro");
    expect(override).toContain(
      "${OPENCLAW_CONFIG_DIR}/workspace-agents:/srv/workspace-agent-downloads:ro",
    );
  });

  it("stages sandbox python deps through a linux python container", () => {
    const args = buildTenantPlatformPythonRuntimeDockerArgs(
      "E:/Code/work/open-claw",
      "openclaw:local",
    );
    expect(args).toEqual([
      "run",
      "--rm",
      "-u",
      "0",
      "-v",
      "E:/Code/work/open-claw:/work",
      "-w",
      "/work",
      "openclaw:local",
      "sh",
      "-lc",
      "python3 -m pip --version >/dev/null 2>&1 || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-pip python3-venv build-essential); python3 -m pip install --break-system-packages --no-cache-dir --prefer-binary --target /work/tools/openclaw-control-ui-echarts/generated/tenant-platform-runtime/python-packages -r /work/tools/openclaw-sandbox-simulation-starter/requirements.txt",
    ]);
  });
});

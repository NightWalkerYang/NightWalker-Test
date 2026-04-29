import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildRuntimeExtraDependencySpecs,
  resolveInstalledPackageVersion,
} from "../../../tools/openclaw-control-ui-echarts/package-local-runtime.mjs";
import {
  buildOverrideContent,
  buildTenantPlatformExtraDependencySpecs,
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
  });
});

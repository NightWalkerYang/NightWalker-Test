import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  parseRuntimeEnvFile,
  prepareLocalRuntime,
  resolveRuntimeEnv,
  syncControlUiBootstrapScripts,
} from "../../../tools/openclaw-control-ui-echarts/local-runtime/runtime-common.mjs";

const tempDirs = [];

function createTempDir() {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-local-runtime-common-"));
  tempDirs.push(dirPath);
  return dirPath;
}

describe("local runtime common", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dirPath = tempDirs.pop();
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });

  it("parses simple runtime env files", () => {
    expect(
      parseRuntimeEnvFile(`
# comment
OPENCLAW_GATEWAY_TOKEN="abc"
OPENCLAW_GATEWAY_PORT=19999
`),
    ).toEqual({
      OPENCLAW_GATEWAY_TOKEN: "abc",
      OPENCLAW_GATEWAY_PORT: "19999",
    });
  });

  it("resolves local runtime defaults under the package root", () => {
    const rootDir = path.join("runtime-root");
    const resolved = resolveRuntimeEnv(rootDir, {});
    expect(resolved.env.OPENCLAW_TENANT_PLATFORM_EDITION).toBe("local");
    expect(resolved.env.OPENCLAW_TENANT_PLATFORM_NODE_ROLE).toBe("standalone-local");
    expect(resolved.env.OPENCLAW_GATEWAY_BIND).toBe("loopback");
    expect(resolved.env.OPENCLAW_GATEWAY_PORT).toBe("18789");
    expect(resolved.env.OPENCLAW_TENANT_PLATFORM_PORT).toBe("18801");
    expect(resolved.env.OPENCLAW_CONFIG_DIR).toBe(path.resolve(rootDir, "data/.openclaw"));
    expect(resolved.env.OPENCLAW_WORKSPACE_DIR).toBe(path.resolve(rootDir, "data/workspace"));
    expect(resolved.controlUiIndexPath).toBe(
      path.resolve(rootDir, "runtime/node_modules/openclaw/dist/control-ui/index.html"),
    );
  });

  it("syncs all control-ui bootstrap tokens", () => {
    const initial = [
      "<html>",
      "  <head>",
      '    <script type="module" crossorigin src="./assets/index-realhash.js"></script>',
      '    <script type="module" src="./assets/runtime/echarts-view/preboot.js" data-openclaw-echarts-view-bootstrap></script>',
      '    <script src="./assets/runtime/branding/auto-token-preboot.js" data-openclaw-auto-token-bootstrap data-gateway-token="old"></script>',
      '    <script src="./assets/runtime/lufeng/preboot.js" data-openclaw-lufeng-bootstrap data-gateway-token="old"></script>',
      "  </head>",
      "</html>",
    ].join("\n");
    const updated = syncControlUiBootstrapScripts(initial, "next-token");
    expect(updated).toContain('data-openclaw-echarts-view-bootstrap');
    expect(updated).toContain('data-openclaw-auto-token-bootstrap data-gateway-token="next-token"');
    expect(updated).toContain('data-openclaw-lufeng-bootstrap data-gateway-token="next-token"');
    expect(updated).not.toContain('data-gateway-token="old"');
    expect(updated.indexOf("data-openclaw-echarts-view-bootstrap")).toBeLessThan(
      updated.indexOf("data-openclaw-auto-token-bootstrap"),
    );
    expect(updated.indexOf("data-openclaw-echarts-view-bootstrap")).toBeLessThan(
      updated.indexOf("assets/index-realhash.js"),
    );
    expect(updated.indexOf("data-openclaw-auto-token-bootstrap")).toBeLessThan(
      updated.indexOf("assets/index-realhash.js"),
    );
    expect(updated.indexOf("data-openclaw-lufeng-bootstrap")).toBeLessThan(
      updated.indexOf("./assets/index-realhash.js"),
    );
  });

  it("seeds the runtime config file from the packaged template when missing", () => {
    const rootDir = createTempDir();
    const packageRoot = path.join(rootDir, "runtime", "node_modules", "openclaw");
    fs.mkdirSync(path.join(packageRoot, "dist", "control-ui"), { recursive: true });
    fs.mkdirSync(
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "sidecar",
        "tenant-platform",
      ),
      { recursive: true },
    );
    fs.writeFileSync(path.join(packageRoot, "openclaw.mjs"), "export {};\n");
    fs.writeFileSync(
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "sidecar",
        "tenant-platform",
        "server.mjs",
      ),
      "export {};\n",
    );
    fs.writeFileSync(
      path.join(packageRoot, "dist", "control-ui", "index.html"),
      "<html><head></head><body></body></html>\n",
    );
    fs.writeFileSync(path.join(rootDir, "openclaw.local.example.json5"), "{ gateway: { mode: 'local' } }\n");

    const prepared = prepareLocalRuntime(rootDir, {});
    expect(fs.existsSync(prepared.env.OPENCLAW_CONFIG_PATH)).toBe(true);
    expect(fs.readFileSync(prepared.env.OPENCLAW_CONFIG_PATH, "utf8")).toContain("mode");
  });
});

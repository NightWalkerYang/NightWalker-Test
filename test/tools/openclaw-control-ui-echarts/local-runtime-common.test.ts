import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseRuntimeEnvFile,
  prepareLocalRuntime,
  runControlUiPreflight,
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
      '    <script type="module" src="./assets/openclaw-echarts/fingerprint123/runtime/echarts-view/preboot.js" data-openclaw-echarts-view-bootstrap></script>',
      '    <script src="./assets/openclaw-echarts/fingerprint123/runtime/branding/auto-token-preboot.js" data-openclaw-auto-token-bootstrap data-gateway-token="old"></script>',
      '    <script src="./assets/openclaw-echarts/fingerprint123/runtime/lufeng/preboot.js" data-openclaw-lufeng-bootstrap data-gateway-token="old"></script>',
      "  </head>",
      "</html>",
    ].join("\n");
    const updated = syncControlUiBootstrapScripts(initial, "next-token");
    expect(updated).toContain("data-openclaw-echarts-view-bootstrap");
    expect(updated).toContain(
      "./assets/openclaw-echarts/fingerprint123/runtime/echarts-view/preboot.js",
    );
    expect(updated).toContain(
      "./assets/openclaw-echarts/fingerprint123/runtime/branding/auto-token-preboot.js",
    );
    expect(updated).toContain("./assets/openclaw-echarts/fingerprint123/runtime/lufeng/preboot.js");
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
      path.join(packageRoot, "tools", "openclaw-control-ui-echarts", "sidecar", "tenant-platform"),
      { recursive: true },
    );
    fs.mkdirSync(
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "workspace-overlays",
        "kingdee-cloud",
        "hooks",
        "tenant-member-bootstrap-filter",
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
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "workspace-overlays",
        "kingdee-cloud",
        "hooks",
        "tenant-member-bootstrap-filter",
        "HOOK.md",
      ),
      "---\nname: tenant-member-bootstrap-filter\n---\n",
    );
    fs.writeFileSync(
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "workspace-overlays",
        "kingdee-cloud",
        "hooks",
        "tenant-member-bootstrap-filter",
        "handler.js",
      ),
      "export default function noop() {}\n",
    );
    fs.writeFileSync(
      path.join(packageRoot, "dist", "control-ui", "index.html"),
      "<html><head></head><body></body></html>\n",
    );
    fs.writeFileSync(
      path.join(rootDir, "openclaw.local.example.json5"),
      "{ gateway: { mode: 'local' } }\n",
    );

    const prepared = prepareLocalRuntime(rootDir, {
      OPENCLAW_SKIP_CONTROL_UI_PREFLIGHT: "1",
    });
    expect(fs.existsSync(prepared.env.OPENCLAW_CONFIG_PATH)).toBe(true);
    expect(fs.readFileSync(prepared.env.OPENCLAW_CONFIG_PATH, "utf8")).toContain("mode");
    expect(
      fs.existsSync(
        path.join(
          prepared.env.OPENCLAW_CONFIG_DIR,
          "hooks",
          "tenant-member-bootstrap-filter",
          "HOOK.md",
        ),
      ),
    ).toBe(true);
    expect(
      fs.readFileSync(
        path.join(
          prepared.env.OPENCLAW_CONFIG_DIR,
          "hooks",
          "tenant-member-bootstrap-filter",
          "handler.js",
        ),
        "utf8",
      ),
    ).toContain("noop");
  });

  it("fails preflight when control-ui build manifest is missing", () => {
    const rootDir = createTempDir();
    const packageRoot = path.join(rootDir, "runtime", "node_modules", "openclaw");
    fs.mkdirSync(path.join(packageRoot, "dist", "control-ui"), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, "tools", "openclaw-control-ui-echarts"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(packageRoot, "dist", "control-ui", "index.html"), "<html></html>\n");

    const runtime = resolveRuntimeEnv(rootDir, {});
    expect(() => runControlUiPreflight(runtime)).toThrow(/control_ui_preflight_manifest_missing/);
  });

  it("passes preflight for a valid control-ui manifest and assets", () => {
    const rootDir = createTempDir();
    const packageRoot = path.join(rootDir, "runtime", "node_modules", "openclaw");
    const controlUiRoot = path.join(packageRoot, "dist", "control-ui");
    fs.mkdirSync(
      path.join(controlUiRoot, "assets", "openclaw-echarts", "fp", "runtime", "tenant"),
      {
        recursive: true,
      },
    );
    fs.mkdirSync(
      path.join(controlUiRoot, "assets", "openclaw-echarts", "fp", "runtime", "branding"),
      { recursive: true },
    );
    fs.mkdirSync(
      path.join(controlUiRoot, "assets", "openclaw-echarts", "fp", "runtime", "lufeng"),
      {
        recursive: true,
      },
    );
    fs.mkdirSync(
      path.join(controlUiRoot, "assets", "openclaw-echarts", "fp", "runtime", "echarts-view"),
      { recursive: true },
    );
    fs.mkdirSync(path.join(controlUiRoot, "assets", "openclaw-echarts", "fp"), { recursive: true });
    fs.mkdirSync(path.join(controlUiRoot, "login"), { recursive: true });
    fs.mkdirSync(path.join(controlUiRoot, "echarts-view"), { recursive: true });
    fs.mkdirSync(path.join(controlUiRoot, "assets"), { recursive: true });
    fs.writeFileSync(path.join(controlUiRoot, "assets", "index-realhash.js"), "export {};\n");
    fs.writeFileSync(
      path.join(
        controlUiRoot,
        "assets",
        "openclaw-echarts",
        "fp",
        "runtime",
        "tenant",
        "preboot.js",
      ),
      "export {};\n",
    );
    fs.writeFileSync(
      path.join(
        controlUiRoot,
        "assets",
        "openclaw-echarts",
        "fp",
        "runtime",
        "branding",
        "auto-token-preboot.js",
      ),
      "export {};\n",
    );
    fs.writeFileSync(
      path.join(
        controlUiRoot,
        "assets",
        "openclaw-echarts",
        "fp",
        "runtime",
        "lufeng",
        "preboot.js",
      ),
      "export {};\n",
    );
    fs.writeFileSync(
      path.join(
        controlUiRoot,
        "assets",
        "openclaw-echarts",
        "fp",
        "runtime",
        "echarts-view",
        "preboot.js",
      ),
      "export {};\n",
    );
    fs.writeFileSync(
      path.join(controlUiRoot, "assets", "openclaw-echarts", "fp", "openclaw-echarts-renderer.js"),
      "export {};\n",
    );

    const runtimeBase = "./assets/openclaw-echarts/fp/runtime";
    const rendererRelative = "./assets/openclaw-echarts/fp/openclaw-echarts-renderer.js";
    const rendererAbsolute = "/assets/openclaw-echarts/fp/openclaw-echarts-renderer.js";
    const indexHtml = [
      "<html>",
      "  <head>",
      '    <style data-openclaw-tenant-boot-lock-style>:root[data-oc-tenant-boot-lock="login"] body { overflow: hidden; }</style>',
      `    <script type="module" src="${runtimeBase}/echarts-view/preboot.js" data-openclaw-echarts-view-bootstrap></script>`,
      `    <script src="${runtimeBase}/tenant/preboot.js" data-openclaw-tenant-preboot></script>`,
      `    <script src="${runtimeBase}/lufeng/preboot.js" data-openclaw-lufeng-bootstrap data-gateway-token="token-a"></script>`,
      `    <script src="${runtimeBase}/branding/auto-token-preboot.js" data-openclaw-auto-token-bootstrap data-gateway-token="token-a"></script>`,
      '    <script type="module" crossorigin src="./assets/index-realhash.js"></script>',
      "  </head>",
      "  <body>",
      `    <script type="module" src="${rendererRelative}"></script>`,
      "  </body>",
      "</html>",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(controlUiRoot, "index.html"), indexHtml);
    fs.writeFileSync(path.join(controlUiRoot, "login", "index.html"), '<base href="/" />\n');
    fs.writeFileSync(path.join(controlUiRoot, "login.html"), '<base href="/" />\n');
    fs.writeFileSync(
      path.join(controlUiRoot, "echarts-view", "index.html"),
      `<script type="module" src="${rendererAbsolute}"></script>\n`,
    );
    fs.writeFileSync(
      path.join(controlUiRoot, "openclaw-control-ui-build-manifest.json"),
      JSON.stringify(
        {
          sourceMainBundleScriptSrc: "./assets/index-realhash.js",
          runtimeAssetBaseRelativePath: runtimeBase,
          rendererAssetRelativePath: rendererRelative,
          rendererAssetAbsolutePath: rendererAbsolute,
          deploymentDecision: {
            mode: "update-zero-intrusive-artifacts-only",
            requiresGatewayImageRebuild: false,
            reason: "test",
          },
        },
        null,
        2,
      ),
    );

    const runtime = resolveRuntimeEnv(rootDir, {});
    const result = runControlUiPreflight(runtime);
    expect(result.runtimeAssetBaseRelativePath).toBe(runtimeBase);
    expect(result.rendererAssetRelativePath).toBe(rendererRelative);
    expect(result.deploymentDecision?.mode).toBe("update-zero-intrusive-artifacts-only");
  });

  it("skips preflight when OPENCLAW_SKIP_CONTROL_UI_PREFLIGHT is set", () => {
    const rootDir = createTempDir();
    const packageRoot = path.join(rootDir, "runtime", "node_modules", "openclaw");
    fs.mkdirSync(path.join(packageRoot, "dist", "control-ui"), { recursive: true });
    fs.mkdirSync(
      path.join(packageRoot, "tools", "openclaw-control-ui-echarts", "sidecar", "tenant-platform"),
      { recursive: true },
    );
    fs.mkdirSync(
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "workspace-overlays",
        "kingdee-cloud",
        "hooks",
        "tenant-member-bootstrap-filter",
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
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "workspace-overlays",
        "kingdee-cloud",
        "hooks",
        "tenant-member-bootstrap-filter",
        "HOOK.md",
      ),
      "---\nname: tenant-member-bootstrap-filter\n---\n",
    );
    fs.writeFileSync(
      path.join(
        packageRoot,
        "tools",
        "openclaw-control-ui-echarts",
        "workspace-overlays",
        "kingdee-cloud",
        "hooks",
        "tenant-member-bootstrap-filter",
        "handler.js",
      ),
      "export default function noop() {}\n",
    );
    fs.writeFileSync(
      path.join(packageRoot, "dist", "control-ui", "index.html"),
      "<html><head></head><body></body></html>\n",
    );
    fs.writeFileSync(
      path.join(rootDir, "openclaw.local.example.json5"),
      "{ gateway: { mode: 'local' } }\n",
    );

    const prepared = prepareLocalRuntime(rootDir, {
      OPENCLAW_SKIP_CONTROL_UI_PREFLIGHT: "1",
    });
    expect(prepared.controlUiPreflight).toBeNull();
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseRuntimeEnvFile,
  resolveRuntimeEnv,
  syncControlUiBootstrapScripts,
} from "../../../tools/openclaw-control-ui-echarts/local-runtime/runtime-common.mjs";

describe("local runtime common", () => {
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
    expect(resolved.env.OPENCLAW_GATEWAY_BIND).toBe("lan");
    expect(resolved.env.OPENCLAW_GATEWAY_PORT).toBe("18789");
    expect(resolved.env.OPENCLAW_TENANT_PLATFORM_PORT).toBe("18801");
    expect(resolved.env.OPENCLAW_CONFIG_DIR).toBe(path.resolve(rootDir, "data/.openclaw"));
    expect(resolved.env.OPENCLAW_WORKSPACE_DIR).toBe(path.resolve(rootDir, "data/workspace"));
    expect(resolved.controlUiIndexPath).toBe(
      path.resolve(rootDir, "runtime/node_modules/openclaw/dist/control-ui/index.html"),
    );
  });

  it("syncs both control-ui bootstrap tokens", () => {
    const initial = [
      "<html>",
      "  <head>",
      '    <script src="./assets/runtime/branding/auto-token-preboot.js" data-openclaw-auto-token-bootstrap data-gateway-token="old"></script>',
      '    <script src="./assets/runtime/lufeng/preboot.js" data-openclaw-lufeng-bootstrap data-gateway-token="old"></script>',
      "  </head>",
      "</html>",
    ].join("\n");
    const updated = syncControlUiBootstrapScripts(initial, "next-token");
    expect(updated).toContain('data-openclaw-auto-token-bootstrap data-gateway-token="next-token"');
    expect(updated).toContain('data-openclaw-lufeng-bootstrap data-gateway-token="next-token"');
    expect(updated).not.toContain('data-gateway-token="old"');
  });
});

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildRuntimeExtraDependencySpecs,
  patchFileTypeRuntimeCompat,
  resolveInstalledPackageVersion,
} from "../../../tools/openclaw-control-ui-echarts/package-local-runtime.mjs";

const tempDirs = [];

function createTempDir() {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-local-runtime-test-"));
  tempDirs.push(dirPath);
  return dirPath;
}

describe("package local runtime", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dirPath = tempDirs.pop();
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });

  it("resolves installed package versions from node_modules", () => {
    const nodeModulesRoot = path.join(process.cwd(), "node_modules");
    expect(resolveInstalledPackageVersion(nodeModulesRoot, "@aws-sdk/client-bedrock")).toMatch(
      /^\d+\.\d+\.\d+$/,
    );
    expect(resolveInstalledPackageVersion(nodeModulesRoot, "jimp")).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("builds exact dependency specs for runtime extras", () => {
    const nodeModulesRoot = path.join(process.cwd(), "node_modules");
    const specs = buildRuntimeExtraDependencySpecs(nodeModulesRoot);
    expect(specs).toEqual([
      `@aws-sdk/client-bedrock@${resolveInstalledPackageVersion(nodeModulesRoot, "@aws-sdk/client-bedrock")}`,
      `jimp@${resolveInstalledPackageVersion(nodeModulesRoot, "jimp")}`,
      `@jimp/utils@${resolveInstalledPackageVersion(nodeModulesRoot, "@jimp/utils")}`,
      `p-queue@${resolveInstalledPackageVersion(nodeModulesRoot, "p-queue")}`,
    ]);
  });

  it("builds custom control-ui with stable /login aliases", () => {
    const sourceDir = path.join(createTempDir(), "source-ui");
    const outputDir = path.join(createTempDir(), "output-ui");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(
      path.join(sourceDir, "index.html"),
      [
        "<html>",
        "  <head>",
        '    <script type="module" crossorigin src="./assets/index-realhash.js"></script>',
        "  </head>",
        "  <body>",
        "    ok",
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
      "utf8",
    );

    const scriptPath = path.join(
      process.cwd(),
      "tools",
      "openclaw-control-ui-echarts",
      "build-custom-control-ui.mjs",
    );
    const buildArgs = [scriptPath, "--source", sourceDir, "--output", outputDir];
    const firstBuild = spawnSync(process.execPath, buildArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(firstBuild.status, firstBuild.stderr || firstBuild.stdout).toBe(0);

    const secondBuild = spawnSync(process.execPath, buildArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(secondBuild.status, secondBuild.stderr || secondBuild.stdout).toBe(0);
    expect(fs.existsSync(path.join(outputDir, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "login", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "login.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "echarts-view", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "echarts.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "echarts-gl.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "gsap.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "tsparticles.bundle.min.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "pixi.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "babylon.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "three.module.min.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "three"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "json5.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "runtime", "echarts", "echarts.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "runtime", "echarts", "json5.min.js"))).toBe(true);

    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf8");
    expect(indexHtml).toContain("data-openclaw-echarts-view-bootstrap");
    expect(indexHtml.indexOf("data-openclaw-echarts-view-bootstrap")).toBeLessThan(
      indexHtml.indexOf("data-openclaw-lufeng-bootstrap"),
    );
    expect(indexHtml.indexOf("data-openclaw-echarts-view-bootstrap")).toBeLessThan(
      indexHtml.indexOf("./assets/index-realhash.js"),
    );
    expect(indexHtml.indexOf("data-openclaw-lufeng-bootstrap")).toBeLessThan(
      indexHtml.indexOf("./assets/index-realhash.js"),
    );
    const echartsViewIndex = fs.readFileSync(
      path.join(outputDir, "echarts-view", "index.html"),
      "utf8",
    );
    expect(echartsViewIndex).toContain("/assets/openclaw-echarts-renderer.js");
    const loginIndex = fs.readFileSync(path.join(outputDir, "login", "index.html"), "utf8");
    const loginHtml = fs.readFileSync(path.join(outputDir, "login.html"), "utf8");
    expect(loginIndex).toContain('<base href="/" />');
    expect(loginHtml).toContain('<base href="/" />');
  });

  it("keeps bash direct-docker setup hook sync aligned with the node helper", () => {
    const shellScript = fs.readFileSync(
      path.join(
        process.cwd(),
        "tools",
        "openclaw-control-ui-echarts",
        "setup-direct-docker-compose-up.sh",
      ),
      "utf8",
    );

    expect(shellScript).toContain("sync_tenant_member_bootstrap_hook_config()");
    expect(shellScript).toContain("sync_managed_tenant_member_bootstrap_hook()");
    expect(shellScript).toContain(
      'hooks.internal.entries[tenant-member-bootstrap-filter].enabled',
    );
    expect(shellScript).toContain('managed_hooks_dir="$config_dir/hooks"');
    expect(shellScript).toContain("sync_tenant_member_bootstrap_hook_config\n");
    expect(shellScript).toContain("sync_managed_tenant_member_bootstrap_hook\n");

    const nodeScript = fs.readFileSync(
      path.join(
        process.cwd(),
        "tools",
        "openclaw-control-ui-echarts",
        "setup-direct-docker-compose-up.mjs",
      ),
      "utf8",
    );
    expect(nodeScript).toContain("function syncManagedTenantMemberBootstrapHook()");
    expect(nodeScript).toContain('path.join(resolveOpenclawConfigDir(), "hooks")');
    expect(nodeScript).toContain("syncManagedTenantMemberBootstrapHook();");
  });

  it("patches file-type runtime compat with core.js export", () => {
    const runtimeDir = path.join(createTempDir(), "runtime");
    const fileTypeDir = path.join(runtimeDir, "node_modules", "file-type");
    fs.mkdirSync(path.join(fileTypeDir, "source"), { recursive: true });
    fs.writeFileSync(path.join(fileTypeDir, "source", "index.js"), "export const noop = true;\n");
    fs.writeFileSync(
      path.join(fileTypeDir, "package.json"),
      JSON.stringify({
        name: "file-type",
        version: "22.0.0",
        exports: {
          ".": "./source/index.js",
        },
      }),
      "utf8",
    );

    patchFileTypeRuntimeCompat(runtimeDir);

    const compatFile = path.join(fileTypeDir, "core.js");
    expect(fs.existsSync(compatFile)).toBe(true);
    const compatSource = fs.readFileSync(compatFile, "utf8");
    expect(compatSource).toContain('from "./source/index.js"');

    const packageJson = JSON.parse(fs.readFileSync(path.join(fileTypeDir, "package.json"), "utf8"));
    expect(packageJson.exports["./core.js"]).toBe("./core.js");
    expect(packageJson.exports["."]).toBe("./source/index.js");
  });

  it("normalizes file-type conditional main exports before adding core.js", () => {
    const runtimeDir = path.join(createTempDir(), "runtime");
    const fileTypeDir = path.join(runtimeDir, "node_modules", "file-type");
    fs.mkdirSync(path.join(fileTypeDir, "source"), { recursive: true });
    fs.writeFileSync(path.join(fileTypeDir, "source", "index.js"), "export const noop = true;\n");
    fs.writeFileSync(
      path.join(fileTypeDir, "package.json"),
      JSON.stringify({
        name: "file-type",
        version: "22.0.0",
        exports: {
          types: "./source/index.d.ts",
          default: "./source/index.js",
        },
      }),
      "utf8",
    );

    patchFileTypeRuntimeCompat(runtimeDir);

    const packageJson = JSON.parse(fs.readFileSync(path.join(fileTypeDir, "package.json"), "utf8"));
    expect(packageJson.exports["./core.js"]).toBe("./core.js");
    expect(packageJson.exports["."]).toEqual({
      types: "./source/index.d.ts",
      default: "./source/index.js",
    });
  });
});

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
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

function normalizePosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

function collectFilesRecursively(rootDir: string) {
  const files: Array<{ fullPath: string; relativePath: string }> = [];
  const walk = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      files.push({
        fullPath,
        relativePath: normalizePosixPath(path.relative(rootDir, fullPath)),
      });
    }
  };
  walk(rootDir);
  return files;
}

function computeExpectedRuntimeFingerprint() {
  const repoRoot = process.cwd();
  const runtimeScriptPath = path.join(
    repoRoot,
    "tools",
    "openclaw-control-ui-echarts",
    "openclaw-echarts-renderer.js",
  );
  const runtimeDir = path.join(repoRoot, "tools", "openclaw-control-ui-echarts", "runtime");
  const staticDir = path.join(repoRoot, "tools", "openclaw-control-ui-echarts", "static");
  const vendorDir = path.join(repoRoot, "tools", "openclaw-control-ui-echarts", "vendor");
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(runtimeScriptPath));
  for (const directory of [runtimeDir, staticDir, vendorDir]) {
    for (const file of collectFilesRecursively(directory)) {
      hash.update(`\nfile:${file.relativePath}\n`);
      hash.update(fs.readFileSync(file.fullPath));
    }
  }
  return hash.digest("hex").slice(0, 16);
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
      "pg@8.20.0",
    ]);
  });

  it("stages the optional desktop shell template when requested", () => {
    const outputDir = createTempDir();
    const scriptPath = path.join(
      process.cwd(),
      "tools",
      "openclaw-control-ui-echarts",
      "package-local-runtime.mjs",
    );
    const result = spawnSync(
      process.execPath,
      [scriptPath, "--output", outputDir, "--skip-install", "--with-desktop-shell"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: "desktop-shell-test-token" },
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(fs.existsSync(path.join(outputDir, "desktop", "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "desktop", "src-tauri", "tauri.conf.json"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(outputDir, "desktop", "src-tauri", "capabilities", "default.json")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(outputDir, "desktop", "scripts", "openclaw-desktop-runtime.mjs")),
    ).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "start-desktop-shell.cmd"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "start-desktop-shell.sh"))).toBe(true);

    const tauriConfig = JSON.parse(
      fs.readFileSync(path.join(outputDir, "desktop", "src-tauri", "tauri.conf.json"), "utf8"),
    );
    expect(tauriConfig.bundle.resources).toEqual(
      expect.objectContaining({
        "../../runtime": "local-runtime/runtime",
        "../../scripts": "local-runtime/scripts",
        "../../data": "local-runtime/data",
        "../../runtime.env": "local-runtime/runtime.env",
      }),
    );

    const helperScript = fs.readFileSync(
      path.join(outputDir, "desktop", "scripts", "openclaw-desktop-runtime.mjs"),
      "utf8",
    );
    expect(helperScript).toContain("start-local-runtime.mjs");
    expect(helperScript).toContain("/tenant-platform-api/v1/healthz");
    expect(helperScript).toContain("OPENCLAW_TENANT_PLATFORM_PORT");
    expect(fs.readFileSync(path.join(outputDir, "desktop", "src", "main.js"), "utf8")).toContain(
      "openclaw:tenant-platform:api-base:v1",
    );
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
    const buildEnv = { ...process.env, OPENCLAW_GATEWAY_TOKEN: "test-runtime-token" };
    const firstBuild = spawnSync(process.execPath, buildArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      env: buildEnv,
    });
    expect(firstBuild.status, firstBuild.stderr || firstBuild.stdout).toBe(0);

    const secondBuild = spawnSync(process.execPath, buildArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      env: buildEnv,
    });
    expect(secondBuild.status, secondBuild.stderr || secondBuild.stdout).toBe(0);
    expect(fs.existsSync(path.join(outputDir, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "login", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "login.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "echarts-view", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "echarts.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "echarts-gl.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "gsap.min.js"))).toBe(true);
    expect(
      fs.existsSync(path.join(outputDir, "assets", "vendor", "tsparticles.bundle.min.js")),
    ).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "pixi.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "babylon.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "three.module.min.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "three"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "assets", "vendor", "json5.min.js"))).toBe(true);
    expect(
      fs.existsSync(path.join(outputDir, "assets", "runtime", "echarts", "echarts.min.js")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(outputDir, "assets", "runtime", "echarts", "json5.min.js")),
    ).toBe(true);

    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf8");
    const expectedFingerprint = computeExpectedRuntimeFingerprint();
    const expectedRuntimeBasePath = `./assets/openclaw-echarts/${expectedFingerprint}/runtime`;
    const expectedRendererRelativePath = `./assets/openclaw-echarts/${expectedFingerprint}/openclaw-echarts-renderer.js`;
    const expectedRendererAbsolutePath = `/assets/openclaw-echarts/${expectedFingerprint}/openclaw-echarts-renderer.js`;
    expect(indexHtml).toContain("data-openclaw-echarts-view-bootstrap");
    expect(indexHtml).toContain("data-openclaw-tenant-boot-lock-style");
    expect(indexHtml).toContain("data-oc-tenant-boot-lock");
    expect(indexHtml).toContain(expectedRuntimeBasePath);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/tenant/preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/branding/auto-token-preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/lufeng/preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/echarts-view/preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/sandbox-view/preboot.js`);
    expect(indexHtml).toContain(expectedRendererRelativePath);
    expect(indexHtml).toContain("data-openclaw-tenant-preboot");
    expect(indexHtml).toContain("data-openclaw-sandbox-view-bootstrap");
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
    expect(echartsViewIndex).toContain(expectedRendererAbsolutePath);
    expect(
      fs.existsSync(
        path.join(
          outputDir,
          "assets",
          "openclaw-echarts",
          expectedFingerprint,
          "openclaw-echarts-renderer.js",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          outputDir,
          "assets",
          "openclaw-echarts",
          expectedFingerprint,
          "runtime",
          "tenant",
          "preboot.js",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          outputDir,
          "assets",
          "openclaw-echarts",
          expectedFingerprint,
          "vendor",
          "echarts.min.js",
        ),
      ),
    ).toBe(true);
    const loginIndex = fs.readFileSync(path.join(outputDir, "login", "index.html"), "utf8");
    const loginHtml = fs.readFileSync(path.join(outputDir, "login.html"), "utf8");
    expect(loginIndex).toContain('<base href="/" />');
    expect(loginHtml).toContain('<base href="/" />');

    const buildManifestPath = path.join(outputDir, "openclaw-control-ui-build-manifest.json");
    expect(fs.existsSync(buildManifestPath)).toBe(true);
    const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8"));
    expect(buildManifest.sourceFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(buildManifest.runtimeFingerprint).toBe(expectedFingerprint);
    expect(buildManifest.runtimeAssetBaseRelativePath).toBe(expectedRuntimeBasePath);
    expect(buildManifest.rendererAssetRelativePath).toBe(expectedRendererRelativePath);
    expect(buildManifest.rendererAssetAbsolutePath).toBe(expectedRendererAbsolutePath);
    expect(buildManifest.checks?.smokeChecksPassed).toBe(true);
    expect(buildManifest.deploymentDecision?.mode).toBe("already-in-sync");
    expect(buildManifest.deploymentDecision?.requiresGatewayImageRebuild).toBe(false);
    expect(buildManifest.deploymentDecision?.reason).toContain("unchanged");
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
    expect(shellScript).toContain("hooks.internal.entries[tenant-member-bootstrap-filter].enabled");
    expect(shellScript).toContain('managed_hooks_dir="$config_dir/hooks"');
    expect(shellScript).toContain("sync_tenant_member_bootstrap_hook_config\n");
    expect(shellScript).toContain("sync_managed_tenant_member_bootstrap_hook\n");
    expect(shellScript).toContain('node "$TOOL_DIR/build-custom-control-ui.mjs"');
    expect(shellScript).toContain('--source "$source_dir"');
    expect(shellScript).toContain('--output "$OUTPUT_DIR"');
    expect(shellScript).toContain("ensure_gateway_service_image_current()");
    expect(shellScript).toContain("docker compose build openclaw-gateway");
    expect(shellScript).toContain("OPENCLAW_SKIP_GATEWAY_IMAGE_BUILD");
    expect(shellScript).toContain("gateway_image_matches_current_checkout_for_direct_deploy()");
    expect(shellScript).toContain("read_image_buildstamp_head()");
    expect(shellScript).toContain("git_diff_requires_gateway_image_build()");
    expect(shellScript).toContain("host_control_ui_matches_current_checkout()");
    expect(shellScript).toContain("dist/.buildstamp");
    expect(shellScript).toContain(
      "Host dist/control-ui matches the current git checkout; using it as the upstream Control UI source",
    );
    expect(shellScript).toContain(
      "Host dist/control-ui exists but is not stamped for the current git checkout; rebuilding gateway image and extracting /app/dist/control-ui instead",
    );
    expect(shellScript).toContain(
      "Host dist/control-ui exists but is not stamped for the current git checkout; reusing the current gateway image because only zero-intrusive files changed since it was built",
    );
    expect(shellScript).toContain(
      "Host dist/control-ui is missing; reusing the current gateway image because only zero-intrusive files changed since it was built",
    );
    expect(shellScript).toContain(
      "Skipped docker compose build for openclaw-gateway because the current image already covers this checkout",
    );
    expect(shellScript).toContain("run_custom_control_ui_builder()");
    expect(shellScript).toContain("docker run --rm \\");
    expect(shellScript).toContain('-v "$ROOT_DIR:/workspace" \\');
    expect(shellScript).toContain('-v "$config_dir:/tmp/openclaw-config:ro" \\');
    expect(shellScript).toContain("-e OPENCLAW_CONFIG_DIR=/tmp/openclaw-config \\");
    expect(shellScript).toContain('-e OPENCLAW_GATEWAY_TOKEN="$auto_gateway_token" \\');
    expect(shellScript).toContain('-v "$source_dir:/tmp/openclaw-source-ui:ro" \\');
    expect(shellScript).toContain(
      "node /workspace/tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs \\",
    );
    expect(shellScript).not.toContain(
      'inject_auto_gateway_token_bootstrap "$OUTPUT_DIR/index.html"',
    );
    expect(shellScript).not.toContain('inject_lufeng_public_bootstrap "$OUTPUT_DIR/index.html"');
    expect(shellScript).not.toContain(
      'inject_echarts_view_public_bootstrap "$OUTPUT_DIR/index.html"',
    );

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
    expect(nodeScript).toContain("function ensureGatewayServiceImageCurrent()");
    expect(nodeScript).toContain("function shouldSkipGatewayImageBuild()");
    expect(nodeScript).toContain(
      "function gatewayImageMatchesCurrentCheckoutForDirectDeploy(imageRef)",
    );
    expect(nodeScript).toContain("function hostControlUiMatchesCurrentCheckout()");
    expect(nodeScript).toContain("function readImageBuildstampHead(imageRef)");
    expect(nodeScript).toContain("function resolveSourceDirFromImage(imageRef)");
    expect(nodeScript).toContain('["compose", "build", "openclaw-gateway"]');
    expect(nodeScript).toContain("OPENCLAW_SKIP_GATEWAY_IMAGE_BUILD=1");
    expect(nodeScript).toContain(
      "Host dist/control-ui matches the current git checkout; using it as the upstream Control UI source",
    );
    expect(nodeScript).toContain(
      "Host dist/control-ui exists but is not stamped for the current git checkout; reusing the current gateway image because only zero-intrusive files changed since it was built",
    );
    expect(nodeScript).toContain(
      "Skipped docker compose build for openclaw-gateway because the current image already covers this checkout",
    );
    expect(nodeScript).toContain("buildCustomControlUiFromSource(sourceDir);");
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

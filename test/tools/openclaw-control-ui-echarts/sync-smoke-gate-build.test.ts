import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function createTempDir() {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-echarts-sync-gate-"));
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

afterEach(() => {
  while (tempDirs.length > 0) {
    const dirPath = tempDirs.pop();
    if (dirPath) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
});

describe("upstream sync smoke gate (build output)", () => {
  it("keeps bootstrap injection paths and fingerprinted runtime assets stable", () => {
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
    const run = spawnSync(
      process.execPath,
      [scriptPath, "--source", sourceDir, "--output", outputDir],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: "sync-gate-token" },
      },
    );
    expect(run.status, run.stderr || run.stdout).toBe(0);

    const indexHtml = fs.readFileSync(path.join(outputDir, "index.html"), "utf8");
    const expectedFingerprint = computeExpectedRuntimeFingerprint();
    const expectedRuntimeBasePath = `./assets/openclaw-echarts/${expectedFingerprint}/runtime`;

    expect(indexHtml).toContain("data-openclaw-echarts-view-bootstrap");
    expect(indexHtml).toContain("data-openclaw-tenant-boot-lock-style");
    expect(indexHtml).toContain("data-oc-tenant-boot-lock");
    expect(indexHtml).toContain('body[data-oc-tenant-auth-active="true"] > *');
    expect(indexHtml).toContain("data-openclaw-tenant-preboot");
    expect(indexHtml).toContain("data-openclaw-lufeng-bootstrap");
    expect(indexHtml).toContain("data-openclaw-auto-token-bootstrap");
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/echarts-view/preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/tenant/preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/lufeng/preboot.js`);
    expect(indexHtml).toContain(`${expectedRuntimeBasePath}/branding/auto-token-preboot.js`);

    const fingerprintRoot = path.join(outputDir, "assets", "openclaw-echarts", expectedFingerprint);
    expect(fs.existsSync(path.join(fingerprintRoot, "openclaw-echarts-renderer.js"))).toBe(true);
    expect(fs.existsSync(path.join(fingerprintRoot, "runtime", "echarts-view", "preboot.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(fingerprintRoot, "runtime", "tenant", "preboot.js"))).toBe(true);
    expect(fs.existsSync(path.join(fingerprintRoot, "runtime", "lufeng", "preboot.js"))).toBe(true);
    expect(
      fs.existsSync(path.join(fingerprintRoot, "runtime", "branding", "auto-token-preboot.js")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(fingerprintRoot, "runtime", "knowledge-graph", "page.css")),
    ).toBe(true);
    expect(fs.existsSync(path.join(fingerprintRoot, "runtime", "knowledge-graph", "page.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(fingerprintRoot, "vendor", "echarts.min.js"))).toBe(true);
    expect(fs.existsSync(path.join(fingerprintRoot, "vendor", "json5.min.js"))).toBe(true);

    const knowledgeGraphHtml = fs.readFileSync(
      path.join(outputDir, "knowledge-graph.html"),
      "utf8",
    );
    expect(knowledgeGraphHtml).toContain(`${expectedRuntimeBasePath}/knowledge-graph/page.css`);
    expect(knowledgeGraphHtml).toContain(`${expectedRuntimeBasePath}/knowledge-graph/page.js`);
  });
});

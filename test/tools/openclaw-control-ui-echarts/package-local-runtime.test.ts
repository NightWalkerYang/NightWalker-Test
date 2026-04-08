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

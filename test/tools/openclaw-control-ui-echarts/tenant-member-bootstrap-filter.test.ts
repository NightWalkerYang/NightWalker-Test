import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearInternalHooks, registerInternalHook } from "../../../src/hooks/internal-hooks.js";
import { resolveBootstrapFilesForRun } from "../../../src/agents/bootstrap-files.js";

const cleanupRoots = new Set();

function createTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tenant-bootstrap-hook-"));
  cleanupRoots.add(root);
  return root;
}

async function loadHookHandler() {
  const moduleUrl = pathToFileURL(
    path.resolve(
      "tools/openclaw-control-ui-echarts/workspace-overlays/kingdee-cloud/hooks/tenant-member-bootstrap-filter/handler.js",
    ),
  ).href;
  const mod = await import(`${moduleUrl}?t=${Date.now()}`);
  return mod.default;
}

describe("tenant member bootstrap filter hook", () => {
  beforeEach(() => clearInternalHooks());
  afterEach(() => {
    clearInternalHooks();
    for (const root of cleanupRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    cleanupRoots.clear();
  });

  it("filters BOOTSTRAP.md for tenant member chat sessions in derived workspaces", async () => {
    const workspaceDir = createTempWorkspace();
    fs.writeFileSync(path.join(workspaceDir, ".tenant-derived-agent.json"), "{}\n", "utf8");
    fs.writeFileSync(path.join(workspaceDir, "BOOTSTRAP.md"), "# bootstrap\n", "utf8");
    fs.writeFileSync(path.join(workspaceDir, "AGENTS.md"), "# agents\n", "utf8");

    registerInternalHook("agent:bootstrap", await loadHookHandler());

    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      sessionKey: "agent:finance:tenant:tenant_1:tenant-agent:agent_1:user:user_1:chat:abc",
      agentId: "finance",
    });

    expect(files.map((file) => file.name)).not.toContain("BOOTSTRAP.md");
    expect(files.map((file) => file.name)).toContain("AGENTS.md");
  });

  it("keeps BOOTSTRAP.md for non-member sessions", async () => {
    const workspaceDir = createTempWorkspace();
    fs.writeFileSync(path.join(workspaceDir, ".tenant-derived-agent.json"), "{}\n", "utf8");
    fs.writeFileSync(path.join(workspaceDir, "BOOTSTRAP.md"), "# bootstrap\n", "utf8");

    registerInternalHook("agent:bootstrap", await loadHookHandler());

    const files = await resolveBootstrapFilesForRun({
      workspaceDir,
      sessionKey: "agent:finance:main",
      agentId: "finance",
    });

    expect(files.map((file) => file.name)).toContain("BOOTSTRAP.md");
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootKnowledgeGraphEntry } from "../../../tools/openclaw-control-ui-echarts/runtime/knowledge-graph/entry.js";
import { writeTenantSession } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js";

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  delete window.__openclawKnowledgeGraphEntryBooted;
});

describe("zero-intrusive knowledge graph entry", () => {
  it("injects a single brand-settings link for platform admins", () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;

    bootKnowledgeGraphEntry();
    bootKnowledgeGraphEntry();

    const links = document.querySelectorAll(".oc-brand-settings-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain("更改品牌");
  });

  it("watches later sidebar mounts and injects the platform-admin entry there too", async () => {
    writeTenantSession({
      token: "platform-token",
      session: {
        role: "platform_admin",
        username: "platform-root",
      },
    });
    bootKnowledgeGraphEntry();

    const utility = document.createElement("div");
    utility.className = "sidebar-utility-group";
    document.body.append(utility);

    await Promise.resolve();
    await Promise.resolve();

    expect(utility.querySelector(".oc-brand-settings-link")?.textContent).toContain("更改品牌");
  });
});

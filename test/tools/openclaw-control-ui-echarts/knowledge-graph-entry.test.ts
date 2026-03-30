/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootKnowledgeGraphEntry } from "../../../tools/openclaw-control-ui-echarts/runtime/knowledge-graph/entry.js";

afterEach(() => {
  document.body.innerHTML = "";
  delete window.__openclawKnowledgeGraphEntryBooted;
});

describe("zero-intrusive knowledge graph entry", () => {
  it("injects a single knowledge graph link into the sidebar utility group", () => {
    document.body.innerHTML = `<div class="sidebar-utility-group"></div>`;

    bootKnowledgeGraphEntry();
    bootKnowledgeGraphEntry();

    const links = document.querySelectorAll(".oc-knowledge-graph-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain("知识图谱");
    expect(links[0]?.getAttribute("href")).toContain("knowledge-graph.html");
  });

  it("watches later sidebar mounts and injects the entry there too", async () => {
    bootKnowledgeGraphEntry();

    const utility = document.createElement("div");
    utility.className = "sidebar-utility-group";
    document.body.append(utility);

    await Promise.resolve();
    await Promise.resolve();

    expect(utility.querySelector(".oc-knowledge-graph-link")?.textContent).toContain("知识图谱");
  });
});

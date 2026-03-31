/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addKnowledgeEntity,
  addKnowledgeRelation,
  bootKnowledgeGraphPage,
  buildKnowledgeGraphOption,
  clearPersistedKnowledgeGraphState,
  createKnowledgeGraphState,
  readPersistedKnowledgeGraphState,
  serializeKnowledgeGraphState,
} from "../../../tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.js";

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

function renderPage() {
  document.body.innerHTML = `
    <main class="kg-page" data-oc-knowledge-graph-page>
      <button type="button" data-kg-export></button>
      <button type="button" data-kg-import-trigger></button>
      <button type="button" data-kg-restore-defaults></button>
      <button type="button" data-kg-clear-selection></button>
      <button type="button" data-kg-reset-graph></button>
      <input type="file" data-kg-import-file />
      <strong data-kg-stat-nodes></strong>
      <strong data-kg-stat-links></strong>
      <strong data-kg-stat-focus></strong>
      <div data-kg-selected-card></div>
      <div data-kg-canvas></div>
      <form data-kg-node-form>
        <input name="name" />
        <input name="type" />
        <textarea name="description"></textarea>
        <input name="color" value="#6ca8ff" />
        <select name="connectTo"></select>
        <input name="relationLabel" />
        <button type="submit">add</button>
      </form>
      <form data-kg-link-form>
        <select name="sourceId"></select>
        <select name="targetId"></select>
        <input name="label" />
        <button type="submit">link</button>
      </form>
      <p data-kg-feedback></p>
    </main>
  `;
}

beforeEach(() => {
  globalThis.ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  delete globalThis.ResizeObserver;
  delete window.echarts;
  vi.restoreAllMocks();
});

describe("knowledge graph page", () => {
  it("highlights only directly connected nodes for the current selection", () => {
    const state = createKnowledgeGraphState({ selectedId: "entity-a" });
    const option = buildKnowledgeGraphOption(state);
    const series = option.series[0];
    const dimmedNode = series.data.find((node) => node.id === "entity-tag");
    const activeNode = series.data.find((node) => node.id === "entity-b");
    const activeEdge = series.links.find((link) => link.source === "entity-a" && link.target === "entity-b");
    const dimmedEdge = series.links.find((link) => link.source === "entity-note" && link.target === "entity-tag");

    expect(activeNode?.itemStyle.opacity).toBe(1);
    expect(dimmedNode?.itemStyle.opacity).toBe(0.14);
    expect(activeEdge?.lineStyle.opacity).toBe(0.92);
    expect(dimmedEdge?.lineStyle.opacity).toBe(0.08);
  });

  it("adds entities and relations into the in-memory graph state", () => {
    const state = createKnowledgeGraphState();
    const node = addKnowledgeEntity(state, {
      name: "实体Z",
      type: "概念",
      connectToId: "entity-a",
      relationLabel: "补充",
    });
    const relation = addKnowledgeRelation(state, {
      sourceId: node.id,
      targetId: "entity-c",
      label: "延伸",
    });

    expect(state.nodes.some((item) => item.id === node.id)).toBe(true);
    expect(state.links.some((item) => item.source === "entity-a" && item.target === node.id)).toBe(true);
    expect(relation?.label).toBe("延伸");
  });

  it("boots the page and updates stats when a new entity is submitted", () => {
    renderPage();

    const fakeChart = {
      option: null,
      setOption(option) {
        this.option = option;
      },
      on: vi.fn(),
      getZr() {
        return { on: vi.fn() };
      },
      resize: vi.fn(),
      dispatchAction: vi.fn(),
    };

    window.echarts = {
      init: vi.fn(() => fakeChart),
    };

    const result = bootKnowledgeGraphPage();
    expect(result?.state.nodes).toHaveLength(6);
    expect(document.querySelector("[data-kg-stat-nodes]")?.textContent).toBe("6");
    expect(document.querySelector("[data-kg-stat-focus]")?.textContent).toBe("实体A");

    const form = document.querySelector("[data-kg-node-form]");
    const name = form?.querySelector('[name="name"]');
    const type = form?.querySelector('[name="type"]');
    const connectTo = form?.querySelector('[name="connectTo"]');
    const relationLabel = form?.querySelector('[name="relationLabel"]');

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("node form not found");
    }
    if (!(name instanceof HTMLInputElement)) {
      throw new Error("name input not found");
    }
    if (!(type instanceof HTMLInputElement)) {
      throw new Error("type input not found");
    }
    if (!(connectTo instanceof HTMLSelectElement)) {
      throw new Error("connect select not found");
    }
    if (!(relationLabel instanceof HTMLInputElement)) {
      throw new Error("relation input not found");
    }

    name.value = "实体Y";
    type.value = "文档";
    connectTo.value = "entity-a";
    relationLabel.value = "补位";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(result?.state.nodes).toHaveLength(7);
    expect(document.querySelector("[data-kg-stat-nodes]")?.textContent).toBe("7");
    expect(document.querySelector("[data-kg-feedback]")?.textContent).toContain("已添加实体");
    expect(fakeChart.option?.series?.[0]?.data?.some((item) => item.name === "实体Y")).toBe(true);
    expect(readPersistedKnowledgeGraphState()?.nodes.some((item) => item.name === "实体Y")).toBe(true);
  });

  it("restores a previously persisted graph snapshot on boot", () => {
    renderPage();

    window.localStorage.setItem(
      "openclaw:knowledge-graph:v1",
      serializeKnowledgeGraphState({
        nodes: [
          {
            id: "persisted-a",
            name: "持久节点A",
            type: "概念",
            description: "来自本地存储",
            color: "#6ca8ff",
          },
        ],
        links: [],
        selectedId: "persisted-a",
      }),
    );

    const fakeChart = {
      option: null,
      setOption(option) {
        this.option = option;
      },
      on: vi.fn(),
      getZr() {
        return { on: vi.fn() };
      },
      resize: vi.fn(),
      dispatchAction: vi.fn(),
    };

    window.echarts = {
      init: vi.fn(() => fakeChart),
    };

    const result = bootKnowledgeGraphPage();
    expect(result?.state.nodes).toHaveLength(1);
    expect(result?.state.nodes[0]?.name).toBe("持久节点A");
    expect(document.querySelector("[data-kg-stat-focus]")?.textContent).toBe("持久节点A");
    expect(document.querySelector("[data-kg-feedback]")?.textContent).toContain("已从当前浏览器恢复");
  });

  it("can clear persisted graph state back to defaults", () => {
    const state = createKnowledgeGraphState();
    addKnowledgeEntity(state, {
      name: "临时节点",
      type: "概念",
    });
    window.localStorage.setItem("openclaw:knowledge-graph:v1", serializeKnowledgeGraphState(state));

    expect(readPersistedKnowledgeGraphState()?.nodes.some((item) => item.name === "临时节点")).toBe(true);
    expect(clearPersistedKnowledgeGraphState()).toBe(true);
    expect(readPersistedKnowledgeGraphState()).toBeNull();
  });
});

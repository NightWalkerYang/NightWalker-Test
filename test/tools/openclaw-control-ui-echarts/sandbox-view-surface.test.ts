/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootSandboxViewSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js";

async function flushMicrotasks(count = 5) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

function openMaterialPicker() {
  document.querySelector("[data-sandbox-material-picker-open]")?.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
}

function closeMaterialPicker() {
  document.querySelector("[data-sandbox-material-picker-close]")?.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
}

function selectMaterialCandidate(materialId) {
  let input = document.querySelector(`[data-material-candidate-checkbox="${materialId}"]`);
  if (!(input instanceof HTMLInputElement)) {
    openMaterialPicker();
    input = document.querySelector(`[data-material-candidate-checkbox="${materialId}"]`);
  }
  if (input instanceof HTMLInputElement) {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function stubSandboxResolve(
  payload,
  catalog = null,
  runResultPayload = payload,
  materialCandidates = null,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = String(input || "");
      if (url.includes("/member/sandboxes/runs/run_stub_1/result")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: runResultPayload,
          }),
        };
      }
      if (url.includes("/member/sandboxes/runs/run_stub_1")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              runId: "run_stub_1",
              status: "succeeded",
              resultAvailable: true,
              errorMessage: null,
            },
          }),
        };
      }
      if (url.includes("/member/sandboxes/run")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              runId: "run_stub_1",
              status: "queued",
              resultAvailable: false,
              errorMessage: null,
            },
          }),
        };
      }
      if (url.includes("/member/sandboxes/data-catalog")) {
        return {
          ok: Boolean(catalog),
          json: async () =>
            catalog
              ? {
                  ok: true,
                  data: catalog,
                }
              : {
                  ok: false,
                  error: "tenant_data_source_unbound",
                },
        };
      }
      if (url.includes("/member/sandboxes/material-candidates")) {
        return {
          ok: Boolean(materialCandidates),
          json: async () =>
            materialCandidates
              ? {
                  ok: true,
                  data: materialCandidates,
                }
              : {
                  ok: false,
                  error: "sandbox_material_candidates_unavailable",
                },
        };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: payload,
        }),
      };
    }),
  );
}

function createLiveCatalog() {
  return {
    dataSourceName: "本地金蝶分析库",
    datasets: [
      {
        id: "sales_order",
        label: "销售订单",
        description: "订单需求",
        defaultSelected: true,
        rowCount: 22,
        status: "available",
        periodMode: "range",
        minDate: "2026-01-01",
        maxDate: "2026-04-30",
      },
      {
        id: "purchase_order",
        label: "采购订单",
        description: "采购节奏",
        defaultSelected: true,
        rowCount: 12,
        status: "available",
        periodMode: "snapshot",
      },
      {
        id: "material_master",
        label: "物料主数据",
        description: "物料编码和名称",
        defaultSelected: true,
        rowCount: 12,
        status: "available",
        periodMode: "snapshot",
      },
    ],
  };
}

function createMaterialCandidates() {
  return {
    dataSourceName: "本地金蝶分析库",
    items: [
      {
        materialId: "M009",
        materialName: "原料 Live",
        materialCode: "M009",
      },
      {
        materialId: "M010",
        materialName: "辅料 A",
        materialCode: "M010",
      },
    ],
  };
}

function createGroupedMaterialCandidates() {
  return {
    dataSourceName: "本地金蝶分析库",
    items: [
      {
        materialId: "T001",
        materialName: "铁观音",
        materialCode: "T001",
      },
      {
        materialId: "M001",
        materialName: "雀巢淡奶油",
        materialCode: "M001",
      },
      {
        materialId: "P001",
        materialName: "中号纸杯",
        materialCode: "P001",
      },
      {
        materialId: "A001",
        materialName: "寒天晶球",
        materialCode: "A001",
      },
      {
        materialId: "O001",
        materialName: "测试物料带批号",
        materialCode: "O001",
      },
    ],
  };
}

function createDuplicateMaterialCandidates() {
  return {
    dataSourceName: "本地金蝶分析库",
    items: [
      {
        materialId: "10020095",
        materialName: "桂花乌龙",
        materialCode: "10020095",
      },
      {
        materialId: "10020095",
        materialName: "桂花乌龙",
        materialCode: "10020095",
      },
      {
        materialId: "10020096",
        materialName: "碧根果细碎（门店装）",
        materialCode: "10020096",
      },
    ],
  };
}

function createNoisyLiveCatalog() {
  return {
    dataSourceName: "本地金蝶分析库",
    datasets: [
      ...createLiveCatalog().datasets,
      {
        id: "purchase_receipt",
        label: "采购收货",
        description: "到货兑现",
        defaultSelected: false,
        rowCount: 8,
        status: "available",
        periodMode: "snapshot",
      },
      {
        id: "supplier_price",
        label: "供应商价格",
        description: "价格参考",
        defaultSelected: true,
        rowCount: 6,
        status: "available",
        periodMode: "snapshot",
      },
      {
        id: "pur_req_order_current",
        label: "采购申请单当前表",
        description: "动态发现技术表",
        defaultSelected: false,
        rowCount: 88,
        status: "available",
        periodMode: "range",
        minDate: "2026-01-01",
        maxDate: "2026-04-30",
      },
      {
        id: "stk_inventory_current",
        label: "即时库存当前表",
        description: "动态发现技术表",
        defaultSelected: false,
        rowCount: 99,
        status: "available",
        periodMode: "snapshot",
      },
    ],
  };
}

function createDemandlessCatalog() {
  return {
    dataSourceName: "本地金蝶分析库",
    recommendedInputPeriod: {
      startDate: "2024-01-05",
      endDate: "2024-06-05",
      source: "sales_order",
    },
    datasets: [
      {
        id: "sales_order",
        label: "销售订单",
        description: "订单需求",
        defaultSelected: false,
        rowCount: 0,
        status: "empty",
        periodMode: "range",
        minDate: null,
        maxDate: null,
      },
      {
        id: "sales_outbound",
        label: "销售出库",
        description: "实际出库",
        defaultSelected: false,
        rowCount: 0,
        status: "empty",
        periodMode: "range",
        minDate: null,
        maxDate: null,
      },
      {
        id: "material_master",
        label: "物料主数据",
        description: "物料编码和名称",
        defaultSelected: true,
        rowCount: 12,
        status: "available",
        periodMode: "snapshot",
      },
      {
        id: "purchase_order",
        label: "采购订单",
        description: "采购节奏",
        defaultSelected: true,
        rowCount: 12,
        status: "available",
        periodMode: "snapshot",
      },
      {
        id: "supplier_price",
        label: "供应商价格",
        description: "价格参考",
        defaultSelected: true,
        rowCount: 6,
        status: "available",
        periodMode: "snapshot",
      },
    ],
  };
}

function createSparseMaterialCandidates() {
  return {
    dataSourceName: "本地金蝶分析库",
    items: [
      {
        materialId: "3024551",
        materialName: "碧根果细碎（门店装）",
        materialCode: "3024551",
      },
    ],
  };
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  delete window.__openclawSandboxViewSurfaceBooted;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public sandbox view surface", () => {
  it("shows a designed empty state when opened without a token", async () => {
    window.history.replaceState({}, "", "/sandbox-view/");

    await bootSandboxViewSurface();
    await Promise.resolve();

    expect(document.body.textContent).toContain("请选择一个沙盒模拟");
    expect(document.body.textContent).toContain("沙盒模拟");
    expect(document.querySelector("[data-openclaw-sandbox-view-surface-style]")).not.toBeNull();
  });

  it("keeps the plan in a loading state while the data catalog request is pending", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    let resolveCatalogResponse;
    const pendingCatalogResponse = new Promise((resolve) => {
      resolveCatalogResponse = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input || "");
        if (url.includes("/member/sandboxes/material-candidates")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createMaterialCandidates(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/data-catalog")) {
          return pendingCatalogResponse;
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    expect(document.body.textContent).toContain("正在刷新数据目录");
    expect(document.body.textContent).toContain("正在读取当前租户绑定数据源和成员组织范围的数据目录");
    expect(document.body.textContent).not.toContain(
      "数据目录未完全就绪，运行时会使用当前可见的沙盒数据兜底。",
    );

    resolveCatalogResponse?.({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          dataSourceName: "本地金蝶分析库",
          datasets: [],
        },
      }),
    });
  });

  it("loads sandbox payload and renders the workspace surface", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    let graphOptions = null;
    const graphDataUpdates = [];
    window.G6 = {
      Graph: class {
        constructor(options) {
          this.options = options;
          graphOptions = options;
        }
        setData(data) {
          graphDataUpdates.push(data);
        }
        render() {
          return undefined;
        }
        destroy() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        agentName: "苏博泰克财务分析助手",
        summary: {
          forecastDemandQty: 150,
          recommendedPurchaseQty: 130,
          estimatedPurchaseCost: 1105,
          shortageRiskLevel: "high",
        },
        graph: {
          nodes: [
            { id: "product", label: "成品 A", type: "product", riskLevel: "medium" },
            { id: "material", label: "原料 B", type: "material", riskLevel: "high" },
          ],
          edges: [{ source: "product", target: "material", label: "USES_COMPONENT" }],
        },
        recommendations: [
          { materialId: "M001", materialName: "原料 B", recommendedQty: 130, estimatedCost: 1105 },
        ],
        report: {
          headline: "下月需求上升，需要提前补货",
          bullets: ["原料 B 是主要瓶颈", "当前库存不足以覆盖预测需求"],
        },
      },
      {
        dataSourceName: "本地金蝶分析库",
        datasets: [
          {
            id: "sales_order",
            label: "销售订单",
            description: "订单需求",
            defaultSelected: true,
            rowCount: 22,
            status: "available",
            periodMode: "range",
            minDate: "2026-01-01",
            maxDate: "2026-04-30",
          },
          {
            id: "sales_outbound",
            label: "销售出库",
            description: "实际出库",
            defaultSelected: true,
            rowCount: 18,
            status: "available",
            periodMode: "range",
            minDate: "2026-01-02",
            maxDate: "2026-04-28",
          },
          {
            id: "material_master",
            label: "物料主数据",
            description: "物料编码和名称",
            defaultSelected: true,
            rowCount: 12,
            status: "available",
            periodMode: "snapshot",
          },
        ],
      },
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    expect(window.location.pathname).toBe("/sandbox-view/");
    expect(window.location.search).toContain("token=member-sandbox-token");
    expect(document.title).toContain("采购沙盒模拟");
    expect(document.body.textContent).toContain("采购沙盒模拟");
    expect(document.body.textContent).toContain("定义模拟问题");
    expect(document.body.textContent).toContain("未来一个月哪些物料需要提前采购");
    expect(document.body.textContent).toContain("本地金蝶分析库");
    expect(document.body.textContent).toContain("选择原料范围");
    expect(document.querySelector("[data-sandbox-material-picker-summary]")).not.toBeNull();
    openMaterialPicker();
    expect(document.body.textContent).toContain("原料 Live");
    expect(document.body.textContent).not.toContain("1,105");
    selectMaterialCandidate("M009");
    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(document.body.textContent).toContain("1,105");
    expect(document.body.textContent).toContain("模拟问题");
    expect(document.body.textContent).toContain("预测期间");
    expect(document.querySelector("#oc-sandbox-view-graph")).not.toBeNull();
    expect(document.querySelector("[data-sandbox-graph-play]")?.textContent).toContain(
      "重播",
    );
    expect(document.querySelector(".oc-sandbox-view-metric-chart-panel")).toBeNull();
    expect(document.querySelector("[data-sandbox-metric-chart]")).toBeNull();
    document.querySelectorAll(".oc-sandbox-view-metric")[2]?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(document.querySelector(".oc-sandbox-view-metric.is-charting")).toBeNull();
    expect(document.querySelector("[data-sandbox-metric-modal]")).not.toBeNull();
    expect(document.querySelector("[data-sandbox-metric-chart]")).not.toBeNull();
    expect(graphOptions?.data.nodes[0]).toMatchObject({
      nodeType: "scenario",
      type: "circle",
      style: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
    });
    expect(graphOptions?.data.nodes.some((node) => node.nodeType === "sales")).toBe(true);
    expect(
      graphOptions?.data.nodes.every(
        (node) => typeof node.style?.x === "number" && typeof node.style?.y === "number",
      ),
    ).toBe(true);
    expect(graphOptions?.layout).toBeUndefined();
    expect(graphDataUpdates.length).toBeGreaterThan(0);
  });

  it("only renders prediction-relevant datasets in the metadata area", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createNoisyLiveCatalog(),
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    const datasetLabels = Array.from(
      document.querySelectorAll("[data-dataset-card] strong"),
      (element) => element.textContent,
    );

    expect(datasetLabels).toEqual([
      "销售订单",
      "采购订单",
      "物料主数据",
      "供应商价格",
      "组织范围",
    ]);
    expect(document.body.textContent).not.toContain("采购收货");
    expect(document.body.textContent).not.toContain("采购申请单当前表");
    expect(document.body.textContent).not.toContain("即时库存当前表");
  });

  it("deduplicates duplicate material candidates by materialId in the surface", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createDuplicateMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    openMaterialPicker();

    const materialLabels = Array.from(
      document.querySelectorAll("[data-material-candidate-card] strong"),
      (element) => element.textContent,
    );
    const materialIds = Array.from(
      document.querySelectorAll("[data-material-candidate-card] input"),
      (element) => element.getAttribute("value"),
    );

    expect(materialLabels).toEqual(["桂花乌龙", "碧根果细碎（门店装）"]);
    expect(materialIds).toEqual(["10020095", "10020096"]);
  });

  it("opens a material picker modal and syncs the selected summary back to the page", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    expect(document.querySelector("[data-sandbox-material-picker-summary]")).not.toBeNull();
    expect(document.querySelector("[data-sandbox-material-picker-modal]")).toBeNull();

    openMaterialPicker();

    expect(document.querySelector("[data-sandbox-material-picker-modal]")).not.toBeNull();
    expect(document.querySelector("[data-sandbox-material-search]")).not.toBeNull();

    selectMaterialCandidate("M009");
    closeMaterialPicker();
    await flushMicrotasks();

    expect(document.querySelector("[data-sandbox-material-picker-modal]")).toBeNull();
    expect(document.body.textContent).toContain("已选 1 个原料");
    expect(document.body.textContent).toContain("原料 Live");
  });

  it("shows selected materials in a pinned summary area inside the picker", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    openMaterialPicker();
    await flushMicrotasks();

    expect(document.body.textContent).toContain("已选原料");
    expect(document.querySelectorAll("[data-sandbox-selected-material-chip]")).toHaveLength(0);

    selectMaterialCandidate("M009");
    await flushMicrotasks();
    selectMaterialCandidate("M010");
    await flushMicrotasks();

    const selectedNames = Array.from(
      document.querySelectorAll("[data-sandbox-selected-material-chip]"),
      (element) => element.textContent,
    );
    expect(selectedNames).toEqual(["原料 Live", "辅料 A"]);
    expect(document.body.textContent).toContain("已选 2 个");
  });

  it("groups material candidates by business meaning inside the picker", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createGroupedMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    openMaterialPicker();
    await flushMicrotasks();

    const groupTitles = Array.from(
      document.querySelectorAll("[data-sandbox-material-group-title]"),
      (element) => element.textContent,
    );
    expect(groupTitles).toEqual(["茶基底", "奶原料", "包材", "辅料", "其他原料"]);
    expect(document.body.textContent).toContain("铁观音");
    expect(document.body.textContent).toContain("雀巢淡奶油");
    expect(document.body.textContent).toContain("中号纸杯");
    expect(document.body.textContent).toContain("寒天晶球");
    expect(document.body.textContent).toContain("测试物料带批号");
  });

  it("stacks material groups vertically so the picker columns stay balanced", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createGroupedMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    openMaterialPicker();
    await flushMicrotasks();

    const groupContainer = document.querySelector("[data-sandbox-material-candidates]");
    const groups = Array.from(document.querySelectorAll("[data-sandbox-material-group]"));
    expect(groupContainer instanceof HTMLElement ? groupContainer.className : "").toContain(
      "oc-sandbox-view-metadata-grid--material-picker",
    );
    expect(groups).toHaveLength(5);
  });

  it("blocks a sandbox run when the selected historical period has no demand evidence", async () => {
    const calls = [];
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init = {}) => {
        const url = String(input || "");
        const method = init?.method || "GET";
        calls.push({ url, method });
        if (url.includes("/member/sandboxes/data-catalog")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createDemandlessCatalog(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/material-candidates")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createMaterialCandidates(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/run")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                runId: "run_should_not_happen",
                status: "queued",
                resultAvailable: false,
                errorMessage: null,
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    const inputStart = document.querySelector('[data-sandbox-period="inputStartDate"]');
    const inputEnd = document.querySelector('[data-sandbox-period="inputEndDate"]');
    if (inputStart instanceof HTMLInputElement) {
      inputStart.value = "2025-05-07";
      inputStart.dispatchEvent(new Event("input", { bubbles: true }));
      inputStart.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (inputEnd instanceof HTMLInputElement) {
      inputEnd.value = "2026-05-07";
      inputEnd.dispatchEvent(new Event("input", { bubbles: true }));
      inputEnd.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await flushMicrotasks(8);

    selectMaterialCandidate("M009");
    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks();

    expect(calls.some((call) => call.url.includes("/member/sandboxes/run"))).toBe(false);
    expect(document.body.textContent).toContain(
      "当前历史依据期间没有命中销售订单或销售出库数据，请调整历史依据期间后再运行模拟",
    );
  });

  it("shows and applies a recommended runnable input period", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [],
        report: {},
      },
      createDemandlessCatalog(),
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks(8);

    const inputStart = document.querySelector('[data-sandbox-period="inputStartDate"]');
    const inputEnd = document.querySelector('[data-sandbox-period="inputEndDate"]');
    expect(inputStart instanceof HTMLInputElement ? inputStart.value : "").toBe("2024-01-05");
    expect(inputEnd instanceof HTMLInputElement ? inputEnd.value : "").toBe("2024-06-05");

    document.querySelector("[data-apply-recommended-period]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks(4);

    expect(inputStart instanceof HTMLInputElement ? inputStart.value : "").toBe("2024-01-05");
    expect(inputEnd instanceof HTMLInputElement ? inputEnd.value : "").toBe("2024-06-05");
  });

  it("explains sparse material candidates and lets the user switch to the recommended period from the picker", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const rawUrl = String(input || "");
        const url = new URL(rawUrl, "http://localhost");
        if (rawUrl.includes("/member/sandboxes/resolve")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                sandboxName: "采购沙盒模拟",
                summary: {},
                recommendations: [],
                report: {},
              },
            }),
          };
        }
        if (rawUrl.includes("/member/sandboxes/material-candidates")) {
          const start = url.searchParams.get("inputStartDate");
          const end = url.searchParams.get("inputEndDate");
          const data =
            start === "2024-01-17" && end === "2024-03-16"
              ? createMaterialCandidates()
              : createSparseMaterialCandidates();
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data,
            }),
          };
        }
        if (rawUrl.includes("/member/sandboxes/data-catalog")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                ...createDemandlessCatalog(),
                recommendedInputPeriod: {
                  startDate: "2024-01-17",
                  endDate: "2024-03-16",
                  source: "sales_order",
                },
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    const inputStart = document.querySelector('[data-sandbox-period="inputStartDate"]');
    const inputEnd = document.querySelector('[data-sandbox-period="inputEndDate"]');
    if (inputStart instanceof HTMLInputElement) {
      inputStart.value = "2025-05-07";
      inputStart.dispatchEvent(new Event("input", { bubbles: true }));
      inputStart.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (inputEnd instanceof HTMLInputElement) {
      inputEnd.value = "2026-05-07";
      inputEnd.dispatchEvent(new Event("input", { bubbles: true }));
      inputEnd.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await flushMicrotasks(8);

    openMaterialPicker();
    await flushMicrotasks();

    expect(document.body.textContent).toContain("当前历史依据期间仅匹配 1 个原料");
    document.querySelector("[data-sandbox-material-apply-recommended-period]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks(8);

    expect(inputStart instanceof HTMLInputElement ? inputStart.value : "").toBe("2024-01-17");
    expect(inputEnd instanceof HTMLInputElement ? inputEnd.value : "").toBe("2024-03-16");
    expect(document.body.textContent).toContain("已选 0 个，当前显示 2 个");
    expect(document.body.textContent).toContain("原料 Live");
    expect(document.body.textContent).toContain("辅料 A");
  });

  it("auto-applies the recommended period on first load when the default period only matches sparse materials", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const rawUrl = String(input || "");
        const url = new URL(rawUrl, "http://localhost");
        if (rawUrl.includes("/member/sandboxes/resolve")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                sandboxName: "采购沙盒模拟",
                summary: {},
                recommendations: [],
                report: {},
              },
            }),
          };
        }
        if (rawUrl.includes("/member/sandboxes/material-candidates")) {
          const start = url.searchParams.get("inputStartDate");
          const end = url.searchParams.get("inputEndDate");
          const data =
            start === "2024-01-17" && end === "2024-03-16"
              ? createMaterialCandidates()
              : createSparseMaterialCandidates();
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data,
            }),
          };
        }
        if (rawUrl.includes("/member/sandboxes/data-catalog")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                ...createDemandlessCatalog(),
                recommendedInputPeriod: {
                  startDate: "2024-01-17",
                  endDate: "2024-03-16",
                  source: "sales_order",
                },
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks(12);

    const inputStart = document.querySelector('[data-sandbox-period="inputStartDate"]');
    const inputEnd = document.querySelector('[data-sandbox-period="inputEndDate"]');
    expect(inputStart instanceof HTMLInputElement ? inputStart.value : "").toBe("2024-01-17");
    expect(inputEnd instanceof HTMLInputElement ? inputEnd.value : "").toBe("2024-03-16");
    expect(document.body.textContent).toContain("历史依据 2024-01-17 至 2024-03-16");

    openMaterialPicker();
    await flushMicrotasks();
    expect(document.body.textContent).toContain("原料 Live");
    expect(document.body.textContent).toContain("辅料 A");
  });

  it("auto-applies the recommended period even when material candidates resolve before the catalog", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    let resolveCatalog;
    const catalogPromise = new Promise((resolve) => {
      resolveCatalog = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const rawUrl = String(input || "");
        const url = new URL(rawUrl, "http://localhost");
        if (rawUrl.includes("/member/sandboxes/resolve")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                sandboxName: "采购沙盒模拟",
                summary: {},
                recommendations: [],
                report: {},
              },
            }),
          };
        }
        if (rawUrl.includes("/member/sandboxes/material-candidates")) {
          const start = url.searchParams.get("inputStartDate");
          const end = url.searchParams.get("inputEndDate");
          const data =
            start === "2024-01-17" && end === "2024-03-16"
              ? createMaterialCandidates()
              : createSparseMaterialCandidates();
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data,
            }),
          };
        }
        if (rawUrl.includes("/member/sandboxes/data-catalog")) {
          return catalogPromise;
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks(6);

    resolveCatalog?.({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          ...createDemandlessCatalog(),
          recommendedInputPeriod: {
            startDate: "2024-01-17",
            endDate: "2024-03-16",
            source: "sales_order",
          },
        },
      }),
    });
    await flushMicrotasks(12);

    const inputStart = document.querySelector('[data-sandbox-period="inputStartDate"]');
    const inputEnd = document.querySelector('[data-sandbox-period="inputEndDate"]');
    expect(inputStart instanceof HTMLInputElement ? inputStart.value : "").toBe("2024-01-17");
    expect(inputEnd instanceof HTMLInputElement ? inputEnd.value : "").toBe("2024-03-16");

    openMaterialPicker();
    await flushMicrotasks();
    expect(document.body.textContent).toContain("原料 Live");
    expect(document.body.textContent).toContain("辅料 A");
  });

  it("highlights the selected recommendation row and syncs the graph focus", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    let graphOptions = null;
    const graphDataUpdates = [];
    window.G6 = {
      Graph: class {
        constructor(options) {
          graphOptions = options;
        }
        setData(data) {
          graphDataUpdates.push(data);
        }
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {
          forecastDemandQty: 288,
          recommendedPurchaseQty: 244,
          estimatedPurchaseCost: 2205,
          shortageRiskLevel: "medium",
        },
        recommendations: [
          { materialId: "M009", materialName: "原料 Live", recommendedQty: 244, estimatedCost: 2205 },
          { materialId: "M010", materialName: "辅料 A", recommendedQty: 18, estimatedCost: 105 },
        ],
        report: {
          headline: "live result headline",
          bullets: ["结果来自 live run"],
        },
      },
      createLiveCatalog(),
      {
        sandboxName: "采购沙盒模拟",
        summary: {
          forecastDemandQty: 288,
          recommendedPurchaseQty: 244,
          estimatedPurchaseCost: 2205,
          shortageRiskLevel: "medium",
        },
        recommendations: [
          { materialId: "M009", materialName: "原料 Live", recommendedQty: 244, estimatedCost: 2205 },
          { materialId: "M010", materialName: "辅料 A", recommendedQty: 18, estimatedCost: 105 },
        ],
        report: {
          headline: "live result headline",
          bullets: ["结果来自 live run"],
        },
      },
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    selectMaterialCandidate("M009");
    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.runAllTimersAsync();
    await flushMicrotasks();

    const rows = Array.from(document.querySelectorAll(".oc-sandbox-view-table tbody tr"));
    expect(rows).toHaveLength(2);
    rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushMicrotasks();

    expect(rows[1]?.classList.contains("is-active")).toBe(true);
    expect(rows[0]?.classList.contains("is-active")).toBe(false);
    expect(document.body.textContent).toContain("当前聚焦 辅料 A");
    expect(graphDataUpdates.length).toBeGreaterThan(0);
    expect(graphOptions).not.toBeNull();
  });

  it("submits a live sandbox run and renders the returned result payload", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    const staticPayload = {
      sandboxName: "采购沙盒模拟",
      agentName: "苏博泰克财务分析助手",
      summary: {
        forecastDemandQty: 150,
        recommendedPurchaseQty: 130,
        estimatedPurchaseCost: 1105,
        shortageRiskLevel: "high",
      },
      recommendations: [
        { materialId: "M001", materialName: "原料 B", recommendedQty: 130, estimatedCost: 1105 },
      ],
      report: {
        headline: "static only headline",
        bullets: ["静态沙盒结果"],
      },
    };
    const liveResultPayload = {
      sandboxName: "采购沙盒模拟",
      agentName: "苏博泰克财务分析助手",
      summary: {
        forecastDemandQty: 288,
        recommendedPurchaseQty: 244,
        estimatedPurchaseCost: 2205,
        shortageRiskLevel: "medium",
      },
      recommendations: [
        { materialId: "M009", materialName: "原料 Live", recommendedQty: 244, estimatedCost: 2205 },
      ],
      report: {
        headline: "live result headline",
        bullets: ["结果来自 live run"],
      },
    };
    const calls = [];
    let runStatusCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init = {}) => {
        const url = String(input || "");
        const method = init?.method || "GET";
        const body =
          typeof init?.body === "string" && init.body.trim()
            ? JSON.parse(init.body)
            : null;
        calls.push({ url, method, body });
        if (url.includes("/member/sandboxes/runs/run_live_1/result")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: liveResultPayload,
            }),
          };
        }
        if (url.includes("/member/sandboxes/runs/run_live_1")) {
          runStatusCalls += 1;
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                runId: "run_live_1",
                status: runStatusCalls >= 2 ? "succeeded" : "queued",
                resultAvailable: runStatusCalls >= 2,
                errorMessage: null,
              },
            }),
          };
        }
        if (url.includes("/member/sandboxes/run")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                runId: "run_live_1",
                status: "queued",
                resultAvailable: false,
                errorMessage: null,
              },
            }),
          };
        }
        if (url.includes("/member/sandboxes/material-candidates")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createMaterialCandidates(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/data-catalog")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createLiveCatalog(),
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: staticPayload,
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    selectMaterialCandidate("M009");
    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks();
    expect(document.body.textContent).toContain("沙盒任务已提交：run_live_1");
    expect(document.querySelector("[data-sandbox-run]")?.textContent).toContain("正在运行");
    await vi.runAllTimersAsync();
    await flushMicrotasks();

    expect(calls.some((call) => call.url.includes("/member/sandboxes/run"))).toBe(true);
    const submitCall = calls.find((call) => call.url.includes("/member/sandboxes/run"));
    expect(submitCall?.body).toMatchObject({
      token: "member-sandbox-token",
      selectedDatasetIds: expect.arrayContaining(["sales_order", "purchase_order"]),
      selectedMaterialIds: ["M009"],
    });
    expect(document.body.textContent).toContain("live result headline");
    expect(document.body.textContent).toContain("2,205");
    expect(document.body.textContent).not.toContain("static only headline");
    expect(document.body.textContent).not.toContain("1,105");
  });

  it("uses selected metadata to scope the source relationship graph", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    let graphOptions = null;
    window.G6 = {
      Graph: class {
        constructor(options) {
          graphOptions = options;
        }
        setData() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        recommendations: [
          { materialId: "M001", materialName: "原料 B", recommendedQty: 10, estimatedCost: 20 },
        ],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    document.querySelectorAll(".oc-sandbox-view-metadata input").forEach((input) => {
      if (input instanceof HTMLInputElement && input.value === "supplier_price") {
        input.checked = false;
      }
    });
    selectMaterialCandidate("M009");
    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(graphOptions?.data.nodes.some((node) => node.id === "supplier-price")).toBe(false);
    expect(graphOptions?.data.edges.some((edge) => edge.source === "supplier-price")).toBe(false);
  });

  it("renders material names without repeating the material code", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor() {}
        render() {
          return undefined;
        }
      },
    };
    stubSandboxResolve(
      {
        sandboxName: "采购沙盒模拟",
        summary: {},
        graph: {
          nodes: [{ id: "material:M001", label: "原料 B", type: "material" }],
          edges: [],
        },
        recommendations: [
          { materialId: "M001", materialName: "M001", recommendedQty: 10, estimatedCost: 20 },
          { materialId: "M002", materialName: "原料 C", recommendedQty: 8, estimatedCost: 16 },
        ],
        report: {},
      },
      createLiveCatalog(),
      undefined,
      createMaterialCandidates(),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();
    selectMaterialCandidate("M009");
    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(document.body.textContent).toContain("未命名物料");
    expect(document.body.textContent).toContain("原料 C");
  });

  it("blocks a sandbox run when no material candidate is selected", async () => {
    const calls = [];
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init = {}) => {
        const url = String(input || "");
        calls.push({ url, method: init?.method || "GET" });
        if (url.includes("/member/sandboxes/material-candidates")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createMaterialCandidates(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/data-catalog")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createLiveCatalog(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/run")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: {
                runId: "run_should_not_happen",
                status: "queued",
                resultAvailable: false,
                errorMessage: null,
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    document.querySelector("[data-sandbox-run]")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks();

    expect(calls.some((call) => call.url.includes("/member/sandboxes/run"))).toBe(false);
    expect(document.body.textContent).toContain("请至少选择一个原料后再运行沙盒模拟");
  });

  it("passes the material search keyword to the candidate endpoint", async () => {
    const calls = [];
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input || "");
        calls.push(url);
        if (url.includes("/member/sandboxes/material-candidates")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createMaterialCandidates(),
            }),
          };
        }
        if (url.includes("/member/sandboxes/data-catalog")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              data: createLiveCatalog(),
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              sandboxName: "采购沙盒模拟",
              summary: {},
              recommendations: [],
              report: {},
            },
          }),
        };
      }),
    );

    await bootSandboxViewSurface();
    await flushMicrotasks();

    openMaterialPicker();
    const search = document.querySelector("[data-sandbox-material-search]");
    if (!(search instanceof HTMLInputElement)) {
      throw new Error("material search input not found");
    }
    search.value = "原料";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flushMicrotasks();

    expect(
      calls.some(
        (url) =>
          url.includes("/member/sandboxes/material-candidates") &&
          url.includes(`keyword=${encodeURIComponent("原料")}`),
      ),
    ).toBe(true);
  });
});

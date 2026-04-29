/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootSandboxViewSurface } from "../../../tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js";

function stubSandboxResolve(payload) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        data: payload,
      }),
    })),
  );
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  delete window.__openclawSandboxViewSurfaceBooted;
  vi.unstubAllGlobals();
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

  it("loads sandbox payload and renders the workspace surface", async () => {
    window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
    window.G6 = {
      Graph: class {
        constructor(options) {
          this.options = options;
        }
        render() {
          return undefined;
        }
        destroy() {
          return undefined;
        }
      },
    };
    stubSandboxResolve({
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
    });

    await bootSandboxViewSurface();
    await Promise.resolve();

    expect(window.location.pathname).toBe("/sandbox-view/");
    expect(window.location.search).toContain("token=member-sandbox-token");
    expect(document.title).toContain("采购沙盒模拟");
    expect(document.body.textContent).toContain("采购沙盒模拟");
    expect(document.body.textContent).toContain("1,105");
    expect(document.querySelector("#oc-sandbox-view-graph")).not.toBeNull();
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const overviewMocks = vi.hoisted(() => {
  class FakeLinearGradient {
    args: unknown[];

    constructor(...args: unknown[]) {
      this.args = args;
    }
  }

  type FakeChart = {
    option: unknown;
    setOption: (option: unknown) => void;
    resize: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };

  const charts = new Map<string, FakeChart>();

  const echarts = {
    graphic: {
      LinearGradient: FakeLinearGradient,
    },
    init: vi.fn((el: HTMLElement) => {
      const chart: FakeChart = {
        option: null,
        setOption(option: unknown) {
          this.option = option;
        },
        resize: vi.fn(),
        on: vi.fn(),
      };
      charts.set(el.getAttribute("data-oc-overview-chart") || "", chart);
      return chart;
    }),
  };

  return { charts, echarts };
});

vi.mock("../../../tools/openclaw-control-ui-echarts/runtime/echarts/libraries.js", () => ({
  createLibraryLoader: vi.fn(() => async () => ({
    echarts: overviewMocks.echarts,
    json5: {},
  })),
}));

import {
  initTenantOverviewCharts,
  renderTenantOverview,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-overview-page.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  overviewMocks.charts.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("tenant overview page", () => {
  it("renders Agent display names in the consumption distribution chart", async () => {
    const controller = {
      overviewData: {
        summary: {
          totalTokens: 1000,
          inputTokens: 400,
          outputTokens: 600,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          activeUsers: 2,
          activeAgents: 2,
          memberCount: 3,
          walletBalance: 8,
        },
        trend: [],
        topMembers: [],
        topAgents: [
          { tokens: 80, name: "财务分析助手" },
          { tokens: 20, agentName: "客服助手" },
          { tokens: 10, agent_name: "销售助手" },
          { tokens: 5, description: "研发助手" },
          { tokens: 1, agentId: "ops" },
        ],
      },
      overviewStatus: { libs: "pending", charts: "pending" },
    };

    const root = document.createElement("main");
    root.innerHTML = renderTenantOverview(controller);
    document.body.append(root);

    await initTenantOverviewCharts(root, controller);
    await flush();

    const agentsChart = overviewMocks.charts.get("agents");
    if (!agentsChart) {
      throw new Error("Expected the agent distribution chart to initialize");
    }

    const option = agentsChart.option as {
      legend?: { orient?: string; left?: string; top?: string };
      series?: Array<{
        label?: { show?: boolean; position?: string; formatter?: string };
        data?: Array<{ name?: string; value?: number }>;
      }>;
    };

    expect(option.legend).toMatchObject({
      orient: "vertical",
      left: "left",
    });
    expect(option.series?.[0]?.label).toMatchObject({
      show: true,
      position: "outside",
      formatter: "{b}",
    });
    expect(option.series?.[0]?.data?.map((item) => item.name)).toEqual([
      "财务分析助手",
      "客服助手",
      "销售助手",
      "研发助手",
      "ops",
    ]);
  });
});

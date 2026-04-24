import { describe, expect, it } from "vitest";
import { renderDashboardManifest } from "../../../tools/openclaw-control-ui-echarts/runtime/dashboard-manifest/renderer.js";
import {
  buildDashboardMarkup,
  buildPanelOption,
  buildSceneOption,
  normalizeDashboardManifest,
  resolveDashboardAssetHref,
} from "../../../tools/openclaw-control-ui-echarts/runtime/dashboard-manifest/templates.js";

describe("dashboard manifest runtime templates", () => {
  it("normalizes manifest payloads and resolves workspace-relative assets", () => {
    const manifest = normalizeDashboardManifest(
      {
        version: 1,
        title: "财务总览驾驶舱",
        backgroundImage: "images/背景 星空.png",
        metrics: [{ label: "总资产", value: "128.6", unit: "亿元" }],
        charts: {
          leftTop: {
            type: "line",
            categories: ["1月", "2月"],
            series: [{ name: "营收", data: [18, 22] }],
          },
        },
      },
      {
        workspaceBaseHref: "/workspace-agent-downloads/tenant-agent-1/Echarts/",
      },
    );

    expect(manifest.title).toBe("财务总览驾驶舱");
    expect(manifest.metrics[0]?.label).toBe("总资产");
    expect(manifest.backgroundImage).toBe(
      "/workspace-agent-downloads/tenant-agent-1/Echarts/images/%E8%83%8C%E6%99%AF%20%E6%98%9F%E7%A9%BA.png",
    );
    expect(
      resolveDashboardAssetHref(
        "/workspace-agent-downloads/tenant-agent-1/Echarts/",
        "datasets/财务数据.json",
      ),
    ).toBe(
      "/workspace-agent-downloads/tenant-agent-1/Echarts/datasets/%E8%B4%A2%E5%8A%A1%E6%95%B0%E6%8D%AE.json",
    );
  });

  it("builds stable scene and chart options from normalized manifests", () => {
    const manifest = normalizeDashboardManifest({
      version: 1,
      template: "financial-command-center-v1",
      title: "资金总览驾驶舱",
      scene: { type: "asset-ring" },
      charts: {
        rightTop: {
          type: "pie",
          items: [
            { name: "货币资金", value: 32 },
            { name: "长期股权投资", value: 18 },
          ],
        },
      },
    });

    const sceneOption = buildSceneOption(manifest);
    const panelOption = buildPanelOption(manifest.charts.rightTop, manifest);
    const markup = buildDashboardMarkup(manifest, {
      agentName: "财务分析助手",
    });

    expect(sceneOption.series?.length).toBeGreaterThan(0);
    expect(panelOption.series?.[0]?.type).toBe("pie");
    expect(markup).toContain('data-chart-slot="rightTop"');
    expect(markup).toContain("财务分析助手");
  });

  it("exports the renderer entry for runtime bootstrapping", () => {
    expect(typeof renderDashboardManifest).toBe("function");
  });
});

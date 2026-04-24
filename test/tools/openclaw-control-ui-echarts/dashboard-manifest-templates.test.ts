import { describe, expect, it } from "vitest";
import { renderDashboardManifest } from "../../../tools/openclaw-control-ui-echarts/runtime/dashboard-manifest/renderer.js";
import {
  buildDashboardMarkup,
  buildPanelOption,
  buildSceneFallbackOption,
  buildSceneOption,
  normalizeDashboardManifest,
  resolveDashboardAssetHref,
} from "../../../tools/openclaw-control-ui-echarts/runtime/dashboard-manifest/templates.js";

function collectFunctionPaths(value, currentPath = "root", output = []) {
  if (typeof value === "function") {
    output.push(currentPath);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFunctionPaths(item, `${currentPath}[${index}]`, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      collectFunctionPaths(item, `${currentPath}.${key}`, output);
    });
  }
  return output;
}

describe("dashboard manifest runtime templates", () => {
  it("normalizes manifest payloads, preserves embedded data sources, and resolves workspace-relative assets", () => {
    const manifest = normalizeDashboardManifest(
      {
        version: 1,
        title: "财务总览驾驶舱",
        backgroundImage: "images/背景 星空.png",
        styleProfile: "gold-command",
        density: "compact",
        motion: "low",
        layout: {
          metricsColumns: 3,
          sceneMinHeight: 360,
          cardMode: "solid",
        },
        blocks: {
          timeline: {
            title: "关键动态",
            weight: 1.6,
          },
        },
        dataSource: {
          type: "embedded",
          company: "禄丰国控",
          period: "202603",
        },
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
    expect(manifest.styleProfile).toBe("gold-command");
    expect(manifest.density).toBe("compact");
    expect(manifest.motion.level).toBe("low");
    expect(manifest.layout.metricsColumns).toBe(3);
    expect(manifest.layout.cardMode).toBe("solid");
    expect(manifest.blocks.timeline.title).toBe("关键动态");
    expect(manifest.blocks.timeline.weight).toBe(1.6);
    expect(manifest.metrics[0]?.label).toBe("总资产");
    expect(manifest.dataSource).toEqual({
      type: "embedded",
      company: "禄丰国控",
      period: "202603",
    });
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

  it("builds stable scene options without runtime callback fields", () => {
    const manifest = normalizeDashboardManifest({
      version: 1,
      template: "financial-command-center-v1",
      title: "资金总览驾驶舱",
      scene: { type: "asset-ring" },
      charts: {
        leftTop: {
          type: "line",
          categories: ["一季度经营现金流", "二季度经营现金流"],
          series: [{ name: "经营现金流", data: [18, 22] }],
        },
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
    const fallbackSceneOption = buildSceneFallbackOption(manifest);
    const lineOption = buildPanelOption(manifest.charts.leftTop, manifest);
    const panelOption = buildPanelOption(manifest.charts.rightTop, manifest);
    const markup = buildDashboardMarkup(manifest, {
      agentName: "财务分析助手",
    });

    expect(sceneOption.series?.length).toBeGreaterThan(0);
    expect(sceneOption.series?.some((series) => series.type === "lines3D")).toBe(true);
    expect(sceneOption.series?.some((series) => series.type === "scatter3D")).toBe(true);
    expect(fallbackSceneOption.series?.some((series) => series.type === "lines3D")).toBe(true);
    expect(fallbackSceneOption.series?.some((series) => series.type === "scatter3D")).toBe(true);
    expect(collectFunctionPaths(sceneOption)).toEqual([]);
    expect(collectFunctionPaths(fallbackSceneOption)).toEqual([]);
    expect(lineOption.xAxis?.axisLabel?.fontSize).toBe(10);
    expect(lineOption.xAxis?.axisLabel?.overflow).toBe("truncate");
    expect(lineOption.grid?.containLabel).toBe(true);
    expect(panelOption.series?.[0]?.type).toBe("pie");
    expect(panelOption.series?.[0]?.label?.fontSize).toBe(10);
    expect(typeof panelOption.series?.[0]?.label?.formatter).toBe("function");
    expect(markup).toContain('data-layout-mode="cockpit-stage"');
    expect(markup).toContain("LEFT BAY");
    expect(markup).toContain('data-chart-slot="rightTop"');
    expect(markup).toContain("财务分析助手");
  });

  it("renders block visibility and style profile metadata into the fixed runtime shell", () => {
    const manifest = normalizeDashboardManifest({
      version: 1,
      title: "样式编辑大屏",
      styleProfile: "minimal-premium",
      density: "immersive",
      layout: {
        cardMode: "bleed",
      },
      blocks: {
        metrics: { visible: false },
        leftBottom: { visible: false },
        alerts: { visible: false },
        scene: { kicker: "DATA CORE" },
      },
    });

    const markup = buildDashboardMarkup(manifest, {
      agentName: "风格编辑助手",
    });

    expect(markup).toContain('data-style-profile="minimal-premium"');
    expect(markup).toContain('data-density="immersive"');
    expect(markup).toContain('data-card-mode="bleed"');
    expect(markup).toContain("DATA CORE");
    expect(markup).not.toContain('data-block-id="kpi-strip"');
    expect(markup).not.toContain('data-block-id="left-bottom"');
    expect(markup).not.toContain('data-block-id="alerts"');
    expect(markup).toContain('data-footer-count="1"');
  });

  it("exports the renderer entry for runtime bootstrapping", () => {
    expect(typeof renderDashboardManifest).toBe("function");
  });
});

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

function countOccurrences(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
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
    expect(panelOption.series?.[0]?.label?.fontSize).toBeGreaterThan(0);
    expect(typeof panelOption.series?.[0]?.label?.formatter).toBe("function");
    expect(markup).toContain('data-layout-mode="cockpit-stage"');
    expect(markup).toContain(
      '<section class="oc-dashboard-scene-shell" data-block-id="scene-main" data-has-dock="false">',
    );
    expect(markup).toContain('data-column-side="left"');
    expect(markup).toContain('data-column-side="right"');
    expect(countOccurrences(markup, /data-panel-count="2"/g)).toBe(2);
    expect(countOccurrences(markup, /<section class="oc-dashboard-panel(?: is-aux-panel)?"/g)).toBe(
      4,
    );
    expect(markup).toContain('class="oc-dashboard-scene-bay"');
    expect(markup).toContain('class="oc-dashboard-portal-core"');
    expect(markup).toContain('class="oc-dashboard-portal-floor"');
    expect(markup).toContain('class="oc-dashboard-portal-value"');
    expect(markup).toContain('class="oc-dashboard-portal-node node-1"');
    expect(markup).not.toContain("oc-dashboard-stage-");
    expect(markup).toContain("data-dashboard-scene");
    expect(markup).not.toContain('class="oc-dashboard-scene-dock"');
    expect(markup).not.toContain("data-dock-count=");
    expect(countOccurrences(markup, /class="oc-dashboard-scene-dock-card/g)).toBe(0);
    expect(markup).toContain('data-footer-count="2"');
    expect(markup).toContain(
      '<section class="oc-dashboard-footer-section" data-block-id="timeline">',
    );
    expect(markup).toContain(
      '<section class="oc-dashboard-footer-section" data-block-id="alerts">',
    );
    expect(markup).not.toContain(
      '<section class="oc-dashboard-panel is-aux-panel" data-block-id="timeline">',
    );
    expect(markup).not.toContain(
      '<section class="oc-dashboard-panel is-aux-panel" data-block-id="alerts">',
    );
    expect(markup).toContain('class="oc-dashboard-feed-list"');
    expect(markup).toContain('class="oc-dashboard-alert-list"');
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
    expect(markup).toContain('data-layout-mode="cockpit-stage"');
    expect(markup).toContain('data-has-dock="false"');
    expect(markup).not.toContain('class="oc-dashboard-scene-dock"');
    expect(markup).not.toContain("data-dock-count=");
    expect(countOccurrences(markup, /class="oc-dashboard-scene-dock-card/g)).toBe(0);
    expect(markup).toContain('data-column-side="left"');
    expect(markup).toContain('data-column-side="right"');
    expect(markup).toContain('data-panel-count="1"');
    expect(markup).toContain('data-panel-count="2"');
    expect(countOccurrences(markup, /<section class="oc-dashboard-panel(?: is-aux-panel)?"/g)).toBe(
      3,
    );
    expect(markup).toContain(
      '<section class="oc-dashboard-footer-section" data-block-id="timeline">',
    );
    expect(markup).toContain('<div class="oc-dashboard-footer-title">动态时间线</div>');
    expect(markup).not.toContain(
      '<section class="oc-dashboard-footer-section" data-block-id="alerts">',
    );
  });

  it("lets schema v2 JSON control dashboard structure through registered components", () => {
    const manifest = normalizeDashboardManifest({
      schemaVersion: 2,
      title: "AI 结构化大屏",
      styleProfile: "cinematic-finance",
      layout: {
        areas: [
          { id: "left", components: ["trafficTrend", "summaryText"] },
          { id: "center", components: ["coreScene"] },
          { id: "right", components: ["userTable"] },
          { id: "bottom", components: ["imageMetric", "videoMetric"] },
          { id: "footer", components: [] },
        ],
      },
      components: {
        trafficTrend: {
          type: "line-chart",
          title: "<b>今日流量</b>",
          data: {
            categories: ["A", "B"],
            series: [{ name: "访问", data: [12, 18] }],
          },
        },
        summaryText: {
          type: "text-block",
          title: "AI 说明",
          content: "平台渲染文本，不执行 <script>alert(1)</script>",
        },
        coreScene: {
          type: "scene-3d",
          title: "数据服务中心",
          subtitle: "受控 DOM 主舞台",
          sceneType: "radar-core",
        },
        userTable: {
          type: "table",
          title: "用户状态",
          columns: [
            { key: "id", label: "ID" },
            { key: "name", label: "用户" },
            { key: "status", label: "状态" },
          ],
          rows: [{ id: "01", name: "User1", status: "Online" }],
        },
        imageMetric: {
          type: "metric-card",
          label: "图片流量",
          value: "260",
          unit: "clicks",
        },
        videoMetric: {
          type: "metric-card",
          label: "视频流量",
          value: "330",
          unit: "clicks",
        },
      },
    });

    const markup = buildDashboardMarkup(manifest);

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.structure.mode).toBe("component");
    expect(manifest.structure.areas.left).toEqual(["trafficTrend", "summaryText"]);
    expect(manifest.structure.areas.center).toEqual(["coreScene"]);
    expect(manifest.structure.areas.bottom).toEqual(["imageMetric", "videoMetric"]);
    expect(manifest.metrics.map((metric) => metric.label)).toEqual(["图片流量", "视频流量"]);
    expect(manifest.scene.title).toBe("数据服务中心");
    expect(manifest.scene.type).toBe("radar-core");
    expect(manifest.blocks.scene.id).toBe("coreScene");
    expect(manifest.charts.trafficTrend.type).toBe("line");
    expect(manifest.charts.summaryText.type).toBe("text");
    expect(manifest.charts.userTable.type).toBe("table");
    expect(markup).toContain('data-layout-mode="cockpit-stage"');
    expect(markup).toContain('data-panel-slot="trafficTrend"');
    expect(markup).toContain('data-html-slot="summaryText"');
    expect(markup).toContain('data-html-slot="userTable"');
    expect(markup).toContain('data-block-id="coreScene"');
    expect(markup).toContain("&lt;b&gt;今日流量&lt;/b&gt;");
    expect(markup).not.toContain("<b>今日流量</b>");
    expect(markup).not.toContain('class="oc-dashboard-footer"');
  });

  it("exports the renderer entry for runtime bootstrapping", () => {
    expect(typeof renderDashboardManifest).toBe("function");
  });
});

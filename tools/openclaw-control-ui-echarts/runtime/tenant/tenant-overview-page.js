import { createLibraryLoader } from "../echarts/libraries.js";
import { getEchartsStyles } from "../echarts/styles.js";

const OVERVIEW_CHART_STATE = new WeakMap();
let overviewLibrariesPromise = null;
let overviewLibrariesBaseUrl = "";

function formatNumber(value) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "0";
  return new Intl.NumberFormat().format(numeric);
}

function formatCredits(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function normalizeAgentLabel(value) {
  const label = String(value ?? "").trim();
  if (!label) {
    return "";
  }
  const normalized = label.toLowerCase();
  if (normalized === "未知 agent" || normalized === "unknown agent") {
    return "";
  }
  return label;
}

function resolveAgentDisplayName(agent) {
  return (
    normalizeAgentLabel(agent?.displayName) ||
    normalizeAgentLabel(agent?.name) ||
    normalizeAgentLabel(agent?.agentName) ||
    normalizeAgentLabel(agent?.label) ||
    normalizeAgentLabel(agent?.agent_name) ||
    normalizeAgentLabel(agent?.description) ||
    normalizeAgentLabel(agent?.baseAgentId) ||
    normalizeAgentLabel(agent?.agentId) ||
    normalizeAgentLabel(agent?.agent_id) ||
    normalizeAgentLabel(agent?.id) ||
    "未知 Agent"
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectEchartsStyles() {
  const styleId = "oc-echarts-framework-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = getEchartsStyles();
  document.head.append(style);
}

function getOverviewChartState(root) {
  let state = OVERVIEW_CHART_STATE.get(root);
  if (!state) {
    state = {
      charts: new Map(),
      initToken: 0,
    };
    OVERVIEW_CHART_STATE.set(root, state);
  }
  return state;
}

function disconnectOverviewChartEntry(entry) {
  if (!entry) {
    return;
  }

  try {
    entry.cancelScheduledResize?.();
  } catch {
    // Ignore cleanup errors from canceled timers or frames.
  }

  try {
    entry.resizeObserver?.disconnect();
  } catch {
    // Ignore cleanup errors from detached observers.
  }

  if (typeof entry.resizeListener === "function") {
    try {
      window.removeEventListener("resize", entry.resizeListener);
    } catch {
      // Ignore cleanup errors from global resize listeners.
    }
  }

  try {
    entry.instance?.dispose?.();
  } catch {
    // Ignore ECharts cleanup errors on partially initialized charts.
  }
}

function disposeOverviewCharts(state) {
  for (const entry of state.charts.values()) {
    disconnectOverviewChartEntry(entry);
  }
  state.charts.clear();
}

function loadOverviewLibraries(vendorBaseUrl) {
  const resolvedBaseUrl =
    vendorBaseUrl instanceof URL ? vendorBaseUrl.href : String(vendorBaseUrl || "");
  if (!overviewLibrariesPromise || overviewLibrariesBaseUrl !== resolvedBaseUrl) {
    overviewLibrariesBaseUrl = resolvedBaseUrl;
    overviewLibrariesPromise = createLibraryLoader(vendorBaseUrl)();
  }
  return overviewLibrariesPromise;
}

function createScheduledResize(instance) {
  let handle = 0;
  let usesAnimationFrame = false;

  const flush = () => {
    handle = 0;
    try {
      instance.resize();
    } catch {
      // Ignore transient resize failures while the surface remounts.
    }
  };

  return {
    run() {
      if (handle) {
        return;
      }
      if (typeof window.requestAnimationFrame === "function") {
        usesAnimationFrame = true;
        handle = window.requestAnimationFrame(flush);
        return;
      }
      usesAnimationFrame = false;
      handle = window.setTimeout(flush, 0);
    },
    cancel() {
      if (!handle) {
        return;
      }
      if (usesAnimationFrame && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(handle);
      } else {
        window.clearTimeout(handle);
      }
      handle = 0;
    },
  };
}

function resolveOverviewChartCanvasBackground(el) {
  if (!(el instanceof HTMLElement) || typeof window.getComputedStyle !== "function") {
    return "#ffffff";
  }

  const styles = window.getComputedStyle(el);
  const configuredValue = styles.getPropertyValue("--oc-tenant-overview-chart-canvas-bg").trim();
  if (configuredValue) {
    return configuredValue;
  }

  const backgroundColor = styles.backgroundColor?.trim();
  if (
    backgroundColor &&
    backgroundColor !== "transparent" &&
    backgroundColor !== "rgba(0, 0, 0, 0)"
  ) {
    return backgroundColor;
  }

  return "#ffffff";
}

function applyOverviewChartDefaults(el, option) {
  if (typeof option.backgroundColor === "undefined") {
    option.backgroundColor = resolveOverviewChartCanvasBackground(el);
  }

  option.animation = false;
  option.animationDuration = 0;
  option.animationDurationUpdate = 0;
  option.animationEasingUpdate = "linear";
  option.stateAnimation = { duration: 0 };

  if (option.tooltip && typeof option.tooltip === "object") {
    option.tooltip = {
      ...option.tooltip,
      confine: true,
      enterable: false,
      renderMode: "richText",
      transitionDuration: 0,
    };
    if (option.tooltip.axisPointer && typeof option.tooltip.axisPointer === "object") {
      option.tooltip.axisPointer = {
        animation: false,
        ...option.tooltip.axisPointer,
      };
    }
  }

  return option;
}

function buildTrendChartOption(el, data, echarts) {
  return applyOverviewChartDefaults(el, {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
    },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.trend.map((item) => item.day.slice(5)),
      axisLabel: { color: "#64748b" },
    },
    yAxis: { type: "value", axisLabel: { color: "#64748b" } },
    series: [
      {
        name: "Tokens",
        type: "line",
        smooth: true,
        showSymbol: false,
        symbol: "none",
        data: data.trend.map((item) => item.tokens),
        lineStyle: {
          width: 2,
          color: "#3b82f6",
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(59, 130, 246, 0.24)" },
            { offset: 1, color: "rgba(59, 130, 246, 0.04)" },
          ]),
        },
        itemStyle: { color: "#3b82f6" },
      },
    ],
  });
}

function buildMembersChartOption(el, data, echarts) {
  const sortedMembers = [...(data.topMembers || [])].reverse();
  return applyOverviewChartDefaults(el, {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "value", axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: "category",
      data: sortedMembers.map((member) => member.username),
      axisLabel: { color: "#64748b" },
    },
    series: [
      {
        type: "bar",
        data: sortedMembers.map((member) => member.tokens),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: "#6366f1" },
            { offset: 1, color: "#8b5cf6" },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
        label: { show: true, position: "right", color: "#64748b" },
      },
    ],
  });
}

function buildAgentsChartOption(el, data) {
  const agentRows = [...(data.topAgents || [])];
  return applyOverviewChartDefaults(el, {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} tokens ({d}%)",
    },
    legend: {
      orient: "vertical",
      left: "left",
      padding: [0, 0, 0, 10],
      textStyle: { fontSize: 12 },
    },
    series: [
      {
        name: "Agent 消耗分布",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["60%", "50%"],
        avoidLabelOverlap: true,
        hoverAnimation: false,
        selectedMode: false,
        itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
        label: {
          show: true,
          position: "outside",
          formatter: "{b}",
        },
        emphasis: {
          scale: false,
          label: { show: true, fontSize: 12, fontWeight: 600 },
        },
        data: agentRows.map((agent) => ({
          value: agent.tokens,
          name: resolveAgentDisplayName(agent),
        })),
      },
    ],
  });
}

function createOverviewChartEntry(el, echarts) {
  const existingInstance =
    typeof echarts.getInstanceByDom === "function" ? echarts.getInstanceByDom(el) : null;
  const instance = existingInstance || echarts.init(el, null, { renderer: "canvas" });
  const scheduledResize = createScheduledResize(instance);

  let resizeObserver = null;
  let resizeListener = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      scheduledResize.run();
    });
    resizeObserver.observe(el);
  } else {
    resizeListener = () => {
      scheduledResize.run();
    };
    window.addEventListener("resize", resizeListener);
  }

  return {
    el,
    instance,
    resizeObserver,
    resizeListener,
    cancelScheduledResize: () => {
      scheduledResize.cancel();
    },
  };
}

function ensureOverviewChartEntry(root, chartKey, el, echarts) {
  const state = getOverviewChartState(root);
  const existingEntry = state.charts.get(chartKey);
  if (existingEntry?.el === el) {
    return existingEntry;
  }

  if (existingEntry) {
    disconnectOverviewChartEntry(existingEntry);
  }

  const nextEntry = createOverviewChartEntry(el, echarts);
  state.charts.set(chartKey, nextEntry);
  return nextEntry;
}

function syncOverviewCharts(root, data, echarts) {
  const chartDefinitions = [
    ["trend", (el) => buildTrendChartOption(el, data, echarts)],
    ["members", (el) => buildMembersChartOption(el, data, echarts)],
    ["agents", (el) => buildAgentsChartOption(el, data)],
  ];
  const state = getOverviewChartState(root);
  const activeChartKeys = new Set();

  for (const [chartKey, buildOption] of chartDefinitions) {
    const el = root.querySelector(`[data-oc-overview-chart="${chartKey}"]`);
    if (!(el instanceof HTMLElement)) {
      continue;
    }
    activeChartKeys.add(chartKey);
    const entry = ensureOverviewChartEntry(root, chartKey, el, echarts);
    entry.instance.setOption(buildOption(el), true);
    try {
      entry.instance.resize();
    } catch {
      // Ignore resize failures while the layout settles.
    }
  }

  for (const [chartKey, entry] of state.charts.entries()) {
    if (activeChartKeys.has(chartKey)) {
      continue;
    }
    disconnectOverviewChartEntry(entry);
    state.charts.delete(chartKey);
  }
}

export async function refreshTenantOverview(root, controller) {
  try {
    controller.overviewError = null;
    const result = await controller.apiClient.getTenantOverview();
    controller.overviewData = result || null;
  } catch (error) {
    controller.overviewError = error instanceof Error ? error.message : String(error);
  }
}

export function renderTenantOverview(controller) {
  injectEchartsStyles();

  if (controller.overviewError) {
    return `<div class="oc-tenant-overview-loading oc-tenant-overview-error">加载失败: ${escapeHtml(controller.overviewError)}</div>`;
  }

  const data = controller.overviewData;
  if (!data) {
    return `<div class="oc-tenant-overview-loading">正在加载统计数据...</div>`;
  }

  const { summary } = data;
  if (!summary) {
    return `<div class="oc-tenant-overview-loading">统计数据格式异常。</div>`;
  }
  return `
    <div class="oc-tenant-overview">
      <div class="oc-tenant-overview-grid">
        <div class="oc-tenant-card oc-tenant-metric-card">
          <div class="oc-tenant-metric-label">总消耗 Token</div>
          <div class="oc-tenant-metric-value">${formatNumber(summary.totalTokens)}</div>
          <div class="oc-tenant-metric-sub">输入: ${formatNumber(summary.inputTokens)} / 输出: ${formatNumber(summary.outputTokens)}</div>
        </div>
        <div class="oc-tenant-card oc-tenant-metric-card">
          <div class="oc-tenant-metric-label">已用积分</div>
          <div class="oc-tenant-metric-value">${formatCredits(summary.consumedCredits ?? summary.walletBalance)}</div>
          <div class="oc-tenant-metric-sub">折合消耗完成额度</div>
        </div>
        <div class="oc-tenant-card oc-tenant-metric-card">
          <div class="oc-tenant-metric-label">活跃成员</div>
          <div class="oc-tenant-metric-value">${summary.activeUsers} <span class="unit">/ ${summary.memberCount}</span></div>
          <div class="oc-tenant-metric-sub">已启用成员总数</div>
        </div>
        <div class="oc-tenant-card oc-tenant-metric-card">
          <div class="oc-tenant-metric-label">活跃 Agent</div>
          <div class="oc-tenant-metric-value">${summary.activeAgents}</div>
          <div class="oc-tenant-metric-sub">产生耗量的 Agent 总数</div>
        </div>
      </div>

      <div class="oc-tenant-overview-main">
        <div class="oc-tenant-card oc-tenant-chart-card oc-tenant-chart-card--hero">
          <div class="oc-tenant-card-header">
            <h3 class="oc-tenant-card-title">Token 消耗趋势 (14天)</h3>
          </div>
          <div class="oc-block-renderer__body">
            <div class="oc-block-renderer__chart" data-oc-overview-chart="trend"></div>
          </div>
        </div>
      </div>

      <div class="oc-tenant-overview-side">
        <div class="oc-tenant-card oc-tenant-chart-card">
          <div class="oc-tenant-card-header">
            <h3 class="oc-tenant-card-title">成员消耗排名</h3>
          </div>
          <div class="oc-block-renderer__body">
            <div class="oc-block-renderer__chart" data-oc-overview-chart="members"></div>
          </div>
        </div>
        <div class="oc-tenant-card oc-tenant-chart-card">
          <div class="oc-tenant-card-header">
            <h3 class="oc-tenant-card-title">Agent 消耗分布</h3>
          </div>
          <div class="oc-block-renderer__body">
            <div class="oc-block-renderer__chart" data-oc-overview-chart="agents"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function disposeTenantOverviewCharts(root) {
  const state = OVERVIEW_CHART_STATE.get(root);
  if (!state) {
    return;
  }
  state.initToken += 1;
  disposeOverviewCharts(state);
}

export async function initTenantOverviewCharts(root, controller) {
  const data = controller.overviewData;
  if (!data) return;

  const vendorBaseUrl = window.__ocVendorBaseUrl || new URL("../../vendor/", import.meta.url);
  const state = getOverviewChartState(root);
  const initToken = state.initToken + 1;
  state.initToken = initToken;

  let echarts;
  try {
    const libs = await loadOverviewLibraries(vendorBaseUrl);
    if (state.initToken !== initToken) {
      return;
    }
    echarts = libs.echarts;
  } catch {
    return;
  }

  queueMicrotask(() => {
    if (state.initToken !== initToken) {
      return;
    }
    if (root.dataset.ocTenantSection && root.dataset.ocTenantSection !== "statistics-overview") {
      return;
    }
    try {
      syncOverviewCharts(root, data, echarts);
    } catch {
      // Keep the overview cards rendered even if chart init fails.
    }
  });
}

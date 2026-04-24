const PANEL_SLOT_ORDER = ["leftTop", "leftBottom", "rightTop", "rightBottom"];

const PANEL_SLOT_META = {
  leftTop: { title: "经营趋势", type: "line" },
  leftBottom: { title: "成本构成", type: "bar" },
  rightTop: { title: "资产占比", type: "pie" },
  rightBottom: { title: "健康评估", type: "radar" },
};

const DEFAULT_THEME = {
  background: "#040b16",
  surface: "rgba(7, 19, 38, 0.72)",
  surfaceStrong: "rgba(8, 24, 46, 0.92)",
  accent: "#62e6ff",
  accentSoft: "#2b8dff",
  success: "#38d39f",
  warning: "#ffb454",
  danger: "#ff6b81",
  text: "#e5fbff",
  muted: "#87a5c4",
  grid: "rgba(98, 230, 255, 0.18)",
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value, fallback = NaN) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundNumber(value, digits = 2) {
  const numeric = toFiniteNumber(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function deepMerge(baseValue, overrideValue) {
  if (Array.isArray(overrideValue)) {
    return overrideValue.map((item) => deepMerge(undefined, item));
  }
  if (!isPlainObject(overrideValue)) {
    return overrideValue === undefined ? baseValue : overrideValue;
  }
  const base = isPlainObject(baseValue) ? baseValue : {};
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrideValue)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

function normalizeMetric(metric, index) {
  const value =
    metric && Object.prototype.hasOwnProperty.call(metric, "value") ? metric.value : metric?.number;
  const numericValue = toFiniteNumber(
    metric?.numericValue,
    toFiniteNumber(
      typeof value === "string" ? value.replace(/[^\d.+-]/g, "") : value,
      Number(index + 1) * 10,
    ),
  );
  return {
    id: String(metric?.id || `metric-${index + 1}`).trim() || `metric-${index + 1}`,
    label:
      String(metric?.label || metric?.name || `核心指标 ${index + 1}`).trim() ||
      `核心指标 ${index + 1}`,
    valueText: String(value ?? "").trim() || `${roundNumber(numericValue, 1)}`,
    numericValue,
    unit: String(metric?.unit || "").trim(),
    delta: String(metric?.delta || metric?.trendText || "").trim(),
    trend:
      String(metric?.trend || "")
        .trim()
        .toLowerCase() || "",
    note: String(metric?.note || "").trim(),
  };
}

function buildDefaultMetrics() {
  return [
    { label: "总资产", value: "128.6", unit: "亿元", delta: "+6.8%", trend: "up" },
    { label: "营收完成", value: "42.1", unit: "亿元", delta: "+3.1%", trend: "up" },
    { label: "融资余额", value: "18.4", unit: "亿元", delta: "-1.2%", trend: "down" },
    { label: "高风险事项", value: "3", unit: "项", delta: "需跟进", trend: "alert" },
  ].map(normalizeMetric);
}

function normalizeSeriesEntry(entry, index) {
  if (!isPlainObject(entry)) {
    return {
      name: `系列 ${index + 1}`,
      type: "",
      data: [],
    };
  }
  return {
    name: String(entry.name || `系列 ${index + 1}`).trim() || `系列 ${index + 1}`,
    type: String(entry.type || "")
      .trim()
      .toLowerCase(),
    stack: String(entry.stack || "").trim(),
    smooth: entry.smooth !== false,
    area: Boolean(entry.area || entry.areaStyle),
    data: toArray(entry.data).map((item) => {
      if (isPlainObject(item) && Object.prototype.hasOwnProperty.call(item, "value")) {
        return item.value;
      }
      return item;
    }),
  };
}

function normalizeChartItems(items = []) {
  return toArray(items).map((item, index) => {
    if (isPlainObject(item)) {
      const value = toFiniteNumber(item.value, Number(index + 1) * 10);
      return {
        name: String(item.name || item.label || `项 ${index + 1}`).trim() || `项 ${index + 1}`,
        value,
      };
    }
    return {
      name: `项 ${index + 1}`,
      value: toFiniteNumber(item, Number(index + 1) * 10),
    };
  });
}

function normalizeIndicators(indicators = []) {
  return toArray(indicators).map((item, index) => {
    if (isPlainObject(item)) {
      return {
        name: String(item.name || item.label || `维度 ${index + 1}`).trim() || `维度 ${index + 1}`,
        max: toFiniteNumber(item.max, 100),
      };
    }
    return {
      name: String(item || `维度 ${index + 1}`).trim() || `维度 ${index + 1}`,
      max: 100,
    };
  });
}

function normalizeRows(rows = []) {
  return toArray(rows).map((row, index) => {
    if (isPlainObject(row)) {
      return row;
    }
    return {
      index: index + 1,
      value: row,
    };
  });
}

function normalizeChart(rawChart, slotKey, fallbackType, fallbackTitle) {
  const chart = isPlainObject(rawChart) ? rawChart : {};
  const items =
    chart.type === "pie" || chart.type === "ranking" || chart.type === "stat"
      ? normalizeChartItems(chart.items || chart.data)
      : normalizeChartItems(chart.items);
  return {
    slotKey,
    type:
      String(chart.type || fallbackType || "")
        .trim()
        .toLowerCase() || "line",
    title: String(chart.title || fallbackTitle || "").trim() || fallbackTitle,
    subtitle: String(chart.subtitle || "").trim(),
    unit: String(chart.unit || "").trim(),
    categories: toArray(chart.categories || chart.labels || chart.xAxisData).map(
      (item, index) => String(item ?? `项 ${index + 1}`).trim() || `项 ${index + 1}`,
    ),
    series: toArray(chart.series).map(normalizeSeriesEntry),
    items,
    indicators: normalizeIndicators(chart.indicators),
    values: toArray(chart.values).map((item) => toFiniteNumber(item, 0)),
    rows: normalizeRows(chart.rows || chart.dataRows),
    columns: toArray(chart.columns).map((item, index) => {
      if (isPlainObject(item)) {
        return {
          key:
            String(item.key || item.field || `column_${index + 1}`).trim() || `column_${index + 1}`,
          label:
            String(item.label || item.title || item.key || `列 ${index + 1}`).trim() ||
            `列 ${index + 1}`,
        };
      }
      const key = String(item || `column_${index + 1}`).trim() || `column_${index + 1}`;
      return { key, label: key };
    }),
    option: isPlainObject(chart.option) ? chart.option : null,
    linkHref: String(chart.linkHref || chart.href || "").trim(),
    footer: String(chart.footer || "").trim(),
  };
}

function normalizeTimelineItem(item, index) {
  if (isPlainObject(item)) {
    return {
      time: String(item.time || item.when || "").trim() || `T${index + 1}`,
      label: String(item.label || item.title || item.name || "").trim() || `动态 ${index + 1}`,
      value: String(item.value || item.note || "").trim(),
    };
  }
  return {
    time: `T${index + 1}`,
    label: String(item || `动态 ${index + 1}`).trim() || `动态 ${index + 1}`,
    value: "",
  };
}

function normalizeAlertItem(item, index) {
  if (isPlainObject(item)) {
    return {
      level:
        String(item.level || item.status || "")
          .trim()
          .toLowerCase() || "info",
      title: String(item.title || item.label || item.name || "").trim() || `提醒 ${index + 1}`,
      value: String(item.value || item.note || "").trim(),
    };
  }
  return {
    level: "info",
    title: String(item || `提醒 ${index + 1}`).trim() || `提醒 ${index + 1}`,
    value: "",
  };
}

function buildDefaultTimeline() {
  return [
    { time: "08:30", label: "预算执行刷新", value: "已完成" },
    { time: "10:15", label: "融资结构复核", value: "进行中" },
    { time: "14:00", label: "偿债能力预警", value: "需关注" },
  ].map(normalizeTimelineItem);
}

function buildDefaultAlerts() {
  return [
    { level: "high", title: "应收账款增速偏高", value: "2 家平台需跟进" },
    { level: "medium", title: "现金流波动放大", value: "建议复核回款节奏" },
    { level: "low", title: "债务久期结构优化", value: "滚动窗口稳定" },
  ].map(normalizeAlertItem);
}

export function resolveDashboardAssetHref(workspaceBaseHref, assetPath) {
  const normalizedPath = String(assetPath || "").trim();
  if (!normalizedPath) {
    return "";
  }
  if (/^(?:[a-zA-Z][a-zA-Z\d+\-.]*:|\/\/|\/|#|\?)/.test(normalizedPath)) {
    return normalizedPath;
  }
  const baseUrl = new URL(String(workspaceBaseHref || "/"), "http://127.0.0.1");
  const resolved = new URL(normalizedPath, baseUrl);
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function normalizeNavigationItem(item, index, context) {
  if (!isPlainObject(item)) {
    return null;
  }
  const targetFileName = String(item.targetFileName || item.fileName || "").trim();
  const explicitHref = String(item.href || "").trim();
  const href =
    explicitHref ||
    (targetFileName ? String(context?.navigationHrefs?.[targetFileName] || "").trim() : "");
  return {
    id: String(item.id || `nav-${index + 1}`).trim() || `nav-${index + 1}`,
    label:
      String(item.label || item.title || item.name || `分屏 ${index + 1}`).trim() ||
      `分屏 ${index + 1}`,
    href,
    active:
      String(targetFileName || explicitHref).trim() ===
      String(context?.visualizationFileName || "").trim(),
  };
}

export function normalizeDashboardManifest(rawManifest, context = {}) {
  const manifest = isPlainObject(rawManifest) ? rawManifest : {};
  const metrics = toArray(manifest.metrics || manifest.kpis)
    .map(normalizeMetric)
    .filter(Boolean);
  const chartSource = Array.isArray(manifest.charts)
    ? PANEL_SLOT_ORDER.reduce((result, slotKey, index) => {
        result[slotKey] = manifest.charts[index];
        return result;
      }, {})
    : isPlainObject(manifest.charts)
      ? manifest.charts
      : {};
  const charts = PANEL_SLOT_ORDER.reduce((result, slotKey) => {
    const meta = PANEL_SLOT_META[slotKey];
    result[slotKey] = normalizeChart(chartSource[slotKey], slotKey, meta.type, meta.title);
    return result;
  }, {});
  const theme = deepMerge(DEFAULT_THEME, isPlainObject(manifest.theme) ? manifest.theme : {});
  const navigation = toArray(manifest.navigation)
    .map((item, index) => normalizeNavigationItem(item, index, context))
    .filter(Boolean);
  return {
    version: toFiniteNumber(manifest.version, 1),
    template:
      String(manifest.template || "")
        .trim()
        .toLowerCase() || "financial-command-center-v1",
    title:
      String(manifest.title || manifest.name || context.visualizationName || "可视化展示").trim() ||
      "可视化展示",
    subtitle: String(manifest.subtitle || manifest.description || "").trim(),
    description: String(manifest.description || "").trim(),
    theme,
    backgroundImage: resolveDashboardAssetHref(
      context.workspaceBaseHref,
      manifest.backgroundImage || manifest.background?.image,
    ),
    logoImage: resolveDashboardAssetHref(
      context.workspaceBaseHref,
      manifest.logoImage || manifest.brand?.logoImage,
    ),
    logoText:
      String(manifest.logoText || manifest.brand?.logoText || context.agentName || "").trim() || "",
    metrics: metrics.length ? metrics : buildDefaultMetrics(),
    scene: {
      type:
        String(manifest.scene?.type || "")
          .trim()
          .toLowerCase() || "capital-reactor",
      title:
        String(
          manifest.scene?.title || manifest.scene?.name || manifest.title || "资金能量场",
        ).trim() || "资金能量场",
      subtitle: String(manifest.scene?.subtitle || manifest.scene?.description || "").trim(),
      option: isPlainObject(manifest.scene?.option) ? manifest.scene.option : null,
      points: toArray(manifest.scene?.points),
      values: toArray(manifest.scene?.values).map((item) => toFiniteNumber(item, 0)),
    },
    charts,
    timeline: toArray(manifest.timeline).map(normalizeTimelineItem).filter(Boolean).length
      ? toArray(manifest.timeline).map(normalizeTimelineItem).filter(Boolean)
      : buildDefaultTimeline(),
    alerts: toArray(manifest.alerts).map(normalizeAlertItem).filter(Boolean).length
      ? toArray(manifest.alerts).map(normalizeAlertItem).filter(Boolean)
      : buildDefaultAlerts(),
    particles: deepMerge(
      {
        enabled: manifest.particles !== false,
        number: 40,
        color: theme.accent,
      },
      isPlainObject(manifest.particles) ? manifest.particles : {},
    ),
    navigation,
    dataSource:
      typeof manifest.dataSource === "string"
        ? manifest.dataSource.trim()
        : isPlainObject(manifest.dataSource)
          ? { ...manifest.dataSource }
          : "",
  };
}

function formatMetricDelta(metric) {
  if (!metric.delta) {
    return "";
  }
  const trendClass =
    metric.trend === "down"
      ? "down"
      : metric.trend === "alert"
        ? "alert"
        : metric.trend === "up"
          ? "up"
          : "flat";
  return `<span class="oc-dashboard-metric-delta ${trendClass}">${escapeHtml(metric.delta)}</span>`;
}

function buildMetricMarkup(metric) {
  return [
    '<article class="oc-dashboard-metric">',
    `  <div class="oc-dashboard-metric-label">${escapeHtml(metric.label)}</div>`,
    '  <div class="oc-dashboard-metric-value-line">',
    `    <strong class="oc-dashboard-metric-value">${escapeHtml(metric.valueText)}</strong>`,
    metric.unit
      ? `    <span class="oc-dashboard-metric-unit">${escapeHtml(metric.unit)}</span>`
      : "",
    "  </div>",
    formatMetricDelta(metric),
    metric.note ? `  <div class="oc-dashboard-metric-note">${escapeHtml(metric.note)}</div>` : "",
    "</article>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPanelMarkup(chart) {
  const renderMode = isHtmlPanelType(chart) ? "html" : "chart";
  return [
    `<section class="oc-dashboard-panel" data-panel-slot="${escapeHtmlAttribute(chart.slotKey)}">`,
    '  <div class="oc-dashboard-panel-head">',
    `    <div class="oc-dashboard-panel-title">${escapeHtml(chart.title)}</div>`,
    chart.subtitle
      ? `    <div class="oc-dashboard-panel-subtitle">${escapeHtml(chart.subtitle)}</div>`
      : "",
    "  </div>",
    renderMode === "chart"
      ? `  <div class="oc-dashboard-panel-chart" data-chart-slot="${escapeHtmlAttribute(chart.slotKey)}"></div>`
      : `  <div class="oc-dashboard-panel-html" data-html-slot="${escapeHtmlAttribute(chart.slotKey)}"></div>`,
    chart.footer
      ? `  <div class="oc-dashboard-panel-footer">${escapeHtml(chart.footer)}</div>`
      : "",
    "</section>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTimelineMarkup(items) {
  return items
    .map(
      (item) => `
        <li class="oc-dashboard-feed-item">
          <span class="oc-dashboard-feed-time">${escapeHtml(item.time)}</span>
          <span class="oc-dashboard-feed-label">${escapeHtml(item.label)}</span>
          ${item.value ? `<span class="oc-dashboard-feed-value">${escapeHtml(item.value)}</span>` : ""}
        </li>`,
    )
    .join("");
}

function buildAlertsMarkup(items) {
  return items
    .map(
      (item) => `
        <li class="oc-dashboard-alert-item ${escapeHtmlAttribute(item.level)}">
          <span class="oc-dashboard-alert-title">${escapeHtml(item.title)}</span>
          ${item.value ? `<span class="oc-dashboard-alert-value">${escapeHtml(item.value)}</span>` : ""}
        </li>`,
    )
    .join("");
}

function buildNavigationMarkup(items) {
  if (!items.length) {
    return "";
  }
  return `
    <nav class="oc-dashboard-nav">
      ${items
        .map(
          (item) => `
            <button
              class="oc-dashboard-nav-button${item.active ? " is-active" : ""}${item.href ? "" : " is-disabled"}"
              type="button"
              ${item.href ? `data-nav-href="${escapeHtmlAttribute(item.href)}"` : "disabled"}
            >
              ${escapeHtml(item.label)}
            </button>`,
        )
        .join("")}
    </nav>`;
}

export function isHtmlPanelType(chart) {
  return new Set(["ranking", "table", "stat", "list"]).has(String(chart?.type || "").trim());
}

function createAxisConfig(theme) {
  return {
    axisLine: { lineStyle: { color: theme.grid } },
    axisLabel: { color: theme.muted },
    splitLine: { lineStyle: { color: theme.grid } },
    axisTick: { show: false },
  };
}

function createPalette(theme) {
  return [theme.accent, theme.accentSoft, theme.success, theme.warning, theme.danger];
}

function createChartSeries(chart, fallbackType) {
  if (chart.series.length) {
    return chart.series.map((series, index) => ({
      name: series.name,
      type: series.type || fallbackType,
      smooth: fallbackType === "line" ? series.smooth !== false : undefined,
      stack: series.stack || undefined,
      areaStyle: fallbackType === "line" && series.area ? {} : undefined,
      barMaxWidth: fallbackType === "bar" ? 16 : undefined,
      emphasis: { focus: "series" },
      data: series.data,
    }));
  }
  if (chart.items.length) {
    return [
      {
        name: chart.title,
        type: fallbackType,
        smooth: fallbackType === "line",
        barMaxWidth: fallbackType === "bar" ? 16 : undefined,
        emphasis: { focus: "series" },
        data: chart.items.map((item) => item.value),
      },
    ];
  }
  return [
    {
      name: chart.title,
      type: fallbackType,
      smooth: fallbackType === "line",
      emphasis: { focus: "series" },
      data: [18, 22, 19, 25, 28, 24],
    },
  ];
}

function buildLineOrBarOption(chart, manifest, fallbackType) {
  const theme = manifest.theme;
  const categories =
    chart.categories.length || chart.items.length || chart.series[0]?.data?.length
      ? chart.categories.length
        ? chart.categories
        : chart.items.length
          ? chart.items.map((item) => item.name)
          : chart.series[0].data.map((_, index) => `阶段 ${index + 1}`)
      : ["01", "02", "03", "04", "05", "06"];
  return {
    backgroundColor: "transparent",
    color: createPalette(theme),
    textStyle: { color: theme.text },
    tooltip: { trigger: "axis" },
    grid: { top: 20, right: 16, bottom: 28, left: 42 },
    xAxis: {
      type: "category",
      data: categories,
      ...createAxisConfig(theme),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      ...createAxisConfig(theme),
      axisLabel: {
        color: theme.muted,
        formatter: chart.unit ? `{value}${chart.unit}` : "{value}",
      },
    },
    series: createChartSeries(chart, fallbackType),
  };
}

function buildPieOption(chart, manifest) {
  const theme = manifest.theme;
  const items = chart.items.length
    ? chart.items
    : manifest.metrics.map((metric) => ({ name: metric.label, value: metric.numericValue }));
  return {
    backgroundColor: "transparent",
    color: createPalette(theme),
    tooltip: { trigger: "item" },
    series: [
      {
        name: chart.title,
        type: "pie",
        radius: ["48%", "76%"],
        center: ["50%", "54%"],
        roseType: "radius",
        label: {
          color: theme.text,
          formatter: ({ name, percent }) => `${name} ${percent}%`,
        },
        labelLine: { lineStyle: { color: theme.grid } },
        itemStyle: {
          borderColor: "rgba(4, 11, 22, 0.92)",
          borderWidth: 2,
        },
        data: items,
      },
    ],
  };
}

function buildRadarOption(chart, manifest) {
  const theme = manifest.theme;
  const indicators = chart.indicators.length
    ? chart.indicators
    : [
        { name: "偿债", max: 100 },
        { name: "盈利", max: 100 },
        { name: "预算", max: 100 },
        { name: "融资", max: 100 },
        { name: "回款", max: 100 },
      ];
  const values = chart.values.length
    ? chart.values
    : manifest.metrics.map((metric, index) =>
        Math.max(35, Math.min(98, roundNumber(metric.numericValue + index * 7, 0))),
      );
  return {
    backgroundColor: "transparent",
    color: createPalette(theme),
    radar: {
      indicator: indicators,
      radius: "70%",
      splitNumber: 4,
      axisName: { color: theme.text },
      splitArea: {
        areaStyle: {
          color: [
            "rgba(98, 230, 255, 0.02)",
            "rgba(98, 230, 255, 0.04)",
            "rgba(98, 230, 255, 0.06)",
            "rgba(98, 230, 255, 0.08)",
          ],
        },
      },
      splitLine: { lineStyle: { color: theme.grid } },
      axisLine: { lineStyle: { color: theme.grid } },
    },
    series: [
      {
        type: "radar",
        areaStyle: { color: "rgba(98, 230, 255, 0.22)" },
        lineStyle: { color: theme.accent, width: 2 },
        data: [{ value: values, name: chart.title }],
      },
    ],
  };
}

function createSceneRingPoints(radius, count, height, phase = 0, scale = 1) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = phase + (index / count) * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 3) * 0.14;
    points.push([
      roundNumber(Math.cos(angle) * radius * wobble, 3),
      roundNumber(Math.sin(angle) * radius * wobble, 3),
      roundNumber(Math.sin(angle * 2) * height * scale, 3),
      roundNumber(4 + ((index + count) % 5), 2),
    ]);
  }
  return points;
}

function stripScenePointSize(points) {
  return toArray(points).map((point) => [
    roundNumber(toFiniteNumber(point?.[0], 0), 3),
    roundNumber(toFiniteNumber(point?.[1], 0), 3),
    roundNumber(toFiniteNumber(point?.[2], 0), 3),
  ]);
}

function createMetricAnchorPoints(metrics, radius, baseHeight, amplitudeDivisor, phase = 0) {
  return metrics.map((metric, index) => {
    const angle = phase + (index / Math.max(1, metrics.length)) * Math.PI * 2;
    const amplitude = Math.max(6, Math.min(30, metric.numericValue / amplitudeDivisor));
    return [
      roundNumber(Math.cos(angle) * radius, 3),
      roundNumber(Math.sin(angle) * radius, 3),
      roundNumber(baseHeight + amplitude, 3),
    ];
  });
}

function createCoreColumnPoints(levels) {
  return toArray(levels).map((height) => [0, 0, roundNumber(toFiniteNumber(height, 0), 3)]);
}

function createSceneBaseOption(theme, bounds, viewControl) {
  return {
    backgroundColor: "transparent",
    tooltip: { show: false },
    xAxis3D: { min: bounds.x[0], max: bounds.x[1], ...createAxisConfig(theme) },
    yAxis3D: { min: bounds.y[0], max: bounds.y[1], ...createAxisConfig(theme) },
    zAxis3D: { min: bounds.z[0], max: bounds.z[1], ...createAxisConfig(theme) },
    grid3D: {
      boxWidth: bounds.boxWidth,
      boxDepth: bounds.boxDepth,
      boxHeight: bounds.boxHeight,
      environment: "transparent",
      axisPointer: { show: false },
      light: {
        main: { intensity: 1.12, shadow: false },
        ambient: { intensity: 0.7 },
      },
      viewControl: {
        projection: "perspective",
        autoRotate: true,
        autoRotateSpeed: 6,
        distance: 152,
        alpha: 22,
        beta: 38,
        ...viewControl,
      },
    },
  };
}

function createScatterSceneSeries({
  haloPoints,
  orbitPoints = [],
  metricPoints,
  corePoints,
  theme,
  metricColor,
  coreColor,
}) {
  return [
    {
      type: "scatter3D",
      symbol: "circle",
      symbolSize: 6,
      itemStyle: {
        color: theme.accent,
        opacity: 0.52,
      },
      data: haloPoints,
    },
    {
      type: "scatter3D",
      symbol: "diamond",
      symbolSize: 10,
      itemStyle: {
        color: theme.accentSoft,
        opacity: 0.66,
      },
      data: orbitPoints,
    },
    {
      type: "scatter3D",
      symbol: "roundRect",
      symbolSize: 16,
      itemStyle: {
        color: metricColor,
        opacity: 0.94,
      },
      data: metricPoints,
    },
    {
      type: "scatter3D",
      symbol: "circle",
      symbolSize: 20,
      itemStyle: {
        color: coreColor,
        opacity: 0.96,
      },
      data: corePoints,
    },
  ].filter((series) => series.data.length);
}

function buildCapitalReactorScene(manifest) {
  const theme = manifest.theme;
  const metrics = manifest.metrics;
  return {
    ...createSceneBaseOption(
      theme,
      {
        x: [-48, 48],
        y: [-48, 48],
        z: [-28, 52],
        boxWidth: 96,
        boxDepth: 96,
        boxHeight: 72,
      },
      {
        autoRotateSpeed: 8,
        distance: 150,
        alpha: 24,
        beta: 42,
      },
    ),
    series: createScatterSceneSeries({
      haloPoints: stripScenePointSize([
        ...createSceneRingPoints(18, 44, 8, 0.2),
        ...createSceneRingPoints(28, 52, 12, 0.7, 1.15),
        ...createSceneRingPoints(38, 60, 16, 1.3, 1.35),
      ]),
      orbitPoints: createMetricAnchorPoints(metrics, 22, 6, 4.5, 0.35),
      metricPoints: createMetricAnchorPoints(metrics, 34, 10, 3, 0.1),
      corePoints: createCoreColumnPoints([0, 10, 18, 28]),
      theme,
      metricColor: theme.warning,
      coreColor: theme.text,
    }),
  };
}

function buildAssetRingScene(manifest) {
  const theme = manifest.theme;
  const metrics = manifest.metrics;
  return {
    ...createSceneBaseOption(
      theme,
      {
        x: [-56, 56],
        y: [-56, 56],
        z: [-20, 58],
        boxWidth: 112,
        boxDepth: 112,
        boxHeight: 78,
      },
      {
        autoRotateSpeed: 6,
        distance: 156,
        alpha: 18,
        beta: 50,
      },
    ),
    series: createScatterSceneSeries({
      haloPoints: stripScenePointSize([
        ...createSceneRingPoints(22, 40, 4, 0.1),
        ...createSceneRingPoints(34, 54, 8, 0.8),
        ...createSceneRingPoints(46, 66, 12, 1.5),
      ]),
      orbitPoints: createMetricAnchorPoints(metrics, 30, 8, 4.2, 0.55),
      metricPoints: createMetricAnchorPoints(metrics, 46, 14, 2.5, 0.15),
      corePoints: createCoreColumnPoints([0, 8, 16, 24]),
      theme,
      metricColor: theme.success,
      coreColor: theme.warning,
    }),
  };
}

function buildRadarCoreScene(manifest) {
  const theme = manifest.theme;
  const metrics = manifest.metrics;
  const polygon = metrics.map((metric, index) => {
    const angle = (index / Math.max(1, metrics.length)) * Math.PI * 2;
    const radius = Math.max(16, Math.min(44, metric.numericValue / 2.8));
    return [
      roundNumber(Math.cos(angle) * radius, 3),
      roundNumber(Math.sin(angle) * radius, 3),
      roundNumber(6 + (index % 3) * 6, 3),
    ];
  });
  return {
    ...createSceneBaseOption(
      theme,
      {
        x: [-52, 52],
        y: [-52, 52],
        z: [-18, 50],
        boxWidth: 104,
        boxDepth: 104,
        boxHeight: 74,
      },
      {
        autoRotateSpeed: 4,
        distance: 150,
        alpha: 26,
        beta: 32,
      },
    ),
    series: createScatterSceneSeries({
      haloPoints: stripScenePointSize([
        ...createSceneRingPoints(24, 48, 8, 0.5),
        ...createSceneRingPoints(36, 60, 10, 1.4),
      ]),
      orbitPoints: polygon,
      metricPoints: createMetricAnchorPoints(metrics, 28, 10, 3.4, 0.4),
      corePoints: createCoreColumnPoints([0, 7, 14, 21]),
      theme,
      metricColor: theme.danger,
      coreColor: theme.accent,
    }),
  };
}

export function buildSceneFallbackOption(manifest) {
  const theme = manifest.theme;
  const metrics = manifest.metrics;
  return {
    ...createSceneBaseOption(
      theme,
      {
        x: [-48, 48],
        y: [-48, 48],
        z: [-18, 46],
        boxWidth: 96,
        boxDepth: 96,
        boxHeight: 64,
      },
      {
        autoRotateSpeed: 5,
        distance: 148,
        alpha: 20,
        beta: 34,
      },
    ),
    series: createScatterSceneSeries({
      haloPoints: stripScenePointSize([
        ...createSceneRingPoints(18, 36, 5, 0.1),
        ...createSceneRingPoints(30, 48, 8, 1),
      ]),
      orbitPoints: createMetricAnchorPoints(metrics, 24, 6, 4.8, 0.25),
      metricPoints: createMetricAnchorPoints(metrics, 36, 10, 3.2, 0),
      corePoints: createCoreColumnPoints([0, 8, 16, 24]),
      theme,
      metricColor: theme.warning,
      coreColor: theme.text,
    }),
  };
}

export function buildSceneOption(manifest) {
  if (isPlainObject(manifest.scene?.option)) {
    return manifest.scene.option;
  }
  const sceneType = String(manifest.scene?.type || "")
    .trim()
    .toLowerCase();
  if (sceneType === "asset-ring") {
    return buildAssetRingScene(manifest);
  }
  if (sceneType === "radar-core") {
    return buildRadarCoreScene(manifest);
  }
  return buildCapitalReactorScene(manifest);
}

export function buildPanelOption(chart, manifest) {
  if (isPlainObject(chart?.option)) {
    return chart.option;
  }
  const chartType =
    String(chart?.type || "")
      .trim()
      .toLowerCase() || "line";
  if (chartType === "pie") {
    return buildPieOption(chart, manifest);
  }
  if (chartType === "radar") {
    return buildRadarOption(chart, manifest);
  }
  if (chartType === "bar") {
    return buildLineOrBarOption(chart, manifest, "bar");
  }
  return buildLineOrBarOption(chart, manifest, "line");
}

export function buildDashboardMarkup(manifest, context = {}) {
  const sceneTitle = manifest.scene.title || manifest.title;
  const sceneSubtitle =
    manifest.scene.subtitle || manifest.subtitle || context.agentName || "零侵入仪表盘运行时";
  return `
    <div class="oc-dashboard-shell" data-template="${escapeHtmlAttribute(manifest.template)}">
      <div class="oc-dashboard-particles" id="oc-dashboard-particles"></div>
      <div class="oc-dashboard-backdrop"></div>
      <header class="oc-dashboard-header">
        <div class="oc-dashboard-title-group">
          <div class="oc-dashboard-brand-row">
            ${
              manifest.logoImage
                ? `<img class="oc-dashboard-logo-image" src="${escapeHtmlAttribute(manifest.logoImage)}" alt="${escapeHtmlAttribute(manifest.logoText || manifest.title)}" />`
                : manifest.logoText
                  ? `<span class="oc-dashboard-logo-text">${escapeHtml(manifest.logoText)}</span>`
                  : ""
            }
            <span class="oc-dashboard-template-tag">${escapeHtml(manifest.template)}</span>
          </div>
          <h1 class="oc-dashboard-title">${escapeHtml(manifest.title)}</h1>
          ${
            manifest.subtitle
              ? `<p class="oc-dashboard-subtitle">${escapeHtml(manifest.subtitle)}</p>`
              : ""
          }
        </div>
        <div class="oc-dashboard-header-side">
          <div class="oc-dashboard-now" data-dashboard-now></div>
          ${buildNavigationMarkup(manifest.navigation)}
        </div>
      </header>
      <section class="oc-dashboard-metrics">
        ${manifest.metrics.map(buildMetricMarkup).join("")}
      </section>
      <main class="oc-dashboard-main">
        <section class="oc-dashboard-column left">
          ${buildPanelMarkup(manifest.charts.leftTop)}
          ${buildPanelMarkup(manifest.charts.leftBottom)}
        </section>
        <section class="oc-dashboard-scene-shell">
          <div class="oc-dashboard-scene-overlay">
            <div class="oc-dashboard-scene-kicker">CORE SCENE</div>
            <div class="oc-dashboard-scene-title">${escapeHtml(sceneTitle)}</div>
            <div class="oc-dashboard-scene-subtitle">${escapeHtml(sceneSubtitle)}</div>
          </div>
          <div class="oc-dashboard-scene-grid"></div>
          <div class="oc-dashboard-scene-ring ring-a"></div>
          <div class="oc-dashboard-scene-ring ring-b"></div>
          <div class="oc-dashboard-scene-ring ring-c"></div>
          <div class="oc-dashboard-scene-chart" data-dashboard-scene></div>
        </section>
        <section class="oc-dashboard-column right">
          ${buildPanelMarkup(manifest.charts.rightTop)}
          ${buildPanelMarkup(manifest.charts.rightBottom)}
        </section>
      </main>
      <footer class="oc-dashboard-footer">
        <section class="oc-dashboard-footer-section">
          <div class="oc-dashboard-footer-title">动态时间线</div>
          <ul class="oc-dashboard-feed-list">
            ${buildTimelineMarkup(manifest.timeline)}
          </ul>
        </section>
        <section class="oc-dashboard-footer-section">
          <div class="oc-dashboard-footer-title">风险提示</div>
          <ul class="oc-dashboard-alert-list">
            ${buildAlertsMarkup(manifest.alerts)}
          </ul>
        </section>
      </footer>
    </div>`;
}

import {
  buildDashboardMarkup,
  buildSceneFallbackOption,
  buildPanelOption,
  buildSceneOption,
  deepMerge,
  isHtmlPanelType,
  normalizeDashboardManifest,
  resolveDashboardAssetHref,
} from "./templates.js";

const DASHBOARD_RUNTIME_STATE_KEY = "__ocDashboardManifestRuntimeState";
const DASHBOARD_SCRIPT_CACHE_KEY = "__ocDashboardManifestScriptCache";

function getGlobalScriptCache() {
  if (!(globalThis[DASHBOARD_SCRIPT_CACHE_KEY] instanceof Map)) {
    globalThis[DASHBOARD_SCRIPT_CACHE_KEY] = new Map();
  }
  return globalThis[DASHBOARD_SCRIPT_CACHE_KEY];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readWindowLocationHref(targetWindow) {
  try {
    return String(targetWindow?.location?.href || "").trim();
  } catch {
    return "";
  }
}

export function resolveDashboardRuntimeUrl(url, baseCandidates = []) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    throw new Error("dashboard_runtime_url_missing");
  }

  const normalizedBaseCandidates = [
    ...baseCandidates,
    readWindowLocationHref(globalThis),
    String(document.baseURI || "").trim(),
    readWindowLocationHref(window.top),
    readWindowLocationHref(window.parent),
  ].filter(Boolean);

  for (const candidate of normalizedBaseCandidates) {
    try {
      return new URL(normalizedUrl, candidate).href;
    } catch {
      // Try the next candidate until a stable same-origin base is found.
    }
  }

  if (/^(?:[a-zA-Z][a-zA-Z\d+\-.]*:|\/\/|\/)/.test(normalizedUrl)) {
    return normalizedUrl;
  }

  throw new Error(`dashboard_runtime_url_invalid:${normalizedUrl}`);
}

function loadScriptOnce(url, context = {}) {
  const absoluteUrl = resolveDashboardRuntimeUrl(url, [
    String(context.visualizationHref || "").trim(),
    String(context.workspaceBaseHref || "").trim(),
  ]);
  const cache = getGlobalScriptCache();
  if (cache.has(absoluteUrl)) {
    return cache.get(absoluteUrl);
  }
  const promise = new Promise((resolve, reject) => {
    const existing =
      Array.from(document.scripts).find((script) => script.src === absoluteUrl) || null;
    const script = existing ?? document.createElement("script");
    let settled = false;
    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      if (settled) {
        return;
      }
      settled = true;
      script.dataset.ocDashboardLoaded = "true";
      cleanup();
      resolve(script);
    };
    const handleError = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(`dashboard_asset_load_failed:${absoluteUrl}`));
    };
    if (script.dataset.ocDashboardLoaded === "true") {
      resolve(script);
      return;
    }
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.src = absoluteUrl;
      script.async = true;
      document.head.append(script);
    }
  });
  cache.set(absoluteUrl, promise);
  return promise;
}

async function ensureVendorLibraries(manifest, context = {}) {
  await loadScriptOnce("/assets/vendor/echarts.min.js", context);
  await loadScriptOnce("/assets/vendor/echarts-gl.min.js", context);
  await loadScriptOnce("/assets/vendor/gsap.min.js", context).catch(() => null);
  if (manifest.particles?.enabled) {
    await loadScriptOnce("/assets/vendor/tsparticles.bundle.min.js", context).catch(() => null);
  }
  if (!globalThis.echarts?.init) {
    throw new Error("dashboard_runtime_missing_echarts");
  }
}

function disposeDashboardRuntime(root) {
  const state = root?.[DASHBOARD_RUNTIME_STATE_KEY];
  if (!state || typeof state !== "object") {
    return;
  }
  for (const instance of Array.isArray(state.chartInstances) ? state.chartInstances : []) {
    try {
      instance?.dispose?.();
    } catch {
      // Ignore chart disposal failures during rerender.
    }
  }
  if (state.resizeObserver?.disconnect) {
    state.resizeObserver.disconnect();
  }
  if (state.clockTimer) {
    window.clearInterval(state.clockTimer);
  }
  delete root[DASHBOARD_RUNTIME_STATE_KEY];
}

function renderDashboardError(root, title, detail = "") {
  root.innerHTML = `
    <div class="oc-dashboard-error">
      <div class="oc-dashboard-error-title">${escapeHtml(title || "仪表盘加载失败")}</div>
      ${detail ? `<pre class="oc-dashboard-error-detail">${escapeHtml(detail)}</pre>` : ""}
    </div>`;
}

function formatNow() {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${formatter.format(new Date())} · 实时刷新`;
}

function startClock(root) {
  const output = root.querySelector("[data-dashboard-now]");
  if (!(output instanceof HTMLElement)) {
    return 0;
  }
  const update = () => {
    output.textContent = formatNow();
  };
  update();
  return window.setInterval(update, 1000);
}

function hasVisiblePanels(manifest, slotKeys = []) {
  return slotKeys.some((slotKey) => manifest.blocks?.[slotKey]?.visible !== false);
}

function getStructureAreaItems(manifest, area, fallbackItems) {
  const items = manifest.structure?.areas?.[area];
  return Array.isArray(items) && manifest.structure?.mode === "component" ? items : fallbackItems;
}

function hasVisibleAreaPanels(manifest, area, fallbackItems) {
  return getStructureAreaItems(manifest, area, fallbackItems).some(
    (componentId) =>
      manifest.charts?.[componentId] && manifest.blocks?.[componentId]?.visible !== false,
  );
}

function buildSideColumnWidth(manifest, side, options = {}) {
  const maxPreferredWidth = options.cockpitClamp ? 280 : 420;
  const maxPreferredMinWidth = options.cockpitClamp ? 240 : 360;
  if (side === "left") {
    return `minmax(${Math.min(manifest.layout.leftColumnMin, maxPreferredMinWidth)}px, ${Math.min(manifest.layout.leftColumnMax, maxPreferredWidth)}px)`;
  }
  return `minmax(${Math.min(manifest.layout.rightColumnMin, maxPreferredMinWidth)}px, ${Math.min(manifest.layout.rightColumnMax, maxPreferredWidth)}px)`;
}

function buildMainColumns(manifest) {
  const hasLeft = hasVisibleAreaPanels(manifest, "left", ["leftTop", "leftBottom"]);
  const hasRight = hasVisibleAreaPanels(manifest, "right", ["rightTop", "rightBottom"]);
  const hasScene =
    manifest.structure?.mode === "component"
      ? getStructureAreaItems(manifest, "center", []).some(
          (componentId) => manifest.structure?.componentTypes?.[componentId] === "scene",
        )
      : manifest.blocks?.scene?.visible !== false;
  if (hasScene) {
    const cockpitClamp = hasLeft && hasRight;
    const segments = [];
    if (hasLeft) {
      segments.push(buildSideColumnWidth(manifest, "left", { cockpitClamp }));
    }
    segments.push("minmax(0, 1fr)");
    if (hasRight) {
      segments.push(buildSideColumnWidth(manifest, "right", { cockpitClamp }));
    }
    return segments.join(" ");
  }
  if (hasLeft && hasRight) {
    return "minmax(0, 1fr) minmax(0, 1fr)";
  }
  return "1fr";
}

function buildFooterColumns(manifest) {
  const visibleSections = getStructureAreaItems(manifest, "footer", ["timeline", "alerts"])
    .filter((key) => manifest.blocks?.[key]?.visible !== false)
    .sort(
      (left, right) =>
        (manifest.blocks?.[left]?.order || 0) - (manifest.blocks?.[right]?.order || 0),
    );
  if (visibleSections.length <= 1) {
    return "1fr";
  }
  return visibleSections.map((key) => `${manifest.blocks[key].weight}fr`).join(" ");
}

function applyTheme(root, manifest) {
  const variableTargets = [document.documentElement, root];
  const setVariable = (name, value) => {
    for (const target of variableTargets) {
      target.style.setProperty(name, value);
    }
  };
  setVariable("--oc-dashboard-background", manifest.theme.background);
  setVariable("--oc-dashboard-surface", manifest.theme.surface);
  setVariable("--oc-dashboard-surface-strong", manifest.theme.surfaceStrong);
  setVariable("--oc-dashboard-accent", manifest.theme.accent);
  setVariable("--oc-dashboard-accent-soft", manifest.theme.accentSoft);
  setVariable("--oc-dashboard-success", manifest.theme.success);
  setVariable("--oc-dashboard-warning", manifest.theme.warning);
  setVariable("--oc-dashboard-danger", manifest.theme.danger);
  setVariable("--oc-dashboard-text", manifest.theme.text);
  setVariable("--oc-dashboard-muted", manifest.theme.muted);
  setVariable("--oc-dashboard-grid", manifest.theme.grid);
  setVariable("--oc-dashboard-font-family", manifest.theme.fontFamily);
  setVariable("--oc-dashboard-title-font-family", manifest.theme.titleFontFamily);
  setVariable(
    "--oc-dashboard-title-letter-spacing",
    String(manifest.theme.titleLetterSpacing || "0.04em"),
  );
  setVariable(
    "--oc-dashboard-backdrop-opacity",
    `${Number(manifest.theme.backdropOpacity || 0.34)}`,
  );
  setVariable("--oc-dashboard-grid-opacity", `${Number(manifest.theme.gridOpacity || 0.8)}`);
  setVariable("--oc-dashboard-shell-gap", `${manifest.layout.shellGap}px`);
  setVariable("--oc-dashboard-shell-padding", manifest.layout.shellPadding);
  setVariable(
    "--oc-dashboard-metrics-columns",
    `repeat(${Math.max(1, Math.min(manifest.layout.metricsColumns, manifest.metrics.length || 1))}, minmax(0, 1fr))`,
  );
  setVariable("--oc-dashboard-main-gap", `${manifest.layout.mainGap}px`);
  setVariable("--oc-dashboard-main-columns", buildMainColumns(manifest));
  setVariable("--oc-dashboard-panel-gap", `${manifest.layout.panelGap}px`);
  setVariable("--oc-dashboard-footer-gap", `${manifest.layout.footerGap}px`);
  setVariable("--oc-dashboard-footer-columns", buildFooterColumns(manifest));
  setVariable("--oc-dashboard-panel-radius", `${manifest.layout.panelRadius}px`);
  setVariable("--oc-dashboard-metric-radius", `${manifest.layout.metricRadius}px`);
  setVariable("--oc-dashboard-scene-overlay-width", `${manifest.layout.sceneOverlayWidth}px`);
  setVariable("--oc-dashboard-scene-min-height", `${manifest.layout.sceneMinHeight}px`);

  const backdrop = root.querySelector(".oc-dashboard-backdrop");
  if (backdrop instanceof HTMLElement && manifest.backgroundImage) {
    backdrop.style.backgroundImage = `linear-gradient(180deg, rgba(4, 11, 22, 0.18), rgba(4, 11, 22, 0.82)), url("${manifest.backgroundImage}")`;
  } else if (backdrop instanceof HTMLElement) {
    backdrop.style.backgroundImage = "none";
  }
}

function bindNavigation(root) {
  const buttons = root.querySelectorAll("[data-nav-href]");
  for (const button of buttons) {
    if (!(button instanceof HTMLElement)) {
      continue;
    }
    button.addEventListener("click", () => {
      const href = String(button.dataset.navHref || "").trim();
      if (!href) {
        return;
      }
      window.top.location.href = href;
    });
  }
}

function buildFallbackItems(manifest) {
  return manifest.metrics.map((metric, index) => ({
    name: metric.label,
    value: metric.valueText,
    order: index + 1,
  }));
}

function renderRankingPanel(container, chart, manifest) {
  const items = (chart.items.length ? chart.items : buildFallbackItems(manifest)).slice(0, 6);
  container.innerHTML = `
    <ol class="oc-dashboard-ranking-list">
      ${items
        .map(
          (item, index) => `
            <li class="oc-dashboard-ranking-item">
              <span class="oc-dashboard-ranking-order">${index + 1}</span>
              <span class="oc-dashboard-ranking-name">${escapeHtml(item.name || item.label || `项目 ${index + 1}`)}</span>
              <span class="oc-dashboard-ranking-value">${escapeHtml(item.value ?? "")}</span>
            </li>`,
        )
        .join("")}
    </ol>`;
}

function renderTablePanel(container, chart, manifest) {
  const rows = chart.rows.length
    ? chart.rows
    : manifest.timeline.map((item) => ({
        time: item.time,
        label: item.label,
        value: item.value,
      }));
  const columns = chart.columns.length
    ? chart.columns
    : Object.keys(rows[0] || {})
        .slice(0, 3)
        .map((key) => ({ key, label: key }));
  container.innerHTML = `
    <table class="oc-dashboard-table">
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>${columns
                .map((column) => `<td>${escapeHtml(row?.[column.key] ?? "-")}</td>`)
                .join("")}</tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderStatPanel(container, chart, manifest) {
  const items = chart.items.length
    ? chart.items
    : manifest.metrics.map((metric) => ({
        name: metric.label,
        value: `${metric.valueText}${metric.unit || ""}`,
      }));
  container.innerHTML = `
    <div class="oc-dashboard-stat-grid">
      ${items
        .map(
          (item) => `
            <article class="oc-dashboard-stat-item">
              <div class="oc-dashboard-stat-name">${escapeHtml(item.name || item.label || "")}</div>
              <strong class="oc-dashboard-stat-value">${escapeHtml(item.value ?? "")}</strong>
            </article>`,
        )
        .join("")}
    </div>`;
}

function renderTextPanel(container, chart) {
  const content = chart.content || chart.subtitle || chart.footer || "";
  container.innerHTML = `
    <div class="oc-dashboard-text-block">
      ${escapeHtml(content).replace(/\n/g, "<br>")}
    </div>`;
}

function renderHtmlPanels(root, manifest) {
  const charts = Object.values(manifest.charts || {});
  for (const chart of charts) {
    if (!isHtmlPanelType(chart)) {
      continue;
    }
    const container = root.querySelector(`[data-html-slot="${chart.slotKey}"]`);
    if (!(container instanceof HTMLElement)) {
      continue;
    }
    const chartType = String(chart.type || "")
      .trim()
      .toLowerCase();
    if (chartType === "ranking" || chartType === "list") {
      renderRankingPanel(container, chart, manifest);
      continue;
    }
    if (chartType === "table") {
      renderTablePanel(container, chart, manifest);
      continue;
    }
    if (chartType === "text") {
      renderTextPanel(container, chart);
      continue;
    }
    renderStatPanel(container, chart, manifest);
  }
}

function createChartInstance(container, option) {
  globalThis.echarts.getInstanceByDom?.(container)?.dispose?.();
  const chart = globalThis.echarts.init(container, null, { renderer: "canvas" });
  try {
    chart.setOption(option, true);
    return chart;
  } catch (error) {
    try {
      chart.dispose();
    } catch {
      // Ignore cleanup failures after a bad option payload.
    }
    throw error;
  }
}

function renderEchartsPanels(root, manifest, chartInstances) {
  const charts = Object.values(manifest.charts || {});
  for (const chart of charts) {
    if (isHtmlPanelType(chart)) {
      continue;
    }
    const container = root.querySelector(`[data-chart-slot="${chart.slotKey}"]`);
    if (!(container instanceof HTMLElement)) {
      continue;
    }
    chartInstances.push(createChartInstance(container, buildPanelOption(chart, manifest)));
  }
}

function createSceneCompatibilityFallback(manifest) {
  const fallbackManifest = deepMerge(manifest, {
    scene: {
      type: "capital-reactor",
      option: null,
      subtitle: manifest.scene?.subtitle || "兼容模式场景",
    },
  });
  return [
    {
      mode: "requested",
      option: buildSceneOption(manifest),
    },
    {
      mode: "compatible-3d",
      option: buildSceneFallbackOption(fallbackManifest),
    },
    {
      mode: "compatible-2d",
      option: buildPanelOption(
        {
          slotKey: "scene-fallback",
          type: "radar",
          title: manifest.scene?.title || manifest.title,
          subtitle: "兼容模式场景",
          unit: "",
          categories: [],
          series: [],
          items: [],
          indicators: manifest.metrics.map((metric) => ({
            name: metric.label,
            max: Math.max(100, roundMetricFallbackMax(metric.numericValue)),
          })),
          values: manifest.metrics.map((metric, index) =>
            Math.max(30, Math.min(98, Math.round(metric.numericValue + index * 6))),
          ),
          rows: [],
          columns: [],
          option: null,
          linkHref: "",
          footer: "",
        },
        manifest,
      ),
    },
  ];
}

function roundMetricFallbackMax(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 100;
  }
  return Math.ceil(numeric / 10) * 10;
}

function renderSceneChart(root, manifest, chartInstances) {
  const sceneContainer = root.querySelector("[data-dashboard-scene]");
  if (!(sceneContainer instanceof HTMLElement)) {
    return "missing";
  }
  delete root.dataset.ocDashboardSceneFallback;
  let lastError = null;
  for (const candidate of createSceneCompatibilityFallback(manifest)) {
    try {
      chartInstances.push(createChartInstance(sceneContainer, candidate.option));
      if (candidate.mode !== "requested") {
        root.dataset.ocDashboardSceneFallback = candidate.mode;
        console.warn(
          "[dashboard-manifest] scene fallback activated",
          candidate.mode,
          lastError instanceof Error ? lastError.message : lastError,
        );
      }
      return candidate.mode;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("dashboard_scene_render_failed");
}

function createResizeObserver(root, chartInstances) {
  if (typeof ResizeObserver !== "function" || !chartInstances.length) {
    return null;
  }
  const resize = () => {
    for (const instance of chartInstances) {
      instance?.resize?.();
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  return observer;
}

async function bootParticles(root, manifest) {
  if (!manifest.particles?.enabled) {
    return;
  }
  const container = root.querySelector("#oc-dashboard-particles");
  const engine = globalThis.tsParticles || globalThis.tsparticles;
  if (!(container instanceof HTMLElement) || !engine?.load) {
    return;
  }
  const options = {
    background: { color: { value: "transparent" } },
    fullScreen: { enable: false },
    fpsLimit: 60,
    particles: {
      color: { value: manifest.particles.color || manifest.theme.accent },
      links: {
        color: manifest.theme.grid,
        distance: 120,
        enable: true,
        opacity: 0.18,
        width: 1,
      },
      move: {
        direction: "none",
        enable: true,
        outModes: { default: "bounce" },
        speed: 0.5,
      },
      number: {
        density: { enable: true, area: 900 },
        value: Number(manifest.particles.number || 40),
      },
      opacity: { value: { min: 0.1, max: 0.45 } },
      size: { value: { min: 1, max: 3 } },
    },
    detectRetina: true,
  };
  try {
    await engine.load("oc-dashboard-particles", options);
  } catch {
    // Ignore particle boot failures so the dashboard remains usable.
  }
}

function animateDashboard(root) {
  const gsap = globalThis.gsap;
  const manifest = root?.[DASHBOARD_RUNTIME_STATE_KEY]?.manifest;
  if (!gsap?.from || !manifest || manifest.motion?.level === "off") {
    return;
  }
  gsap.from(
    root.querySelectorAll(
      ".oc-dashboard-metric, .oc-dashboard-panel, .oc-dashboard-footer-section",
    ),
    {
      opacity: 0,
      y: 22,
      duration: manifest.motion.revealDuration,
      ease: "power2.out",
      stagger: manifest.motion.stagger,
    },
  );
  const rings = root.querySelectorAll(".oc-dashboard-scene-ring");
  if (rings.length >= 1) {
    gsap.to(rings[0], {
      rotate: 360,
      duration: 22 * manifest.motion.ringDurationMultiplier,
      ease: "none",
      repeat: -1,
    });
  }
  if (rings.length >= 2) {
    gsap.to(rings[1], {
      rotate: -360,
      duration: 28 * manifest.motion.ringDurationMultiplier,
      ease: "none",
      repeat: -1,
    });
  }
  if (rings.length >= 3 && manifest.motion.ringPulseEnabled) {
    gsap.to(rings[2], {
      scale: 1.08,
      duration: 2.6 * Math.max(0.5, manifest.motion.ringDurationMultiplier),
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
  }
}

function resolveDashboardDataSourceHref(dataSource) {
  if (typeof dataSource === "string") {
    return dataSource.trim();
  }
  if (!isPlainObject(dataSource)) {
    return "";
  }
  if (
    String(dataSource.type || "")
      .trim()
      .toLowerCase() === "embedded"
  ) {
    return "";
  }
  return String(
    dataSource.url || dataSource.href || dataSource.src || dataSource.path || "",
  ).trim();
}

function readBoundValue(source, fieldPath) {
  const normalizedPath = String(fieldPath || "").trim();
  if (!normalizedPath) {
    return undefined;
  }
  const segments = normalizedPath.split(".").filter(Boolean);
  let current = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function formatDashboardNumber(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return numeric.toFixed(digits).replace(/(?:\.0+|(\.\d*?[1-9])0+)$/, "$1");
}

function normalizeMetricDisplayValue(metric, rawValue) {
  const format = String(metric?.format || "")
    .trim()
    .toLowerCase();
  const fallbackUnit = String(metric?.suffix || metric?.unit || "").trim();
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return {
      valueText: String(rawValue ?? "").trim(),
      numericValue: Number.NaN,
      unit: fallbackUnit,
    };
  }
  if (format === "currencywan") {
    return {
      valueText: formatDashboardNumber(numeric / 10000, 2),
      numericValue: numeric / 10000,
      unit: fallbackUnit || "万元",
    };
  }
  if (format === "currencyyi") {
    return {
      valueText: formatDashboardNumber(numeric / 100000000, 2),
      numericValue: numeric / 100000000,
      unit: fallbackUnit || "亿元",
    };
  }
  if (format === "percent") {
    return {
      valueText: formatDashboardNumber(numeric, 2),
      numericValue: numeric,
      unit: fallbackUnit || "%",
    };
  }
  return {
    valueText: formatDashboardNumber(numeric, 2),
    numericValue: numeric,
    unit: fallbackUnit,
  };
}

function normalizeCategoryLabel(value) {
  const text = String(value ?? "").trim();
  if (/^\d{6}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
  }
  return text;
}

function materializeMetricDefinition(metric, payload, index) {
  if (!isPlainObject(metric)) {
    return metric;
  }
  const rawValue = metric.field
    ? readBoundValue(payload, metric.field)
    : (metric.value ?? metric.number);
  if (rawValue === undefined) {
    return metric;
  }
  const resolved = normalizeMetricDisplayValue(metric, rawValue);
  return {
    ...metric,
    id: String(metric.id || `metric-${index + 1}`).trim() || `metric-${index + 1}`,
    value: resolved.valueText,
    valueText: resolved.valueText,
    numericValue: resolved.numericValue,
    unit: resolved.unit,
    note:
      String(
        metric.note || (metric.noteField ? readBoundValue(payload, metric.noteField) : "") || "",
      ).trim() || "",
    delta:
      String(
        metric.delta || (metric.deltaField ? readBoundValue(payload, metric.deltaField) : "") || "",
      ).trim() || "",
    trend:
      String(
        metric.trend || (metric.trendField ? readBoundValue(payload, metric.trendField) : "") || "",
      ).trim() || "",
  };
}

function materializeDatasetItems(dataset, chart) {
  if (!Array.isArray(dataset)) {
    return [];
  }
  const nameField = String(chart?.nameField || "name").trim() || "name";
  const valueField = String(chart?.valueField || "value").trim() || "value";
  return dataset.map((item, index) => ({
    name:
      String(isPlainObject(item) ? item[nameField] : `项 ${index + 1}`).trim() || `项 ${index + 1}`,
    value: Number(isPlainObject(item) ? item[valueField] : item) || 0,
  }));
}

function materializeTrendSeries(dataset, chart) {
  if (!Array.isArray(dataset)) {
    return [];
  }
  const configuredSeries = Array.isArray(chart?.series) ? chart.series : [];
  if (configuredSeries.length) {
    return configuredSeries.map((series, index) => {
      const field = String(series?.field || series?.key || "").trim();
      return {
        ...series,
        name: String(series?.name || field || `系列 ${index + 1}`).trim() || `系列 ${index + 1}`,
        type: String(series?.type || chart?.type || "line").trim(),
        data: dataset.map((item) => {
          if (!field || !isPlainObject(item)) {
            return 0;
          }
          const value = Number(item[field]);
          return Number.isFinite(value) ? value : 0;
        }),
      };
    });
  }
  const valueField = String(chart?.valueField || "value").trim() || "value";
  return [
    {
      name: String(chart?.title || "趋势").trim() || "趋势",
      type: String(chart?.type || "line").trim() || "line",
      data: dataset.map((item) => {
        if (!isPlainObject(item)) {
          const numeric = Number(item);
          return Number.isFinite(numeric) ? numeric : 0;
        }
        const numeric = Number(item[valueField]);
        return Number.isFinite(numeric) ? numeric : 0;
      }),
    },
  ];
}

function materializeChartDefinition(chart, payload) {
  if (!isPlainObject(chart)) {
    return chart;
  }
  const dataset = chart.datasetField ? readBoundValue(payload, chart.datasetField) : undefined;
  if (!dataset) {
    return chart;
  }
  const chartType = String(chart.type || "")
    .trim()
    .toLowerCase();
  if (["pie", "ranking", "stat", "list"].includes(chartType)) {
    return {
      ...chart,
      items: materializeDatasetItems(dataset, chart),
    };
  }
  if (chartType === "table" && Array.isArray(dataset)) {
    return {
      ...chart,
      rows: dataset,
    };
  }
  if (["line", "bar"].includes(chartType) && Array.isArray(dataset)) {
    const categoryField = String(chart.categoryField || "category").trim() || "category";
    return {
      ...chart,
      categories: dataset.map((item, index) =>
        normalizeCategoryLabel(isPlainObject(item) ? item[categoryField] : `阶段 ${index + 1}`),
      ),
      series: materializeTrendSeries(dataset, chart),
    };
  }
  return chart;
}

function manifestUsesStructuredBindings(manifest) {
  if (!isPlainObject(manifest)) {
    return false;
  }
  const hasMetricBindings = Array.isArray(manifest.metrics)
    ? manifest.metrics.some((metric) => isPlainObject(metric) && metric.field)
    : false;
  const chartEntries = isPlainObject(manifest.charts) ? Object.values(manifest.charts) : [];
  const hasChartBindings = chartEntries.some(
    (chart) =>
      isPlainObject(chart) &&
      (chart.datasetField ||
        chart.nameField ||
        chart.valueField ||
        chart.categoryField ||
        (Array.isArray(chart.series) &&
          chart.series.some((series) => isPlainObject(series) && series.field))),
  );
  return hasMetricBindings || hasChartBindings;
}

function materializeDashboardManifest(rawManifest, payload) {
  if (!isPlainObject(rawManifest) || !isPlainObject(payload)) {
    return rawManifest;
  }
  const nextManifest = { ...rawManifest };
  if (Array.isArray(rawManifest.metrics)) {
    nextManifest.metrics = rawManifest.metrics.map((metric, index) =>
      materializeMetricDefinition(metric, payload, index),
    );
  }
  if (isPlainObject(rawManifest.charts)) {
    nextManifest.charts = Object.fromEntries(
      Object.entries(rawManifest.charts).map(([key, chart]) => [
        key,
        materializeChartDefinition(chart, payload),
      ]),
    );
  }
  if (!Array.isArray(rawManifest.timeline) && Array.isArray(payload.timeline)) {
    nextManifest.timeline = payload.timeline;
  }
  if (!Array.isArray(rawManifest.alerts) && Array.isArray(payload.alerts)) {
    nextManifest.alerts = payload.alerts;
  }
  return nextManifest;
}

async function resolveDashboardManifest(rawManifest, context) {
  let manifest = rawManifest;
  const warnings = [];
  const dataSourceHref = resolveDashboardDataSourceHref(rawManifest?.dataSource);
  if (!dataSourceHref) {
    return { manifest, warnings };
  }
  const resolvedDataSourceHref = resolveDashboardAssetHref(
    context.workspaceBaseHref,
    dataSourceHref,
  );
  const dataSourceUrl = resolveDashboardRuntimeUrl(resolvedDataSourceHref, [
    String(context.visualizationHref || "").trim(),
    String(context.workspaceBaseHref || "").trim(),
  ]);
  try {
    const response = await fetch(dataSourceUrl, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      manifest = manifestUsesStructuredBindings(manifest)
        ? materializeDashboardManifest(manifest, payload)
        : deepMerge(manifest, payload);
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `dataSource ${dataSourceHref} 加载失败: ${error.message}`
        : `dataSource ${dataSourceHref} 加载失败`,
    );
  }
  return { manifest, warnings };
}

export async function renderDashboardManifest({ root, manifest: rawManifest, context = {} }) {
  if (!(root instanceof HTMLElement)) {
    throw new Error("dashboard_root_missing");
  }
  disposeDashboardRuntime(root);
  const { manifest: mergedManifest, warnings } = await resolveDashboardManifest(
    rawManifest,
    context,
  );
  const normalized = normalizeDashboardManifest(mergedManifest, context);
  if (warnings.length) {
    normalized.alerts = [
      ...warnings.map((message) => ({ level: "medium", title: "数据源加载告警", value: message })),
      ...normalized.alerts,
    ].slice(0, 6);
  }

  root.innerHTML = buildDashboardMarkup(normalized, context);
  applyTheme(root, normalized);
  bindNavigation(root);
  renderHtmlPanels(root, normalized);

  const clockTimer = startClock(root);
  root[DASHBOARD_RUNTIME_STATE_KEY] = {
    chartInstances: [],
    resizeObserver: null,
    clockTimer,
    manifest: normalized,
  };
  try {
    await ensureVendorLibraries(normalized, context);
    const chartInstances = [];
    renderSceneChart(root, normalized, chartInstances);
    renderEchartsPanels(root, normalized, chartInstances);
    const resizeObserver = createResizeObserver(root, chartInstances);
    await bootParticles(root, normalized);
    animateDashboard(root);
    root[DASHBOARD_RUNTIME_STATE_KEY] = {
      chartInstances,
      resizeObserver,
      clockTimer,
      manifest: normalized,
    };
    return normalized;
  } catch (error) {
    if (clockTimer) {
      window.clearInterval(clockTimer);
    }
    renderDashboardError(
      root,
      "仪表盘运行时加载失败",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

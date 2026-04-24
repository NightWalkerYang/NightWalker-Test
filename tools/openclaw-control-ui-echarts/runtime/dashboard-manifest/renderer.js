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
      <div class="oc-dashboard-error-title">${String(title || "仪表盘加载失败")}</div>
      ${detail ? `<pre class="oc-dashboard-error-detail">${String(detail)}</pre>` : ""}
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

function applyTheme(root, manifest) {
  root.style.setProperty("--oc-dashboard-background", manifest.theme.background);
  root.style.setProperty("--oc-dashboard-surface", manifest.theme.surface);
  root.style.setProperty("--oc-dashboard-surface-strong", manifest.theme.surfaceStrong);
  root.style.setProperty("--oc-dashboard-accent", manifest.theme.accent);
  root.style.setProperty("--oc-dashboard-accent-soft", manifest.theme.accentSoft);
  root.style.setProperty("--oc-dashboard-success", manifest.theme.success);
  root.style.setProperty("--oc-dashboard-warning", manifest.theme.warning);
  root.style.setProperty("--oc-dashboard-danger", manifest.theme.danger);
  root.style.setProperty("--oc-dashboard-text", manifest.theme.text);
  root.style.setProperty("--oc-dashboard-muted", manifest.theme.muted);
  root.style.setProperty("--oc-dashboard-grid", manifest.theme.grid);

  const backdrop = root.querySelector(".oc-dashboard-backdrop");
  if (backdrop instanceof HTMLElement && manifest.backgroundImage) {
    backdrop.style.backgroundImage = `linear-gradient(180deg, rgba(4, 11, 22, 0.18), rgba(4, 11, 22, 0.82)), url("${manifest.backgroundImage}")`;
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
              <span class="oc-dashboard-ranking-name">${String(item.name || item.label || `项目 ${index + 1}`)}</span>
              <span class="oc-dashboard-ranking-value">${String(item.value ?? "")}</span>
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
        <tr>${columns.map((column) => `<th>${String(column.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>${columns
                .map((column) => `<td>${String(row?.[column.key] ?? "-")}</td>`)
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
              <div class="oc-dashboard-stat-name">${String(item.name || item.label || "")}</div>
              <strong class="oc-dashboard-stat-value">${String(item.value ?? "")}</strong>
            </article>`,
        )
        .join("")}
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
  if (!gsap?.from) {
    return;
  }
  gsap.from(
    root.querySelectorAll(
      ".oc-dashboard-metric, .oc-dashboard-panel, .oc-dashboard-footer-section",
    ),
    {
      opacity: 0,
      y: 22,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.05,
    },
  );
  const rings = root.querySelectorAll(".oc-dashboard-scene-ring");
  if (rings.length >= 1) {
    gsap.to(rings[0], { rotate: 360, duration: 22, ease: "none", repeat: -1 });
  }
  if (rings.length >= 2) {
    gsap.to(rings[1], { rotate: -360, duration: 28, ease: "none", repeat: -1 });
  }
  if (rings.length >= 3) {
    gsap.to(rings[2], { scale: 1.08, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }
}

async function resolveDashboardManifest(rawManifest, context) {
  let manifest = rawManifest;
  const warnings = [];
  const dataSource = rawManifest?.dataSource;
  if (isPlainObject(dataSource)) {
    return { manifest, warnings };
  }
  const dataSourceHref = String(dataSource || "").trim();
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
      manifest = deepMerge(manifest, payload);
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

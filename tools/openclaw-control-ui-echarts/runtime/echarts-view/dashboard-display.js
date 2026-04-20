import { getDashboard, getPublicDashboard, queryKingdeeData, shareDashboard } from "./api.js";

const ECHARTS_VIEW_BASE = "/echarts-view";

export async function renderDashboardDisplay(root, { dashboardId, publicToken, onNavigate }) {
  root.innerHTML = `<div class="oc-dv-display-loading">加载大屏…</div>`;

  let dashboard, charts;
  try {
    if (publicToken) {
      const data = await getPublicDashboard(publicToken);
      dashboard = data.dashboard;
      charts = data.charts || [];
    } else {
      const data = await getDashboard(dashboardId);
      dashboard = data;
      charts = data.charts || [];
    }
  } catch {
    root.innerHTML = `<div class="oc-dv-error">大屏不存在或无权限访问</div>`;
    return;
  }

  const theme = dashboard.theme || "dark";
  root.setAttribute("data-oc-dv-theme", theme);

  root.innerHTML = `
    <div class="oc-dv-display" data-theme="${theme}">
      <div class="oc-dv-display__header">
        <h1 class="oc-dv-display__title">${escapeHtml(dashboard.title)}</h1>
        <div class="oc-dv-display__meta">
          ${publicToken ? "" : `<button class="oc-dv-btn oc-dv-btn--ghost" id="oc-dv-back-edit">← 编辑</button>`}
          ${publicToken ? "" : `<button class="oc-dv-btn oc-dv-btn--ghost" id="oc-dv-share-link">🔗 获取分享链接</button>`}
          <button class="oc-dv-btn oc-dv-btn--ghost" id="oc-dv-fullscreen">⛶ 全屏</button>
          <span class="oc-dv-display__refresh-label" id="oc-dv-refresh-label"></span>
        </div>
      </div>
      <div class="oc-dv-display__grid" id="oc-dv-display-grid">
        ${charts.length === 0 ? '<div class="oc-dv-display-empty">此大屏暂无图表</div>' : charts.map(renderDisplayChartSlot).join("")}
      </div>
    </div>
  `;

  if (!publicToken) {
    root.querySelector("#oc-dv-back-edit")?.addEventListener("click", () => {
      onNavigate(`${ECHARTS_VIEW_BASE}/dashboard/${dashboardId}/edit`);
    });

    root.querySelector("#oc-dv-share-link")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "生成中…";
      try {
        const result = await shareDashboard(dashboardId, true);
        const token = result.publicToken || dashboard.publicToken;
        if (token) {
          const shareUrl = `${window.location.origin}/echarts-view/public/${token}`;
          try {
            await navigator.clipboard.writeText(shareUrl);
            btn.textContent = "✓ 链接已复制";
          } catch {
            prompt("公开分享链接（复制后可发给任何人访问）:", shareUrl);
            btn.textContent = "🔗 获取分享链接";
          }
        } else {
          btn.textContent = "🔗 获取分享链接";
        }
      } catch {
        btn.textContent = "🔗 获取分享链接";
        alert("生成分享链接失败");
      } finally {
        btn.disabled = false;
        setTimeout(() => {
          if (btn.isConnected) btn.textContent = "🔗 获取分享链接";
        }, 3000);
      }
    });
  }

  root.querySelector("#oc-dv-fullscreen")?.addEventListener("click", () => {
    const el = root.querySelector(".oc-dv-display");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el?.requestFullscreen().catch(() => {});
    }
  });

  // 渲染图表
  await renderAllCharts(root, charts);

  // 自动刷新
  const refreshSeconds = Number(dashboard.refreshIntervalSeconds || 0);
  if (refreshSeconds > 0) {
    const label = root.querySelector("#oc-dv-refresh-label");
    let countdown = refreshSeconds;

    const tick = () => {
      countdown -= 1;
      if (label) {
        label.textContent = `${countdown}s 后刷新`;
      }
      if (countdown <= 0) {
        countdown = refreshSeconds;
        refreshCharts(root, charts, dashboard).catch(() => {});
      }
    };

    const timerId = setInterval(tick, 1000);
    if (label) {
      label.textContent = `${countdown}s 后刷新`;
    }

    const observer = new MutationObserver(() => {
      if (!root.isConnected) {
        clearInterval(timerId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function renderDisplayChartSlot(chart) {
  const pos = chart.position || { x: 0, y: 0, w: 6, h: 4 };
  return `
    <div class="oc-dv-display__chart-slot"
         data-chart-id="${chart.id}"
         style="grid-column: span ${Math.min(pos.w, 12)}; grid-row: span ${pos.h}">
      <div class="oc-dv-display__chart-title">${escapeHtml(chart.title)}</div>
      <div class="oc-dv-display__chart-canvas" id="display-canvas-${chart.id}"></div>
    </div>
  `;
}

async function renderAllCharts(root, charts) {
  if (!window.echarts && !await tryLoadEcharts()) {
    return;
  }
  for (const chart of charts) {
    renderSingleChart(root, chart);
  }
}

async function refreshCharts(root, charts, dashboard) {
  for (const chart of charts) {
    if (!chart.dataQuery?.reportId) {
      continue;
    }
    try {
      const result = await queryKingdeeData(chart.dataQuery);
      updateChartOption(root, chart.id, result.echartsOption);
    } catch {
      // silently ignore refresh errors for individual charts
    }
  }
}

function renderSingleChart(root, chart) {
  const container = root.querySelector(`#display-canvas-${chart.id}`);
  if (!container || !window.echarts) {
    return;
  }
  try {
    const existing = window.echarts.getInstanceByDom(container);
    if (existing) {
      existing.dispose();
    }
    const instance = window.echarts.init(container, null, { renderer: "canvas" });
    instance.setOption(chart.echartsOption || {});

    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container);
  } catch {
    // ignore render errors
  }
}

function updateChartOption(root, chartId, option) {
  const container = root.querySelector(`#display-canvas-${chartId}`);
  if (!container || !window.echarts) {
    return;
  }
  const instance = window.echarts.getInstanceByDom(container);
  if (instance) {
    instance.setOption(option, { notMerge: true });
  }
}

async function tryLoadEcharts() {
  if (window.echarts) {
    return true;
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = new URL("../echarts/libraries.js", import.meta.url).href;
    script.onload = () => resolve(Boolean(window.echarts));
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

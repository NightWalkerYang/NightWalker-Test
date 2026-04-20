import {
  getDashboard,
  updateDashboard,
  createDashboardChart,
  updateDashboardChart,
  deleteDashboardChart,
  queryKingdeeData,
} from "./api.js";
import { sendPromptToChat } from "../framework/chat-composer.js";

const ECHARTS_VIEW_BASE = "/echarts-view";

let _echarts = null;
async function loadEcharts() {
  if (_echarts) {
    return _echarts;
  }
  if (window.echarts) {
    _echarts = window.echarts;
    return _echarts;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("../echarts/libraries.js", import.meta.url).href;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  _echarts = window.echarts;
  return _echarts;
}

export async function renderDashboardEditor(root, { dashboardId, onNavigate }) {
  root.innerHTML = `<div class="oc-dv-list-loading">加载大屏…</div>`;

  let dashboard;
  try {
    dashboard = await getDashboard(dashboardId);
  } catch {
    root.innerHTML = `<div class="oc-dv-error">大屏不存在或无权限</div>`;
    return;
  }

  const charts = dashboard.charts || [];

  root.innerHTML = `
    <div class="oc-dv-editor">
      <div class="oc-dv-editor__topbar">
        <button class="oc-dv-btn" id="oc-dv-back">← 返回列表</button>
        <input class="oc-dv-editor__title-input" id="oc-dv-title" value="${escapeAttr(dashboard.title)}" />
        <div class="oc-dv-editor__actions">
          <button class="oc-dv-btn" id="oc-dv-save-title">保存</button>
          <button class="oc-dv-btn oc-dv-btn--primary" id="oc-dv-display">全屏展示</button>
        </div>
      </div>
      <div class="oc-dv-editor__body">
        <div class="oc-dv-editor__canvas" id="oc-dv-canvas">
          ${charts.length === 0 ? renderCanvasEmpty() : charts.map(renderChartCard).join("")}
        </div>
        <aside class="oc-dv-editor__sidebar">
          <div class="oc-dv-sidebar-section">
            <h3 class="oc-dv-sidebar-section__title">AI 对话生成图表</h3>
            <p class="oc-dv-sidebar-section__hint">描述你需要的图表，AI 将生成 ECharts 配置</p>
            <textarea class="oc-dv-sidebar__prompt" id="oc-dv-prompt" rows="4"
              placeholder="例如：生成本月应收账款按客户分布的饼图"></textarea>
            <div class="oc-dv-sidebar__prompt-actions">
              <select class="oc-dv-form-select" id="oc-dv-report-type">
                <option value="">不绑定金蝶数据</option>
                <option value="profitLoss">利润表</option>
                <option value="balanceSheet">资产负债表</option>
                <option value="accountsReceivable">应收账款</option>
                <option value="accountsPayable">应付账款</option>
                <option value="cashFlow">现金流量</option>
              </select>
              <button class="oc-dv-btn oc-dv-btn--primary" id="oc-dv-generate">生成图表</button>
            </div>
            <div class="oc-dv-sidebar__status" id="oc-dv-gen-status"></div>
          </div>
          <div class="oc-dv-sidebar-section">
            <h3 class="oc-dv-sidebar-section__title">添加金蝶数据图表</h3>
            <select class="oc-dv-form-select" id="oc-dv-kingdee-report">
              <option value="">选择报表类型</option>
              <option value="profitLoss">利润表</option>
              <option value="balanceSheet">资产负债表</option>
              <option value="accountsReceivable">应收账款账龄</option>
              <option value="accountsPayable">应付账款账龄</option>
              <option value="cashFlow">现金流量</option>
            </select>
            <select class="oc-dv-form-select" id="oc-dv-chart-type" style="margin-top:8px">
              <option value="auto">自动选择图表类型</option>
              <option value="bar">柱状图</option>
              <option value="line">折线图</option>
              <option value="pie">饼图</option>
            </select>
            <button class="oc-dv-btn" id="oc-dv-add-kingdee" style="margin-top:8px;width:100%">从金蝶拉取并添加</button>
          </div>
          <div class="oc-dv-sidebar-section">
            <h3 class="oc-dv-sidebar-section__title">大屏设置</h3>
            <label class="oc-dv-form-label">
              主题
              <select class="oc-dv-form-select" id="oc-dv-theme">
                <option value="dark" ${dashboard.theme === "dark" ? "selected" : ""}>深色</option>
                <option value="light" ${dashboard.theme === "light" ? "selected" : ""}>浅色</option>
              </select>
            </label>
            <label class="oc-dv-form-label" style="margin-top:8px">
              刷新间隔（秒）
              <input class="oc-dv-form-input" type="number" id="oc-dv-refresh" min="0" value="${dashboard.refreshIntervalSeconds || 300}" />
            </label>
            <button class="oc-dv-btn" id="oc-dv-save-settings" style="margin-top:8px">保存设置</button>
          </div>
        </aside>
      </div>
    </div>
  `;

  // 事件：返回列表
  root.querySelector("#oc-dv-back")?.addEventListener("click", () => {
    onNavigate(ECHARTS_VIEW_BASE);
  });

  // 事件：全屏展示
  root.querySelector("#oc-dv-display")?.addEventListener("click", () => {
    onNavigate(`${ECHARTS_VIEW_BASE}/dashboard/${dashboardId}/display`);
  });

  // 事件：保存标题
  root.querySelector("#oc-dv-save-title")?.addEventListener("click", async () => {
    const title = root.querySelector("#oc-dv-title")?.value?.trim();
    if (!title) {
      return;
    }
    try {
      await updateDashboard(dashboardId, { title });
      showStatus(root, "已保存");
    } catch (error) {
      showStatus(root, `保存失败: ${error.message}`, true);
    }
  });

  // 事件：保存设置
  root.querySelector("#oc-dv-save-settings")?.addEventListener("click", async () => {
    const theme = root.querySelector("#oc-dv-theme")?.value;
    const refreshIntervalSeconds = Number(root.querySelector("#oc-dv-refresh")?.value || 300);
    try {
      await updateDashboard(dashboardId, { theme, refreshIntervalSeconds });
      showStatus(root, "设置已保存");
    } catch (error) {
      showStatus(root, `保存失败: ${error.message}`, true);
    }
  });

  // 事件：从金蝶拉取数据
  root.querySelector("#oc-dv-add-kingdee")?.addEventListener("click", async () => {
    const reportId = root.querySelector("#oc-dv-kingdee-report")?.value;
    const chartType = root.querySelector("#oc-dv-chart-type")?.value || "auto";
    if (!reportId) {
      alert("请先选择报表类型");
      return;
    }
    const btn = root.querySelector("#oc-dv-add-kingdee");
    btn.disabled = true;
    btn.textContent = "拉取中…";
    try {
      const result = await queryKingdeeData({ reportId, chartType });
      const chart = await createDashboardChart(dashboardId, {
        title: reportId,
        chartType,
        echartsOption: result.echartsOption,
        dataQuery: { reportId, chartType },
      });
      appendChartCard(root, chart);
      await renderChartInstance(root, chart);
    } catch (error) {
      alert(`拉取失败: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "从金蝶拉取并添加";
    }
  });

  // 事件：AI 生成图表（通过 chat-composer sendPromptToChat）
  root.querySelector("#oc-dv-generate")?.addEventListener("click", async () => {
    const prompt = root.querySelector("#oc-dv-prompt")?.value?.trim();
    const reportId = root.querySelector("#oc-dv-report-type")?.value;
    if (!prompt) {
      return;
    }

    const statusEl = root.querySelector("#oc-dv-gen-status");
    if (statusEl) {
      statusEl.textContent = "正在发送到 AI…";
    }

    const systemPrompt = reportId
      ? `用户需要一个金蝶${reportId}数据的 ECharts 图表。请根据以下描述生成 ECharts option JSON（用 \`\`\`echarts 代码块包裹）：`
      : "请根据以下描述生成 ECharts option JSON（用 ```echarts 代码块包裹）：";

    try {
      await sendPromptToChat(`${systemPrompt}\n\n${prompt}`);
      if (statusEl) {
        statusEl.textContent = "已发送，请在对话中查看 AI 回复，图表将自动渲染";
      }
    } catch {
      if (statusEl) {
        statusEl.textContent = "发送失败，请手动在对话中输入";
      }
    }
  });

  // 事件：画布操作（删除图表）
  root.querySelector("#oc-dv-canvas")?.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".oc-dv-chart-card__delete");
    if (!deleteBtn) {
      return;
    }
    const card = deleteBtn.closest("[data-chart-id]");
    const chartId = card?.dataset.chartId;
    if (!chartId || !confirm("删除此图表？")) {
      return;
    }
    try {
      await deleteDashboardChart(dashboardId, chartId);
      card.remove();
    } catch (error) {
      alert(`删除失败: ${error.message}`);
    }
  });

  // 渲染已有图表
  await loadEcharts();
  for (const chart of charts) {
    await renderChartInstance(root, chart).catch(() => {});
  }
}

function renderChartCard(chart) {
  return `
    <div class="oc-dv-chart-card" data-chart-id="${chart.id}">
      <div class="oc-dv-chart-card__header">
        <span class="oc-dv-chart-card__title">${escapeHtml(chart.title)}</span>
        <button class="oc-dv-chart-card__delete" title="删除">×</button>
      </div>
      <div class="oc-dv-chart-card__canvas" id="chart-canvas-${chart.id}"></div>
    </div>
  `;
}

function renderCanvasEmpty() {
  return `<div class="oc-dv-canvas-empty">画布为空 — 从右侧生成图表或从金蝶拉取数据</div>`;
}

function appendChartCard(root, chart) {
  const canvas = root.querySelector("#oc-dv-canvas");
  if (!canvas) {
    return;
  }
  const empty = canvas.querySelector(".oc-dv-canvas-empty");
  if (empty) {
    empty.remove();
  }
  const div = document.createElement("div");
  div.innerHTML = renderChartCard(chart);
  canvas.append(div.firstElementChild);
}

async function renderChartInstance(root, chart) {
  if (!window.echarts) {
    return;
  }
  const container = root.querySelector(`#chart-canvas-${chart.id}`);
  if (!container) {
    return;
  }
  try {
    const option = chart.echartsOption || {};
    const instance = window.echarts.init(container);
    instance.setOption(option);
  } catch {
    // ignore render errors for individual charts
  }
}

function showStatus(root, msg, isError = false) {
  const existingToast = document.querySelector(".oc-dv-toast");
  if (existingToast) {
    existingToast.remove();
  }
  const toast = document.createElement("div");
  toast.className = `oc-dv-toast${isError ? " oc-dv-toast--error" : ""}`;
  toast.textContent = msg;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2500);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}

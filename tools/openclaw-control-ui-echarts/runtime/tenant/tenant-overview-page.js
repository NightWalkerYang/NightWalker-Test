import { createLibraryLoader } from "../echarts/libraries.js";
import { getEchartsStyles } from "../echarts/styles.js";

function formatNumber(value) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "0";
  return new Intl.NumberFormat().format(numeric);
}

function resolveAgentDisplayName(agent) {
  return (
    agent?.name ||
    agent?.agentName ||
    agent?.agent_name ||
    agent?.description ||
    agent?.agentId ||
    agent?.agent_id ||
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

export async function refreshTenantOverview(root, controller) {
  try {
    controller.overviewError = null;
    controller.overviewStatus = { libs: 'pending', charts: 'pending' };
    const result = await controller.apiClient.getTenantOverview();
    controller.overviewData = result || null;
  } catch (error) {
    console.error("Failed to refresh tenant overview:", error);
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
  
  const status = controller.overviewStatus || {};
  const statusHtml = `
    <div class="oc-tenant-overview-status" style="display:flex;gap:10px;margin-bottom:10px;font-size:11px;color:#64748b;align-items:center;">
      <span style="padding:2px 6px;border-radius:4px;background:${status.libs === 'ok' ? '#dcfce7' : status.libs === 'error' ? '#fee2e2' : '#f1f5f9'};color:${status.libs === 'ok' ? '#166534' : status.libs === 'error' ? '#991b1b' : '#475569'}">库加载: ${status.libs || '待处理'}</span>
      <span style="padding:2px 6px;border-radius:4px;background:${status.charts === 'ok' ? '#dcfce7' : status.charts === 'error' ? '#fee2e2' : '#f1f5f9'};color:${status.charts === 'ok' ? '#166534' : status.charts === 'error' ? '#991b1b' : '#475569'}">图表初始化: ${status.charts || '待处理'}</span>
      ${status.error ? `<span style="color:#ef4444;font-weight:600;">错误: ${escapeHtml(status.error)}</span>` : ''}
    </div>
  `;
  
  return `
    <div class="oc-tenant-overview oc-block-renderer--echarts">
      ${statusHtml}
      <div class="oc-tenant-overview-grid">
        <div class="oc-tenant-card oc-tenant-metric-card">
          <div class="oc-tenant-metric-label">总消耗 Token</div>
          <div class="oc-tenant-metric-value">${formatNumber(summary.totalTokens)}</div>
          <div class="oc-tenant-metric-sub">输入: ${formatNumber(summary.inputTokens)} / 输出: ${formatNumber(summary.outputTokens)}</div>
        </div>
        <div class="oc-tenant-card oc-tenant-metric-card">
          <div class="oc-tenant-metric-label">已用积分</div>
          <div class="oc-tenant-metric-value">${formatNumber(summary.walletBalance)}</div>
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

export async function initTenantOverviewCharts(root, controller) {
  const data = controller.overviewData;
  if (!data) return;

  if (!controller.overviewStatus) {
    controller.overviewStatus = { libs: 'pending', charts: 'pending' };
  }

  const vendorBaseUrl = window.__ocVendorBaseUrl || new URL("../../vendor/", import.meta.url);
  const loadLibraries = createLibraryLoader(vendorBaseUrl);
  
  let echarts;
  try {
    const libs = await loadLibraries();
    echarts = libs.echarts;
    controller.overviewStatus.libs = 'ok';
  } catch (error) {
    console.error("Failed to load ECharts for overview:", error);
    controller.overviewStatus.libs = 'error';
    controller.overviewStatus.error = `库加载失败: ${error.message}`;
    updateStatusInPlace(root, controller.overviewStatus);
    return;
  }

  updateStatusInPlace(root, controller.overviewStatus);

  // Use queueMicrotask to ensure layout is settled for accurate sizing
  queueMicrotask(() => {
    try {
      // Trend Chart
      const trendEl = root.querySelector('[data-oc-overview-chart="trend"]');
      if (trendEl) {
        initSingleChart(trendEl, echarts, {
          tooltip: { trigger: 'axis' },
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: data.trend.map(d => d.day.slice(5)), // MM-DD
            axisLabel: { color: '#64748b' }
          },
          yAxis: { type: 'value', axisLabel: { color: '#64748b' } },
          series: [{
            name: 'Tokens',
            type: 'line',
            smooth: true,
            data: data.trend.map(d => d.tokens),
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0)' }
              ])
            },
            itemStyle: { color: '#3b82f6' }
          }]
        });
      }

      // Members Chart
      const membersEl = root.querySelector('[data-oc-overview-chart="members"]');
      if (membersEl) {
        const sortedMembers = [...(data.topMembers || [])].reverse();
        initSingleChart(membersEl, echarts, {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
          yAxis: {
            type: 'category',
            data: sortedMembers.map(m => m.username),
            axisLabel: { color: '#64748b' }
          },
          series: [{
            type: 'bar',
            data: sortedMembers.map(m => m.tokens),
            itemStyle: {
              color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                { offset: 0, color: '#6366f1' },
                { offset: 1, color: '#8b5cf6' }
              ]),
              borderRadius: [0, 4, 4, 0]
            },
            label: { show: true, position: 'right', color: '#64748b' }
          }]
        });
      }

      // Agents Chart
      const agentsEl = root.querySelector('[data-oc-overview-chart="agents"]');
      if (agentsEl) {
        const agentRows = [...(data.topAgents || [])];
        initSingleChart(agentsEl, echarts, {
          tooltip: { 
            trigger: 'item',
            formatter: '{b}: {c} tokens ({d}%)'
          },
          legend: {
            orient: 'vertical',
            left: 'left',
            padding: [0, 0, 0, 10],
            textStyle: { fontSize: 12 }
          },
          series: [{
            name: 'Agent 消耗分布',
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['60%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: { 
              show: true, 
              position: 'outside',
              formatter: '{b}'
            },
            emphasis: { 
              label: { show: true, fontSize: '14', fontWeight: 'bold' } 
            },
            data: agentRows.map((agent) => ({
              value: agent.tokens,
              name: resolveAgentDisplayName(agent),
            }))
          }]
        });
      }

      controller.overviewStatus.charts = 'ok';
    } catch (error) {
      console.error("Failed to initialize charts:", error);
      controller.overviewStatus.charts = 'error';
      controller.overviewStatus.error = `图表初始化失败: ${error.message}`;
    }

    updateStatusInPlace(root, controller.overviewStatus);
  });
}

function initSingleChart(el, echarts, option) {
  if (!el || !echarts) return;
  
  if (typeof option.backgroundColor === "undefined") {
    option.backgroundColor = "transparent";
  }

  const instance = echarts.init(el, null, { renderer: "canvas" });
  instance.setOption(option, true);
  
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => {
      try {
        instance.resize();
      } catch (e) {
        // Ignore resize errors for detached nodes
      }
    });
    ro.observe(el);
  } else {
    window.addEventListener('resize', () => instance.resize());
  }
}

function updateStatusInPlace(root, status) {
  const container = root.querySelector(".oc-tenant-overview-status");
  if (!container) return;
  
  container.innerHTML = `
    <span style="padding:2px 6px;border-radius:4px;background:${status.libs === 'ok' ? '#dcfce7' : status.libs === 'error' ? '#fee2e2' : '#f1f5f9'};color:${status.libs === 'ok' ? '#166534' : status.libs === 'error' ? '#991b1b' : '#475569'}">库加载: ${status.libs || '待处理'}</span>
    <span style="padding:2px 6px;border-radius:4px;background:${status.charts === 'ok' ? '#dcfce7' : status.charts === 'error' ? '#fee2e2' : '#f1f5f9'};color:${status.charts === 'ok' ? '#166534' : status.charts === 'error' ? '#991b1b' : '#475569'}">图表初始化: ${status.charts || '待处理'}</span>
    ${status.error ? `<span style="color:#ef4444;font-weight:600;">错误: ${escapeHtml(status.error)}</span>` : ''}
  `;
}

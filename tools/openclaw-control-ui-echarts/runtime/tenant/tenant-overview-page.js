import { createLibraryLoader } from "../echarts/libraries.js";

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function refreshTenantOverview(root, controller) {
  try {
    const data = await controller.apiClient.getTenantOverview();
    controller.overviewData = data;
  } catch (error) {
    console.error("Failed to refresh tenant overview:", error);
  }
}

export function renderTenantOverview(controller) {
  const data = controller.overviewData;
  if (!data) {
    return `<div class="oc-tenant-overview-loading">正在加载统计数据...</div>`;
  }

  const { summary } = data;
  
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
          <div class="oc-tenant-chart-container" data-oc-overview-chart="trend"></div>
        </div>
      </div>

      <div class="oc-tenant-overview-side">
        <div class="oc-tenant-card oc-tenant-chart-card">
          <div class="oc-tenant-card-header">
            <h3 class="oc-tenant-card-title">成员消耗排名</h3>
          </div>
          <div class="oc-tenant-chart-container" data-oc-overview-chart="members"></div>
        </div>
        <div class="oc-tenant-card oc-tenant-chart-card">
          <div class="oc-tenant-card-header">
            <h3 class="oc-tenant-card-title">Agent 消耗分布</h3>
          </div>
          <div class="oc-tenant-chart-container" data-oc-overview-chart="agents"></div>
        </div>
      </div>
    </div>
  `;
}

export async function initTenantOverviewCharts(root, controller) {
  const data = controller.overviewData;
  if (!data) return;

  const vendorBaseUrl = new URL("../echarts/", import.meta.url);
  const loadLibraries = createLibraryLoader(vendorBaseUrl);
  
  let echarts;
  try {
    const libs = await loadLibraries();
    echarts = libs.echarts;
  } catch (error) {
    console.error("Failed to load ECharts for overview:", error);
    return;
  }

  // Trend Chart
  const trendEl = root.querySelector('[data-oc-overview-chart="trend"]');
  if (trendEl) {
    const chart = echarts.init(trendEl);
    chart.setOption({
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
    window.addEventListener('resize', () => chart.resize());
  }

  // Members Chart
  const membersEl = root.querySelector('[data-oc-overview-chart="members"]');
  if (membersEl) {
    const chart = echarts.init(membersEl);
    const sortedMembers = [...data.topMembers].reverse();
    chart.setOption({
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
    window.addEventListener('resize', () => chart.resize());
  }

  // Agents Chart
  const agentsEl = root.querySelector('[data-oc-overview-chart="agents"]');
  if (agentsEl) {
    const chart = echarts.init(agentsEl);
    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: '14', fontWeight: 'bold' } },
        data: data.topAgents.map(a => ({ value: a.tokens, name: a.id }))
      }]
    });
    window.addEventListener('resize', () => chart.resize());
  }
}

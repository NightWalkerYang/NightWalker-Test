/**
 * 金蝶行列式数据 → ECharts series 格式转换
 * 支持财务报表预设规则和自定义字段映射
 */

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeString(value) {
  return String(value ?? "").trim();
}

// ─── 通用转换器 ───────────────────────────────────────────────────────────────

export function rowsToBarChart(rows, categoryKey, valueKey, title = "") {
  const categories = rows.map((r) => safeString(r[categoryKey]));
  const values = rows.map((r) => safeNumber(r[valueKey]));
  return {
    title: { text: title },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: values, name: title }],
  };
}

export function rowsToPieChart(rows, nameKey, valueKey, title = "") {
  const data = rows.map((r) => ({
    name: safeString(r[nameKey]),
    value: safeNumber(r[valueKey]),
  }));
  return {
    title: { text: title, left: "center" },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", left: "left" },
    series: [{ type: "pie", radius: "60%", data, emphasis: { itemStyle: { shadowBlur: 10 } } }],
  };
}

export function rowsToLineChart(rows, xKey, yKey, title = "") {
  const xData = rows.map((r) => safeString(r[xKey]));
  const yData = rows.map((r) => safeNumber(r[yKey]));
  return {
    title: { text: title },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: xData },
    yAxis: { type: "value" },
    series: [{ type: "line", data: yData, smooth: true, name: title }],
  };
}

export function rowsToGaugeChart(value, max, title = "", unit = "") {
  return {
    title: { text: title, left: "center" },
    series: [
      {
        type: "gauge",
        max,
        data: [{ value: safeNumber(value), name: title }],
        detail: { formatter: `{value}${unit}` },
      },
    ],
  };
}

// ─── 财务报表专用转换器 ───────────────────────────────────────────────────────

export function transformProfitLoss(reportData) {
  const rows = reportData?.Result?.rows || reportData?.rows || [];
  if (!rows.length) {
    return rowsToBarChart([], "item", "amount", "利润表");
  }
  const categories = rows.map((r) => safeString(r.item || r.FNAME || r.name));
  const values = rows.map((r) => safeNumber(r.amount || r.FAMOUNT));
  return {
    title: { text: "利润表概览" },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: categories, axisLabel: { rotate: 30 } },
    yAxis: { type: "value", axisLabel: { formatter: (v) => `${(v / 10000).toFixed(0)}万` } },
    series: [
      {
        type: "bar",
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: v >= 0 ? "#5470c6" : "#ee6666" },
        })),
        name: "金额",
      },
    ],
  };
}

export function transformBalanceSheet(reportData) {
  const rows = reportData?.Result?.rows || reportData?.rows || [];
  const assets = rows.filter((r) => safeNumber(r.amount || r.FAMOUNT) >= 0);
  const liabilities = rows.filter((r) => safeNumber(r.amount || r.FAMOUNT) < 0);

  return {
    title: { text: "资产负债表" },
    tooltip: { trigger: "item" },
    legend: { top: "5%", left: "center" },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        data: assets.map((r) => ({
          name: safeString(r.item || r.FNAME),
          value: Math.abs(safeNumber(r.amount || r.FAMOUNT)),
        })),
        label: { formatter: "{b}: {d}%" },
      },
    ],
  };
}

export function transformAccountsReceivable(reportData) {
  const rows = reportData?.Result?.rows || reportData?.rows || [];
  const agingGroups = {};
  for (const row of rows) {
    const aging = safeString(row.aging || row.FAGING || "未知");
    const amount = safeNumber(row.amount || row.FAMOUNT);
    agingGroups[aging] = (agingGroups[aging] || 0) + amount;
  }
  const entries = Object.entries(agingGroups);
  return {
    title: { text: "应收账款账龄分析", left: "center" },
    tooltip: { trigger: "item", formatter: "{b}: ¥{c} ({d}%)" },
    series: [
      {
        type: "pie",
        radius: "65%",
        data: entries.map(([name, value]) => ({ name, value })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.5)" } },
      },
    ],
  };
}

export function transformAccountsPayable(reportData) {
  const rows = reportData?.Result?.rows || reportData?.rows || [];
  const supplierMap = {};
  for (const row of rows) {
    const supplier = safeString(row.supplier || row.FSUPPLIER || row.FNAME || "未知");
    const amount = safeNumber(row.amount || row.FAMOUNT);
    supplierMap[supplier] = (supplierMap[supplier] || 0) + amount;
  }
  const sorted = Object.entries(supplierMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  return rowsToBarChart(
    sorted.map(([name, value]) => ({ name, value })),
    "name",
    "value",
    "应付账款TOP10供应商",
  );
}

export function transformCashFlow(reportData) {
  const rows = reportData?.Result?.rows || reportData?.rows || [];
  const inflow = rows.filter((r) => safeNumber(r.amount || r.FAMOUNT) > 0);
  const outflow = rows.filter((r) => safeNumber(r.amount || r.FAMOUNT) < 0);

  return {
    title: { text: "现金流量分析" },
    tooltip: { trigger: "axis" },
    legend: { data: ["流入", "流出"] },
    xAxis: {
      type: "category",
      data: rows.map((r) => safeString(r.item || r.FNAME || r.category)).slice(0, 10),
    },
    yAxis: { type: "value" },
    series: [
      { name: "流入", type: "bar", stack: "cash", data: inflow.map((r) => safeNumber(r.amount || r.FAMOUNT)) },
      { name: "流出", type: "bar", stack: "cash", data: outflow.map((r) => Math.abs(safeNumber(r.amount || r.FAMOUNT))), itemStyle: { color: "#ee6666" } },
    ],
  };
}

// ─── 自动选择转换器 ───────────────────────────────────────────────────────────

const PRESET_TRANSFORMERS = {
  profitLoss: transformProfitLoss,
  balanceSheet: transformBalanceSheet,
  accountsReceivable: transformAccountsReceivable,
  accountsPayable: transformAccountsPayable,
  cashFlow: transformCashFlow,
};

export function transformKingdeeData(reportId, rawData, chartType = "auto", options = {}) {
  const preset = PRESET_TRANSFORMERS[reportId];
  if (preset) {
    return preset(rawData);
  }

  const rows = rawData?.Result?.rows || rawData?.Result || rawData?.rows || [];
  if (!Array.isArray(rows) || !rows.length) {
    return { title: { text: "暂无数据" }, series: [] };
  }

  const keys = Object.keys(rows[0] || {});
  const nameKey = options.nameKey || keys[0] || "name";
  const valueKey = options.valueKey || keys[1] || "value";

  switch (chartType) {
    case "pie":
      return rowsToPieChart(rows, nameKey, valueKey, options.title || "");
    case "line":
      return rowsToLineChart(rows, nameKey, valueKey, options.title || "");
    case "bar":
    default:
      return rowsToBarChart(rows, nameKey, valueKey, options.title || "");
  }
}

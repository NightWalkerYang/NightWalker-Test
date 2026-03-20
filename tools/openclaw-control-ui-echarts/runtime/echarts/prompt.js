import {
  ensureArray,
  normalizeText,
  toDisplayString,
  truncateString,
} from "../framework/shared.js";

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const abs = Math.abs(numeric);
  if (abs >= 1000 || Number.isInteger(numeric)) {
    return numeric.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  }
  return numeric.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function chartTypeLabel(type) {
  const map = {
    bar: "柱状图",
    line: "折线图",
    scatter: "散点图",
    pie: "饼图",
    radar: "雷达图",
    heatmap: "热力图",
    map: "地图",
    candlestick: "K 线图",
    boxplot: "箱线图",
    treemap: "矩形树图",
    sunburst: "旭日图",
    funnel: "漏斗图",
    gauge: "仪表盘",
    sankey: "桑基图",
    graph: "关系图",
  };
  return map[type] || type || "未命名图表";
}

function extractValuePayload(item) {
  if (item && typeof item === "object" && "value" in item) {
    return item.value;
  }
  return item;
}

function extractNumericVector(item) {
  const raw = extractValuePayload(item);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
  }
  return [];
}

function summarizeNumericSeries(data) {
  const numbers = data
    .map((item) => extractNumericVector(item))
    .filter((vector) => vector.length > 0)
    .map((vector) => vector[0]);

  if (numbers.length === 0) {
    return "";
  }

  const total = numbers.reduce((sum, current) => sum + current, 0);
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  const latest = numbers[numbers.length - 1];
  const average = total / numbers.length;

  return [
    `共 ${numbers.length} 个点`,
    `最小 ${formatNumber(minimum)}`,
    `最大 ${formatNumber(maximum)}`,
    `平均 ${formatNumber(average)}`,
    `最新 ${formatNumber(latest)}`,
  ].join("；");
}

function summarizeVectorSeries(data) {
  const vectors = data
    .map((item) => extractNumericVector(item))
    .filter((vector) => vector.length >= 2);

  if (vectors.length === 0) {
    return "";
  }

  const dimensionCount = Math.max(...vectors.map((vector) => vector.length));
  const parts = [`共 ${vectors.length} 个点`];

  for (let index = 0; index < dimensionCount; index += 1) {
    const values = vectors
      .map((vector) => vector[index])
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      continue;
    }
    parts.push(
      `维度 ${index + 1} ${formatNumber(Math.min(...values))} - ${formatNumber(Math.max(...values))}`,
    );
  }

  return parts.join("；");
}

function summarizeAxis(axis, axisName) {
  if (!axis || typeof axis !== "object") {
    return "";
  }

  const type = axis.type || "value";
  const name = normalizeText(axis.name || "");
  const categoryData = Array.isArray(axis.data)
    ? axis.data
        .slice(0, 6)
        .map((entry) => truncateString(toDisplayString(entry), 16))
        .filter(Boolean)
    : [];

  const segments = [`${axisName}（${type}）`];
  if (name) {
    segments.push(name);
  }
  if (categoryData.length > 0) {
    segments.push(`示例：${categoryData.join("、")}`);
  }
  return segments.join("：");
}

function summarizeSeries(option) {
  const seriesList = ensureArray(option?.series);
  const lines = seriesList
    .map((series, index) => {
      if (!series || typeof series !== "object") {
        return "";
      }

      const name = normalizeText(series.name || "") || `系列 ${index + 1}`;
      const type = chartTypeLabel(series.type);
      const data = Array.isArray(series.data) ? series.data : [];
      const summary =
        data.length === 0
          ? ""
          : series.type === "scatter" || series.type === "radar"
            ? summarizeVectorSeries(data) || summarizeNumericSeries(data)
            : summarizeNumericSeries(data) || summarizeVectorSeries(data);

      return summary ? `- ${name}（${type}）：${summary}` : `- ${name}（${type}）`;
    })
    .filter(Boolean);

  if (lines.length <= 8) {
    return lines;
  }

  return [...lines.slice(0, 8), `- 其余 ${lines.length - 8} 个系列已省略`];
}

function summarizeAxes(option) {
  const lines = [];
  ensureArray(option?.xAxis).forEach((axis, index, list) => {
    lines.push(summarizeAxis(axis, `X 轴${list.length > 1 ? index + 1 : ""}`));
  });
  ensureArray(option?.yAxis).forEach((axis, index, list) => {
    lines.push(summarizeAxis(axis, `Y 轴${list.length > 1 ? index + 1 : ""}`));
  });
  ensureArray(option?.angleAxis).forEach((axis, index, list) => {
    lines.push(summarizeAxis(axis, `角度轴${list.length > 1 ? index + 1 : ""}`));
  });
  ensureArray(option?.radiusAxis).forEach((axis, index, list) => {
    lines.push(summarizeAxis(axis, `半径轴${list.length > 1 ? index + 1 : ""}`));
  });
  return lines.filter(Boolean);
}

function extractLegendNames(option) {
  const legends = ensureArray(option?.legend);
  const names = [];
  for (const legend of legends) {
    if (!legend || typeof legend !== "object" || !Array.isArray(legend.data)) {
      continue;
    }
    for (const entry of legend.data) {
      if (typeof entry === "string" && entry.trim()) {
        names.push(entry.trim());
      } else if (
        entry &&
        typeof entry === "object" &&
        typeof entry.name === "string" &&
        entry.name.trim()
      ) {
        names.push(entry.name.trim());
      }
    }
  }

  if (names.length > 0) {
    return [...new Set(names)];
  }

  return ensureArray(option?.series)
    .map((series) => normalizeText(series?.name || ""))
    .filter(Boolean);
}

export function buildChartPrompt(payload, uiText) {
  const option = payload?.option ?? {};
  const title = normalizeText(option?.title?.text || "");
  const subtitle = normalizeText(option?.title?.subtext || "");
  const types = [
    ...new Set(
      ensureArray(option?.series)
        .map((series) => chartTypeLabel(series?.type))
        .filter(Boolean),
    ),
  ];
  const legendNames = extractLegendNames(option);
  const axisLines = summarizeAxes(option);
  const seriesLines = summarizeSeries(option);

  const lines = [];

  if (uiText.promptLead) {
    lines.push(uiText.promptLead);
  }

  if (title) {
    lines.push(`- ${uiText.promptTitle}：${title}`);
  }
  if (subtitle) {
    lines.push(`- ${uiText.promptSubtitle}：${subtitle}`);
  }
  if (types.length > 0) {
    lines.push(`- ${uiText.promptTypes}：${types.join("、")}`);
  }
  if (legendNames.length > 0) {
    const visibleLegendNames = legendNames.slice(0, 12);
    const legendText =
      legendNames.length > 12
        ? `${visibleLegendNames.join("、")} 等 ${legendNames.length} 项`
        : visibleLegendNames.join("、");
    lines.push(`- ${uiText.promptLegend}：${legendText}`);
  }
  if (axisLines.length > 0) {
    lines.push(`${uiText.promptAxes}：`);
    lines.push(...axisLines.map((line) => `- ${line}`));
  }
  if (seriesLines.length > 0) {
    lines.push(`${uiText.promptSeries}：`);
    lines.push(...seriesLines);
  }

  return lines.join("\n");
}

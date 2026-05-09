import { createTenantApiClient } from "../tenant/api-client.js";
import {
  isSandboxViewPublicPath,
  normalizeSandboxViewRouteUrl,
  readSandboxViewToken,
} from "./context.js";

const SURFACE_STYLE_ATTR = "data-openclaw-sandbox-view-surface-style";
const G6_VENDOR_PATH = "/assets/vendor/g6/g6.min.js";
const ECHARTS_VENDOR_PATH = "/assets/vendor/echarts.min.js";
const GRAPH_REPLAY_DELAY_MS = 960;
const SIMULATION_STEP_DELAY_MS = 760;
const RECOMMENDED_SIMULATION_QUESTIONS = [
  {
    id: "purchase-demand",
    taskType: "采购需求预测",
    question: "未来一个月哪些物料需要提前采购？",
    description: "适合用销售订单、出库、物料和采购记录推演补货需求。",
  },
  {
    id: "shortage-risk",
    taskType: "缺料风险识别",
    question: "未来一个月哪些物料最容易出现缺料风险？",
    description: "适合优先查看高风险物料、组织范围和历史消耗关系。",
  },
  {
    id: "cost-impact",
    taskType: "采购成本测算",
    question: "如果按当前需求补货，预计采购成本会集中在哪些物料？",
    description: "适合关注价格参考、采购订单和建议采购结构。",
  },
];
const DEFAULT_SIMULATION_QUESTION = RECOMMENDED_SIMULATION_QUESTIONS[0].question;
const PREDICTION_RELEVANT_DATASET_IDS = new Set([
  "sales_order",
  "sales_outbound",
  "material_master",
  "purchase_order",
  "supplier_price",
  "org_scope",
]);
const DEMAND_EVIDENCE_DATASET_IDS = new Set(["sales_order", "sales_outbound"]);

const sandboxMetricChartInstances = new WeakMap();
let sandboxGraphReplayTimer = null;
let sandboxGraphFocusState = null;

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultPeriods() {
  const today = new Date();
  const inputEnd = addDays(today, -1);
  const inputStart = new Date(inputEnd);
  inputStart.setMonth(inputStart.getMonth() - 12);
  const targetStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const targetEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return {
    inputStartDate: formatDateInputValue(inputStart),
    inputEndDate: formatDateInputValue(inputEnd),
    targetStartDate: formatDateInputValue(targetStart),
    targetEndDate: formatDateInputValue(targetEnd),
  };
}

function clearHost() {
  document.documentElement.style.background = "#06121f";
  document.documentElement.style.margin = "0";
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  if (document.body instanceof HTMLElement) {
    document.body.classList.add("oc-sandbox-view-state-body");
    document.body.style.background = "#06121f";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
    document.body.replaceChildren();
  }
}

function ensureSurfaceStyle() {
  let link = document.head.querySelector(`[${SURFACE_STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./surface.css", import.meta.url).href;
  link.setAttribute(SURFACE_STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function showState({ eyebrow, title, message }) {
  ensureSurfaceStyle();
  const card = document.createElement("section");
  card.className = "oc-sandbox-view-state-card";
  card.innerHTML = `
    <p class="oc-sandbox-view-eyebrow">${eyebrow}</p>
    <h1 class="oc-sandbox-view-title">${title}</h1>
    <p class="oc-sandbox-view-subtitle">${message}</p>
  `;
  const root = document.createElement("main");
  root.className = "oc-sandbox-view-state";
  root.append(card);
  document.body.replaceChildren(root);
}

function normalizeLocation() {
  const normalized = normalizeSandboxViewRouteUrl(window.location.href, window.location.href);
  if (
    normalized.pathname !== window.location.pathname ||
    normalized.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalized.toString());
  }
}

function normalizeTokenLocation(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get("token") === normalizedToken) {
    return;
  }
  url.searchParams.set("token", normalizedToken);
  window.history.replaceState({}, "", url.toString());
}

async function loadSandboxPayload(token) {
  if (!token) {
    return null;
  }
  return createTenantApiClient().resolveMemberSandbox(token);
}

async function loadSandboxDataCatalog(token, periods) {
  if (!token) {
    return null;
  }
  return createTenantApiClient().listMemberSandboxDataCatalog(token, {
    inputStartDate: periods.inputStartDate,
    inputEndDate: periods.inputEndDate,
  });
}

async function loadSandboxMaterialCandidates(token, periods, keyword = "") {
  if (!token) {
    return null;
  }
  return createTenantApiClient().listMemberSandboxMaterialCandidates(token, {
    inputStartDate: periods.inputStartDate,
    inputEndDate: periods.inputEndDate,
    keyword,
  });
}

async function submitSandboxRun(spec) {
  return createTenantApiClient().submitMemberSandboxRun({
    token: spec.token,
    question: spec.question,
    inputPeriod: spec.inputPeriod,
    targetPeriod: spec.targetPeriod,
    selectedDatasetIds: [...spec.selectedDatasetIds],
    selectedMaterialIds: [...spec.selectedMaterialIds],
  });
}

async function loadSandboxRunStatus(token, runId) {
  return createTenantApiClient().getMemberSandboxRun(token, runId);
}

async function loadSandboxRunResult(token, runId) {
  return createTenantApiClient().getMemberSandboxRunResult(token, runId);
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number);
}

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

function createMetric(label, value, description) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "oc-sandbox-view-metric";
  element.dataset.metricLabel = label;
  element.innerHTML = `
    <span class="oc-sandbox-view-metric-label">${label}</span>
    <strong class="oc-sandbox-view-metric-value">${value}</strong>
    <span class="oc-sandbox-view-metric-hint">${description}</span>
  `;
  return element;
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeRiskLabel(value) {
  const riskLevel = String(value || "").trim().toLowerCase();
  if (riskLevel === "high") {
    return "高";
  }
  if (riskLevel === "medium") {
    return "中";
  }
  if (riskLevel === "low") {
    return "低";
  }
  return value ? String(value) : "-";
}

function normalizeDatasetStatusLabel(status) {
  const normalized = String(status || "").trim();
  if (normalized === "available") {
    return "可用";
  }
  if (normalized === "partial") {
    return "部分可用";
  }
  if (normalized === "empty") {
    return "无数据";
  }
  if (normalized === "missing") {
    return "未接入";
  }
  return "待检查";
}

function ensureG6Library() {
  if (window.G6?.Graph) {
    return Promise.resolve(window.G6);
  }
  if (window.__openclawSandboxViewG6LoadPromise) {
    return window.__openclawSandboxViewG6LoadPromise;
  }
  window.__openclawSandboxViewG6LoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = G6_VENDOR_PATH;
    script.async = true;
    script.onload = () => resolve(window.G6);
    script.onerror = () => reject(new Error("sandbox_g6_load_failed"));
    document.head.append(script);
  });
  return window.__openclawSandboxViewG6LoadPromise;
}

function ensureEchartsLibrary() {
  if (window.echarts?.init) {
    return Promise.resolve(window.echarts);
  }
  if (window.__openclawSandboxViewEchartsLoadPromise) {
    return window.__openclawSandboxViewEchartsLoadPromise;
  }
  window.__openclawSandboxViewEchartsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ECHARTS_VENDOR_PATH;
    script.async = true;
    script.onload = () => resolve(window.echarts);
    script.onerror = () => reject(new Error("sandbox_echarts_load_failed"));
    document.head.append(script);
  });
  return window.__openclawSandboxViewEchartsLoadPromise;
}

function resolveNodeLayer(node, edgeByTarget) {
  const nodeId = String(node?.id || "");
  const nodeType = String(node?.nodeType || node?.type || "").toLowerCase();
  if (nodeId === "scenario-root" || nodeId.includes("scenario") || !edgeByTarget.has(node?.id)) {
    return "root";
  }
  if (nodeId.includes("org") || nodeType.includes("org")) {
    return "detail";
  }
  if (nodeId.includes("sales") || nodeType.includes("sales")) {
    return "forecast";
  }
  if (nodeId.includes("supplier") || nodeType.includes("supplier") || nodeId.includes("price")) {
    return "purchase";
  }
  if (nodeType.includes("materialsample")) {
    return "detail";
  }
  if (nodeType.includes("material") || String(node?.id || "").startsWith("material:")) {
    return "material";
  }
  if (nodeType.includes("inventory") || String(node?.id || "").startsWith("inventory:")) {
    return "inventory";
  }
  if (nodeType.includes("purchase") || String(node?.id || "").startsWith("purchase:")) {
    return "purchase";
  }
  return "detail";
}

function normalizeGraphPayloadForG6(graphPayload, dimensions = {}) {
  const width = Math.max(Number(dimensions.width) || 0, 720);
  const height = Math.max(Number(dimensions.height) || 0, 520);
  const nodes = Array.isArray(graphPayload?.nodes) ? graphPayload.nodes : [];
  const edges = Array.isArray(graphPayload?.edges) ? graphPayload.edges : [];
  const edgeByTarget = new Map(edges.map((edge) => [edge.target, edge]));
  const layerBuckets = {
    root: [],
    material: [],
    forecast: [],
    inventory: [],
    purchase: [],
    detail: [],
  };

  const normalizedNodes = nodes.map((node) => {
    const normalized = {
      ...node,
      nodeType: node.nodeType || node.type || "Material",
      type: "circle",
    };
    layerBuckets[resolveNodeLayer(normalized, edgeByTarget)].push(normalized);
    return normalized;
  });

  const layerX = {
    root: Math.max(82, width * 0.09),
    forecast: Math.max(245, width * 0.25),
    material: Math.max(410, width * 0.45),
    inventory: Math.max(565, width * 0.64),
    purchase: Math.max(720, width * 0.84),
    detail: Math.max(405, width * 0.44),
  };

  Object.entries(layerBuckets).forEach(([layer, bucket]) => {
    const count = Math.max(bucket.length, 1);
    const usableHeight = Math.max(height - 160, 340);
    const startY = Math.max(88, (height - usableHeight) / 2);
    bucket.forEach((node, index) => {
      const y = count === 1 ? height / 2 : startY + (usableHeight * index) / (count - 1);
      node.style = {
        ...node.style,
        x: Math.min(Math.max(layerX[layer], 48), width - 56),
        y: Math.min(Math.max(y, 70), height - 70),
      };
    });
  });

  const nodeIds = new Set(normalizedNodes.map((node) => node.id));
  const normalizedEdges = edges.map((edge) => {
    if (!nodeIds.has(edge?.source) || !nodeIds.has(edge?.target)) {
      return null;
    }
    return {
      ...edge,
      label: translateGraphEdgeLabel(edge?.label),
    };
  });

  return {
    ...graphPayload,
    nodes: normalizedNodes,
    edges: normalizedEdges.filter(Boolean),
  };
}

function translateGraphEdgeLabel(label) {
  const normalized = String(label || "").trim().toUpperCase();
  const labels = {
    HAS_MATERIAL: "关联物料",
    USES_COMPONENT: "使用物料",
    FORECASTS: "产生需求",
    PREDICTS: "产生需求",
    HAS_INVENTORY: "形成库存",
    STOCK: "形成库存",
    HAS_PURCHASE: "形成采购记录",
    RECOMMENDS: "形成采购记录",
    HAS_PRICE: "引用价格",
    BELONGS_TO: "归属组织",
    HAS_ORG: "归属组织",
    ORG_SCOPE: "限定组织",
  };
  return labels[normalized] || String(label || "关联数据");
}

function collectMaterialSamples(recommendations, limit = 5) {
  const samples = [];
  const seen = new Set();
  recommendations.forEach((item) => {
    const materialId = String(item?.materialId || "").trim();
    if (!materialId || seen.has(materialId) || samples.length >= limit) {
      return;
    }
    seen.add(materialId);
    samples.push({
      id: `material:${materialId}`,
      label: getMaterialDisplayName(item),
      nodeType: "material",
      riskLevel: item?.riskLevel,
    });
  });
  return samples;
}

function createSourceRelationshipGraph(payload, selectedMetadataIds = null) {
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  const selected =
    selectedMetadataIds instanceof Set && selectedMetadataIds.size > 0
      ? selectedMetadataIds
      : new Set(getMetadataOptions(payload).filter((item) => item.checked).map((item) => item.id));
  const materialSamples = collectMaterialSamples(recommendations, 4).map((node) => ({
    ...node,
    nodeType: "materialSample",
  }));
  const candidateNodes = [
    { id: "scenario-root", label: "沙盒场景", nodeType: "scenario" },
    selected.has("org_scope") ? { id: "org-scope", label: "组织范围", nodeType: "org" } : null,
    selected.has("sales_order") ? { id: "sales-order", label: "销售订单", nodeType: "sales" } : null,
    selected.has("sales_outbound") ? { id: "sales-outbound", label: "销售出库", nodeType: "sales" } : null,
    selected.has("material_master") ? { id: "material-master", label: "物料主数据", nodeType: "material" } : null,
    selected.has("inventory_snapshot") ? { id: "inventory-snapshot", label: "库存快照", nodeType: "inventory" } : null,
    selected.has("purchase_order") ? { id: "purchase-order", label: "采购订单", nodeType: "purchase" } : null,
    selected.has("purchase_receipt") ? { id: "purchase-receipt", label: "采购收货", nodeType: "purchase" } : null,
    selected.has("supplier_price") ? { id: "supplier-price", label: "供应商/价格", nodeType: "supplier" } : null,
    ...materialSamples,
  ].filter(Boolean);
  const nodeIds = new Set(candidateNodes.map((node) => node.id));
  const nodes = candidateNodes.filter(
    (node) => !String(node.id).startsWith("material:") || nodeIds.has("material-master"),
  );
  const filteredNodeIds = new Set(nodes.map((node) => node.id));
  const materialEdges = materialSamples.map((node) => ({
    source: "material-master",
    target: node.id,
    label: "示例物料",
  }));
  const edges = [
      { source: "scenario-root", target: "org-scope", label: "限定组织" },
      { source: "org-scope", target: "sales-order", label: "归属组织" },
      { source: "org-scope", target: "inventory-snapshot", label: "归属组织" },
      { source: "org-scope", target: "purchase-order", label: "归属组织" },
      { source: "org-scope", target: "purchase-receipt", label: "归属组织" },
      { source: "org-scope", target: "supplier-price", label: "归属组织" },
      { source: "sales-order", target: "sales-outbound", label: "产生出库" },
      { source: "sales-outbound", target: "material-master", label: "关联物料" },
      { source: "inventory-snapshot", target: "material-master", label: "记录库存" },
      { source: "purchase-order", target: "material-master", label: "采购物料" },
      { source: "purchase-receipt", target: "material-master", label: "收货物料" },
      { source: "purchase-order", target: "purchase-receipt", label: "形成收货" },
      { source: "supplier-price", target: "material-master", label: "维护价格" },
      { source: "purchase-order", target: "supplier-price", label: "引用价格" },
      ...materialEdges,
    ].filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target));
  return {
    nodes,
    edges,
  };
}

function applyGraphFocus(graphPayload, focus = null) {
  if (!focus || !focus.materialId) {
    return graphPayload;
  }
  const focusNodeId = `material:${focus.materialId}`;
  const emphasizedNodeIds = new Set([focusNodeId, "material-master", "scenario-root"]);
  const nodes = (Array.isArray(graphPayload?.nodes) ? graphPayload.nodes : []).map((node) => {
    const isFocused = node.id === focusNodeId;
    const isRelated = emphasizedNodeIds.has(node.id);
    return {
      ...node,
      style: {
        ...node.style,
        opacity: isRelated ? 1 : 0.22,
        lineWidth: isFocused ? 3 : node.style?.lineWidth,
        halo: isFocused,
      },
    };
  });
  const edges = (Array.isArray(graphPayload?.edges) ? graphPayload.edges : []).map((edge) => {
    const isRelated = edge.source === focusNodeId || edge.target === focusNodeId;
    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isRelated ? 1 : 0.18,
      },
    };
  });
  return {
    ...graphPayload,
    nodes,
    edges,
  };
}

function createGraphReplayStages(graphPayload) {
  const nodes = Array.isArray(graphPayload?.nodes) ? graphPayload.nodes : [];
  const edges = Array.isArray(graphPayload?.edges) ? graphPayload.edges : [];
  if (nodes.length <= 1) {
    return [{ label: "完成图谱", data: graphPayload }];
  }
  const idsByType = (matcher) =>
    new Set(nodes.filter((node) => matcher(String(node.nodeType || node.type || "").toLowerCase(), String(node.id || ""))).map((node) => node.id));
  const rootIds = idsByType((type, id) => id === "scenario-root" || type.includes("scenario"));
  if (rootIds.size === 0 && nodes[0]?.id) {
    rootIds.add(nodes[0].id);
  }
  const orgIds = idsByType((type, id) => type.includes("org") || id.includes("org"));
  const salesIds = idsByType((type, id) => type.includes("sales") || id.includes("sales"));
  const inventoryIds = idsByType((type, id) => type.includes("inventory") || id.includes("inventory"));
  const purchaseIds = idsByType((type, id) => type.includes("purchase") || id.includes("purchase"));
  const priceIds = idsByType((type, id) => type.includes("supplier") || id.includes("price"));
  const materialMasterIds = idsByType((type, id) => type === "material" || id === "material-master");
  const materialIds = idsByType((type, id) => type.includes("material") || id.startsWith("material:"));
  const stages = [
    { label: "读取场景", ids: rootIds },
    { label: "载入组织范围", ids: new Set([...rootIds, ...orgIds]) },
    { label: "连接业务单据", ids: new Set([...rootIds, ...orgIds, ...salesIds, ...inventoryIds, ...purchaseIds, ...priceIds, ...materialMasterIds]) },
    { label: "展开物料关系", ids: new Set(nodes.map((node) => node.id)) },
    { label: "完成关系图谱", ids: new Set(nodes.map((node) => node.id)) },
  ];
  return stages.map((stage) => ({
    label: stage.label,
    data: {
      ...graphPayload,
      nodes: nodes.filter((node) => stage.ids.has(node.id)),
      edges: edges.filter((edge) => stage.ids.has(edge.source) && stage.ids.has(edge.target)),
    },
  }));
}

function updateGraphReplayUi(stageLabel) {
  const status = document.querySelector("[data-sandbox-graph-status]");
  if (status instanceof HTMLElement) {
    status.textContent = stageLabel;
  }
  document.querySelectorAll("[data-sandbox-graph-step]").forEach((element) => {
    if (element instanceof HTMLElement) {
      element.classList.toggle("is-active", element.dataset.sandboxGraphStep === stageLabel);
    }
  });
}

function setGraphData(graph, data) {
  if (typeof graph?.setData === "function") {
    graph.setData(data);
    return;
  }
  if (typeof graph?.changeData === "function") {
    graph.changeData(data);
  }
}

function startGraphReplay(graph, stages) {
  window.clearTimeout(sandboxGraphReplayTimer);
  let index = 0;
  const applyStage = () => {
    const stage = stages[Math.min(index, stages.length - 1)];
    setGraphData(graph, stage.data);
    updateGraphReplayUi(stage.label);
    if (typeof graph?.render === "function") {
      graph.render();
    }
    index += 1;
    if (index < stages.length) {
      sandboxGraphReplayTimer = window.setTimeout(applyStage, GRAPH_REPLAY_DELAY_MS);
    }
  };
  applyStage();
}

function syncGraphFocus(graphPayload, focus = null) {
  const graph = window.__openclawSandboxGraphInstance;
  if (!graph || !graphPayload) {
    return;
  }
  sandboxGraphFocusState = focus;
  const focused = applyGraphFocus(graphPayload, focus);
  setGraphData(graph, focused);
  if (typeof graph?.render === "function") {
    graph.render();
  }
}

async function renderGraph(graphPayload) {
  const container = document.querySelector("#oc-sandbox-view-graph");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!Array.isArray(graphPayload?.nodes) || graphPayload.nodes.length === 0) {
    container.innerHTML = `<div class="oc-sandbox-view-graph-fallback">暂无图谱数据</div>`;
    return;
  }
  try {
    await ensureG6Library();
    if (!window.G6?.Graph) {
      throw new Error("sandbox_g6_unavailable");
    }
    const graphWidth = Math.max(container.clientWidth, 720);
    const graphHeight = Math.max(container.clientHeight, 560);
    const normalizedGraphPayload = normalizeGraphPayloadForG6(graphPayload, {
      width: graphWidth,
      height: graphHeight,
    });
    const replayStages = createGraphReplayStages(normalizedGraphPayload);
    const graph = new window.G6.Graph({
      container,
      width: graphWidth,
      height: graphHeight,
      data: normalizedGraphPayload,
      node: {
        style: {
          labelText: (datum) => datum.label,
          labelFill: "#eaf4ff",
          labelFontSize: 12,
          labelStroke: "rgba(3, 10, 20, 0.92)",
          labelLineWidth: 4,
          size: (datum) => (String(datum?.id || "") === "scenario-root" ? 46 : 34),
          fill: (datum) => {
            const riskLevel = String(datum.riskLevel || "").trim().toLowerCase();
            if (riskLevel === "high") {
              return "#f97316";
            }
            if (riskLevel === "medium") {
              return "#f59e0b";
            }
            const type = String(datum.nodeType || datum.type || "").toLowerCase();
            if (type.includes("sales")) {
              return "#22d3ee";
            }
            if (type.includes("inventory")) {
              return "#34d399";
            }
            if (type.includes("purchase") || type.includes("supplier")) {
              return "#fbbf24";
            }
            if (type.includes("org")) {
              return "#a78bfa";
            }
            return "#10b981";
          },
          stroke: "#dbeafe",
          lineWidth: 1.4,
        },
      },
      edge: {
        style: {
          labelText: (datum) => datum.label || "",
          labelFill: "#cfe8ff",
          labelFontSize: 10,
          labelStroke: "rgba(3, 10, 20, 0.9)",
          labelLineWidth: 4,
          stroke: "#6ea8d7",
          endArrow: true,
        },
      },
      behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
    });
    window.__openclawSandboxGraphInstance = graph;
    window.__openclawSandboxGraphReplayStages = replayStages;
    window.__openclawSandboxGraphBasePayload = normalizedGraphPayload;
    sandboxGraphFocusState = null;
    startGraphReplay(graph, replayStages);
  } catch {
    container.innerHTML = `<div class="oc-sandbox-view-graph-fallback">G6 图谱资源加载失败，已降级为摘要视图</div>`;
  }
}

function getMaterialDisplayName(item) {
  const materialId = String(item?.materialId || "").trim();
  const materialName = String(item?.materialName || "").trim();
  if (!materialName || materialName === materialId) {
    return "未命名物料";
  }
  return materialName;
}

function createMetricChartOption(metricKey, recommendations) {
  const topItems = recommendations.slice(0, 8);
  const labels = topItems.map((item) => getMaterialDisplayName(item));
  if (metricKey === "risk") {
    const counts = recommendations.reduce((result, item) => {
      const riskLevel = String(item?.riskLevel || "low").toLowerCase();
      const label = riskLevel === "high" ? "高风险" : riskLevel === "medium" ? "中风险" : "低风险";
      result[label] = (result[label] || 0) + 1;
      return result;
    }, {});
    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: { color: "#cfe8ff" } },
      grid: { left: 44, right: 28, top: 46, bottom: 42 },
      xAxis: {
        type: "category",
        data: Object.keys(counts),
        axisLabel: { color: "#b7c8d8" },
        axisLine: { lineStyle: { color: "rgba(138, 180, 217, 0.25)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#b7c8d8" },
        splitLine: { lineStyle: { color: "rgba(138, 180, 217, 0.1)" } },
      },
      series: [
        {
          name: "物料数",
          type: "bar",
          data: Object.values(counts),
          itemStyle: { color: "#fb923c", borderRadius: [6, 6, 0, 0] },
        },
        {
          name: "Top 风险物料",
          type: "line",
          smooth: true,
          data: Object.values(counts),
          lineStyle: { color: "#38bdf8", width: 2 },
          itemStyle: { color: "#38bdf8" },
        },
      ],
    };
  }
  const keyByMetric = {
    forecast: "predictedDemandQty",
    purchase: "recommendedQty",
    cost: "estimatedCost",
  };
  const valueKey = keyByMetric[metricKey] || "predictedDemandQty";
  return {
    grid: { left: 44, right: 18, top: 20, bottom: 54 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#b7c8d8", rotate: 30, overflow: "truncate" },
      axisLine: { lineStyle: { color: "rgba(138, 180, 217, 0.25)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#b7c8d8" },
      splitLine: { lineStyle: { color: "rgba(138, 180, 217, 0.1)" } },
    },
    series: [
      {
        type: "bar",
        data: topItems.map((item) => Number(item?.[valueKey]) || 0),
        itemStyle: { color: "#38bdf8", borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
}

async function renderMetricChart(metricKey, recommendations, chartContainer) {
  const container =
    chartContainer instanceof HTMLElement
      ? chartContainer
      : document.querySelector("[data-sandbox-metric-chart]");
  if (!(container instanceof HTMLElement)) {
    return;
  }
  try {
    const echarts = await ensureEchartsLibrary();
    if (!echarts?.init) {
      throw new Error("sandbox_echarts_unavailable");
    }
    let chartInstance = sandboxMetricChartInstances.get(container);
    if (!chartInstance) {
      chartInstance = echarts.init(container, null, { renderer: "canvas" });
      sandboxMetricChartInstances.set(container, chartInstance);
    }
    chartInstance.setOption(createMetricChartOption(metricKey, recommendations), true);
  } catch {
    container.textContent = "图表资源加载失败";
  }
}

function closeMetricModal() {
  const modal = document.querySelector("[data-sandbox-metric-modal]");
  if (modal instanceof HTMLElement) {
    modal.remove();
  }
}

function openMetricChartModal(metricKey, metricLabel, recommendations) {
  closeMetricModal();
  const modal = document.createElement("section");
  modal.className = "oc-sandbox-view-modal";
  modal.dataset.sandboxMetricModal = "true";
  modal.innerHTML = `
    <div class="oc-sandbox-view-modal-backdrop" data-sandbox-modal-close></div>
    <article class="oc-sandbox-view-modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(metricLabel)}数据图">
      <header class="oc-sandbox-view-modal-header">
        <div>
          <p class="oc-sandbox-view-eyebrow">数据钻取</p>
          <h2>${escapeHtml(metricLabel)}明细图</h2>
        </div>
        <button type="button" class="oc-sandbox-view-icon-button" data-sandbox-modal-close aria-label="关闭">×</button>
      </header>
      <div class="oc-sandbox-view-modal-chart" data-sandbox-metric-chart></div>
    </article>
  `;
  modal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-sandbox-modal-close]") : null;
    if (target) {
      closeMetricModal();
    }
  });
  document.body.append(modal);
  const chart = modal.querySelector("[data-sandbox-metric-chart]");
  void renderMetricChart(metricKey, recommendations, chart);
}

function getMetadataOptions(payload) {
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  const hasPrice = recommendations.some((item) => Number(item?.unitCost || item?.estimatedCost) > 0);
  return [
    { id: "sales_order", label: "销售订单", description: "订单需求、客户与物料订货节奏", checked: true, rowCount: 0, status: "fallback", periodMode: "range" },
    { id: "sales_outbound", label: "销售出库", description: "近月实际出库与客户需求波动", checked: true, rowCount: 0, status: "fallback", periodMode: "range" },
    { id: "material_master", label: "物料主数据", description: "物料编码、名称与基础属性", checked: true, rowCount: recommendations.length, status: "fallback", periodMode: "snapshot" },
    { id: "purchase_order", label: "采购订单", description: "历史采购节奏与未结订单", checked: true, rowCount: 0, status: "fallback", periodMode: "snapshot" },
    { id: "supplier_price", label: "供应商/价格参考", description: hasPrice ? "采购/销售单价兜底价格" : "价格数据未充分覆盖", checked: hasPrice, rowCount: 0, status: "fallback", periodMode: "snapshot" },
    { id: "org_scope", label: "组织范围", description: "租户成员可见组织隔离边界", checked: true, rowCount: 0, status: "fallback", periodMode: "snapshot" },
  ];
}

function normalizeCatalogDatasets(payload, catalog) {
  const datasets = Array.isArray(catalog?.datasets) ? catalog.datasets : [];
  if (datasets.length > 0) {
    const normalizedDatasets = datasets
      .map((dataset) => ({
        id: String(dataset.id || "").trim(),
        label: String(dataset.label || dataset.id || "").trim(),
        description: String(dataset.description || "").trim(),
        checked: Boolean(dataset.defaultSelected),
        rowCount: Number(dataset.rowCount || 0),
        orgCount: Number(dataset.orgCount || 0),
        minDate: dataset.minDate || null,
        maxDate: dataset.maxDate || null,
        lastUpdatedAt: dataset.lastUpdatedAt || null,
        status: String(dataset.status || "unknown").trim(),
        periodMode: String(dataset.periodMode || "snapshot").trim(),
        relationName: String(dataset.relationName || "").trim(),
      }))
      .filter((dataset) => PREDICTION_RELEVANT_DATASET_IDS.has(dataset.id));
    if (!normalizedDatasets.some((dataset) => dataset.id === "org_scope")) {
      normalizedDatasets.push({
        id: "org_scope",
        label: "组织范围",
        description: "租户成员可见组织隔离边界",
        checked: true,
        rowCount: Number(catalog?.orgScope?.count || 0),
        orgCount: Number(catalog?.orgScope?.count || 0),
        minDate: null,
        maxDate: null,
        lastUpdatedAt: null,
        status: "available",
        periodMode: "snapshot",
        relationName: "",
      });
    }
    return normalizedDatasets;
  }
  return getMetadataOptions(payload);
}

function normalizeRecommendedInputPeriod(catalog) {
  const startDate = normalizeCatalogDate(catalog?.recommendedInputPeriod?.startDate);
  const endDate = normalizeCatalogDate(catalog?.recommendedInputPeriod?.endDate);
  const source = String(catalog?.recommendedInputPeriod?.source || "").trim();
  if (!startDate || !endDate || !source) {
    return null;
  }
  return {
    startDate,
    endDate,
    source,
  };
}

function normalizeCatalogDate(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function renderDatasetCard(dataset) {
  const checked = dataset.checked ? "checked" : "";
  const rowCount = Number(dataset.rowCount || 0);
  const periodText =
    dataset.periodMode === "range" && dataset.minDate && dataset.maxDate
      ? `${dataset.minDate} ~ ${dataset.maxDate}`
      : dataset.periodMode === "range"
        ? "所选期间内暂无日期覆盖"
        : "主数据/快照，不按期间过滤";
  return `
    <label class="oc-sandbox-view-metadata" data-dataset-card data-dataset-status="${escapeHtml(dataset.status)}">
      <input type="checkbox" value="${escapeHtml(dataset.id)}" ${checked}>
      <span>
        <strong>${escapeHtml(dataset.label)}</strong>
        <small>${escapeHtml(dataset.description)}</small>
        <em>${escapeHtml(periodText)} · ${formatCompactNumber(rowCount)} 行 · ${escapeHtml(normalizeDatasetStatusLabel(dataset.status))}</em>
      </span>
    </label>`;
}

function normalizeMaterialCandidates(candidates) {
  const items = Array.isArray(candidates?.items) ? candidates.items : [];
  return [...new Map(
    items
      .map((item) => {
        const materialId = String(item?.materialId || item?.id || "").trim();
        if (!materialId) {
          return null;
        }
        const materialName = String(item?.materialName || item?.label || materialId).trim();
        const materialCode = String(item?.materialCode || materialId).trim();
        const searchText = [materialId, materialCode, materialName, item?.keyword]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean)
          .join(" ");
        return [
          materialId,
          {
            materialId,
            materialName,
            materialCode,
            searchText,
            checked: false,
          },
        ];
      })
      .filter(Boolean),
  ).values()];
}

function renderMaterialCandidateCard(candidate) {
  const checked = candidate.checked ? "checked" : "";
  return `
    <label class="oc-sandbox-view-metadata oc-sandbox-view-metadata--material" data-material-candidate-card data-material-id="${escapeAttribute(candidate.materialId)}" data-search-text="${escapeAttribute(candidate.searchText)}">
      <input type="checkbox" data-material-candidate-checkbox="${escapeAttribute(candidate.materialId)}" value="${escapeAttribute(candidate.materialId)}" ${checked}>
      <span>
        <strong>${escapeHtml(candidate.materialName)}</strong>
        <small>${escapeHtml(candidate.materialCode)}</small>
      </span>
    </label>`;
}

function classifyMaterialCandidate(candidate) {
  const name = String(candidate?.materialName || "").trim().toLowerCase();
  const code = String(candidate?.materialCode || "").trim().toLowerCase();
  const text = `${name} ${code}`;
  if (
    /乌龙|红茶|绿茶|茉莉|铁观音|普洱|茶|冻顶|龙井|岩茶|白桃乌龙|桂花乌龙/.test(text)
  ) {
    return "茶基底";
  }
  if (/奶|淡奶油|稀奶油|芝士|炼奶|牛乳|牛奶|乳/.test(text)) {
    return "奶原料";
  }
  if (/纸杯|打包袋|杯|吸管|包装|包材|盖|纸袋|封口/.test(text)) {
    return "包材";
  }
  if (/糖浆|爆爆珠|寒天|晶球|椰果|珍珠|果酱|果泥|小料|辅料/.test(text)) {
    return "辅料";
  }
  return "其他原料";
}

function groupMaterialCandidates(candidates) {
  const groupOrder = ["茶基底", "奶原料", "包材", "辅料", "其他原料"];
  const grouped = new Map(groupOrder.map((label) => [label, []]));
  candidates.forEach((candidate) => {
    const groupLabel = classifyMaterialCandidate(candidate);
    grouped.get(groupLabel)?.push(candidate);
  });
  return groupOrder
    .map((label) => ({
      label,
      items: grouped.get(label) || [],
    }))
    .filter((group) => group.items.length > 0);
}

function renderMaterialCandidateGroups(candidates) {
  return groupMaterialCandidates(candidates)
    .map(
      (group) => `
        <section class="oc-sandbox-material-group" data-sandbox-material-group>
          <header class="oc-sandbox-material-group__header">
            <h3 data-sandbox-material-group-title>${escapeHtml(group.label)}</h3>
            <span>${escapeHtml(String(group.items.length))} 个</span>
          </header>
          <div class="oc-sandbox-view-metadata-grid oc-sandbox-view-metadata-grid--material-group">
            ${group.items.map(renderMaterialCandidateCard).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function closeMaterialPickerModal() {
  const modal = document.querySelector("[data-sandbox-material-picker-modal]");
  if (modal instanceof HTMLElement) {
    modal.remove();
  }
}

function renderMaterialPickerSummary(state) {
  const selectedMaterials = state.materialCandidates.filter((candidate) => candidate.checked);
  const selectedCount = selectedMaterials.length;
  const summaryText =
    selectedCount > 0
      ? selectedMaterials.slice(0, 3).map((candidate) => candidate.materialName).join("、")
      : "运行前至少选择一个真实原料";
  const extraCount = selectedCount > 3 ? `，另 ${selectedCount - 3} 个` : "";
  const countLabel = selectedCount > 0 ? `已选 ${selectedCount} 个原料` : "尚未选择原料";
  return `
    <button type="button" class="oc-sandbox-material-picker-summary" data-sandbox-material-picker-open data-sandbox-material-picker-summary>
      <span class="oc-sandbox-material-picker-summary__eyebrow">原料范围</span>
      <strong>${escapeHtml(countLabel)}</strong>
      <small>${escapeHtml(`${summaryText}${extraCount}`)}</small>
      <em>点击打开选择器，支持搜索和多选</em>
    </button>
  `;
}

function renderMaterialPickerModalContent(state) {
  const query = state.materialCandidateQuery.trim().toLowerCase();
  const visibleCandidates = state.materialCandidates.filter((candidate) =>
    !query || candidate.searchText.includes(query),
  );
  const selectedMaterials = state.materialCandidates.filter((candidate) => candidate.checked);
  const selectedCount = selectedMaterials.length;
  const hasSparseCandidates = state.materialStatus === "ready" && state.materialCandidates.length > 0 && state.materialCandidates.length <= 3;
  return `
    <section class="oc-sandbox-view-modal" data-sandbox-material-picker-modal>
      <div class="oc-sandbox-view-modal-backdrop" data-sandbox-material-picker-close></div>
      <article class="oc-sandbox-view-modal-card oc-sandbox-view-modal-card--material-picker" role="dialog" aria-modal="true" aria-label="选择原料范围">
        <header class="oc-sandbox-view-modal-header">
          <div>
            <p class="oc-sandbox-view-eyebrow">原料范围</p>
            <h2>选择参与模拟的真实原料</h2>
          </div>
          <button type="button" class="oc-sandbox-view-icon-button" data-sandbox-material-picker-close aria-label="关闭">×</button>
        </header>
        <div class="oc-sandbox-material-toolbar oc-sandbox-material-toolbar--modal">
          <input type="search" class="oc-sandbox-view-question oc-sandbox-view-question--search" data-sandbox-material-search placeholder="搜索原料编码或名称" value="${escapeHtml(state.materialCandidateQuery)}">
          <span class="oc-sandbox-material-toolbar__summary">已选 ${escapeHtml(String(selectedCount))} 个，当前显示 ${escapeHtml(String(visibleCandidates.length))} 个</span>
        </div>
        <section class="oc-sandbox-selected-materials" data-sandbox-selected-materials>
          <header class="oc-sandbox-selected-materials__header">
            <strong>已选原料</strong>
            <span>已选 ${escapeHtml(String(selectedCount))} 个</span>
          </header>
          <div class="oc-sandbox-selected-materials__chips">
            ${selectedMaterials.map((candidate) => `<span class="oc-sandbox-selected-materials__chip" data-sandbox-selected-material-chip>${escapeHtml(candidate.materialName)}</span>`).join("")}
          </div>
        </section>
        ${hasSparseCandidates ? `
          <div class="oc-sandbox-view-plan-alert oc-sandbox-view-plan-alert--material" data-sandbox-material-sparse-hint>
            <span>当前历史依据期间仅匹配 <strong>${escapeHtml(String(state.materialCandidates.length))} 个原料</strong>，可切换到更有业务数据的期间后再选择。</span>
            ${state.recommendedInputPeriod ? `<button type="button" class="oc-sandbox-view-ghost" data-sandbox-material-apply-recommended-period>带入推荐期间</button>` : ""}
          </div>
        ` : ""}
        <div class="oc-sandbox-view-metadata-grid oc-sandbox-view-metadata-grid--material-picker" data-sandbox-material-candidates>
          ${renderMaterialCandidateGroups(visibleCandidates)}
        </div>
      </article>
    </section>
  `;
}

function createInitialSimulationState(payload, token) {
  const periods = createDefaultPeriods();
  const datasets = normalizeCatalogDatasets(payload, null);
  return {
    payload,
    token,
    question: DEFAULT_SIMULATION_QUESTION,
    taskType: RECOMMENDED_SIMULATION_QUESTIONS[0].taskType,
    periods,
    datasets,
    materialCandidates: [],
    materialCandidateQuery: "",
    materialCandidateRequestId: 0,
    autoAdjustedToRecommendedPeriod: false,
    periodTouchedByUser: false,
    recommendedInputPeriod: null,
    catalogStatus: token ? "loading" : "fallback",
    catalogMessage: token
      ? "正在读取租户绑定数据源的数据目录"
      : "当前访问缺少数据目录凭证，使用沙盒内置元数据",
    materialStatus: token ? "loading" : "fallback",
    materialMessage: token ? "正在匹配可选原料" : "当前访问缺少原料候选凭证，无法加载原料范围",
  };
}

function readSimulationSpec(root, state) {
  const questionInput = root.querySelector("[data-sandbox-question]");
  const taskTypeInput = root.querySelector("[data-sandbox-task-type]");
  const readDate = (name) => {
    const input = root.querySelector(`[data-sandbox-period="${name}"]`);
    return input instanceof HTMLInputElement ? input.value : state.periods[name];
  };
  const selectedDatasetIds = new Set(
    Array.from(root.querySelectorAll("[data-dataset-card] input:checked")).map((input) => input.value),
  );
  const selectedMaterialIds = new Set(
    state.materialCandidates
      .filter((candidate) => candidate.checked)
      .map((candidate) => candidate.materialId),
  );
  const datasets = state.datasets.map((dataset) => ({
    ...dataset,
    checked: selectedDatasetIds.has(dataset.id),
  }));
  const materialCandidates = state.materialCandidates.map((candidate) => ({
    ...candidate,
    checked: selectedMaterialIds.has(candidate.materialId),
  }));
  return {
    question:
      questionInput instanceof HTMLTextAreaElement && questionInput.value.trim()
        ? questionInput.value.trim()
        : DEFAULT_SIMULATION_QUESTION,
    taskType:
      taskTypeInput instanceof HTMLInputElement && taskTypeInput.value.trim()
        ? taskTypeInput.value.trim()
        : "自定义预测任务",
    inputPeriod: {
      startDate: readDate("inputStartDate"),
      endDate: readDate("inputEndDate"),
    },
    targetPeriod: {
      startDate: readDate("targetStartDate"),
      endDate: readDate("targetEndDate"),
    },
    token: state.token,
    datasets,
    selectedDatasetIds,
    materialCandidates,
    selectedMaterialIds,
  };
}

function hasDemandEvidenceForRun(spec) {
  return spec.datasets.some(
    (dataset) =>
      spec.selectedDatasetIds.has(dataset.id) &&
      DEMAND_EVIDENCE_DATASET_IDS.has(dataset.id) &&
      Number(dataset.rowCount || 0) > 0,
  );
}

function getRecommendedInputPeriodNotice(state, spec) {
  if (state.catalogStatus !== "ready" || hasDemandEvidenceForRun(spec) || !state.recommendedInputPeriod) {
    return "";
  }
  const sourceLabel =
    state.datasets.find((dataset) => dataset.id === state.recommendedInputPeriod.source)?.label ||
    state.recommendedInputPeriod.source;
  return `
    <div class="oc-sandbox-view-plan-alert">
      <span>推荐可运行期间 <strong>${escapeHtml(state.recommendedInputPeriod.startDate)} 至 ${escapeHtml(state.recommendedInputPeriod.endDate)}</strong>（依据：${escapeHtml(sourceLabel)}）</span>
      <button type="button" class="oc-sandbox-view-ghost" data-apply-recommended-period>一键带入</button>
    </div>
  `;
}

function renderSimulationPlan(spec, catalogStatus, state = null) {
  const selectedDatasets = spec.datasets.filter((dataset) => spec.selectedDatasetIds.has(dataset.id));
  const selectedNames = selectedDatasets.map((dataset) => dataset.label).join("、") || "尚未选择";
  const selectedMaterials = spec.materialCandidates.filter((candidate) =>
    spec.selectedMaterialIds.has(candidate.materialId),
  );
  const selectedMaterialNames =
    selectedMaterials.map((candidate) => candidate.materialName).join("、") || "尚未选择";
  const rows = selectedDatasets.reduce((total, dataset) => total + (Number(dataset.rowCount) || 0), 0);
  const planNote =
    catalogStatus === "ready"
      ? "数据目录来自当前租户绑定数据源和成员组织范围。"
      : catalogStatus === "loading"
        ? "正在读取当前租户绑定数据源和成员组织范围的数据目录。"
        : "数据目录未完全就绪，运行时会使用当前可见的沙盒数据兜底。";
  return `
    <div class="oc-sandbox-view-plan-card">
      <span>模拟问题</span>
      <strong>${escapeHtml(spec.question)}</strong>
    </div>
    <div class="oc-sandbox-view-plan-grid">
      <span>历史依据 <strong>${escapeHtml(spec.inputPeriod.startDate)} 至 ${escapeHtml(spec.inputPeriod.endDate)}</strong></span>
      <span>预测期间 <strong>${escapeHtml(spec.targetPeriod.startDate)} 至 ${escapeHtml(spec.targetPeriod.endDate)}</strong></span>
      <span>原料范围 <strong>${escapeHtml(selectedMaterialNames)}</strong></span>
      <span>投入数据 <strong>${escapeHtml(selectedNames)}</strong></span>
      <span>可用行数 <strong>${formatCompactNumber(rows)}</strong></span>
    </div>
    ${state ? getRecommendedInputPeriodNotice(state, spec) : ""}
    <p class="oc-sandbox-view-plan-note">${escapeHtml(planNote)}</p>
  `;
}

function shouldAutoApplyRecommendedPeriod(state) {
  return Boolean(
    !state.autoAdjustedToRecommendedPeriod &&
      !state.periodTouchedByUser &&
      state.recommendedInputPeriod &&
      state.materialCandidates.length > 0 &&
      state.materialCandidates.length <= 3 &&
      (state.periods.inputStartDate !== state.recommendedInputPeriod.startDate ||
        state.periods.inputEndDate !== state.recommendedInputPeriod.endDate),
  );
}

function applyRecommendedInputPeriod(root, state) {
  if (!state.recommendedInputPeriod) {
    return false;
  }
  state.autoAdjustedToRecommendedPeriod = true;
  state.periods.inputStartDate = state.recommendedInputPeriod.startDate;
  state.periods.inputEndDate = state.recommendedInputPeriod.endDate;
  const inputStart = root.querySelector('[data-sandbox-period="inputStartDate"]');
  const inputEnd = root.querySelector('[data-sandbox-period="inputEndDate"]');
  if (inputStart instanceof HTMLInputElement) {
    inputStart.value = state.periods.inputStartDate;
  }
  if (inputEnd instanceof HTMLInputElement) {
    inputEnd.value = state.periods.inputEndDate;
  }
  state.materialMessage = "已自动切换到推荐期间并重新匹配原料";
  updateSimulationPlan(root, state);
  void refreshSandboxDataCatalog(root, state.payload, state);
  void refreshSandboxMaterialCandidates(root, state);
  return true;
}

async function refreshSandboxDataCatalog(root, payload, state) {
  const inputStart = root.querySelector('[data-sandbox-period="inputStartDate"]');
  const inputEnd = root.querySelector('[data-sandbox-period="inputEndDate"]');
  state.periods.inputStartDate = inputStart instanceof HTMLInputElement ? inputStart.value : state.periods.inputStartDate;
  state.periods.inputEndDate = inputEnd instanceof HTMLInputElement ? inputEnd.value : state.periods.inputEndDate;
  state.catalogStatus = "loading";
  state.catalogMessage = "正在刷新数据目录";
  updateSimulationPlan(root, state);
  try {
    const catalog = await loadSandboxDataCatalog(state.token, state.periods);
    state.datasets = normalizeCatalogDatasets(payload, catalog);
    state.recommendedInputPeriod = normalizeRecommendedInputPeriod(catalog);
    state.catalogStatus = "ready";
    state.catalogMessage = `已连接 ${catalog?.dataSourceName || "租户数据源"}，按成员组织范围读取目录`;
    if (shouldAutoApplyRecommendedPeriod(state)) {
      applyRecommendedInputPeriod(root, state);
      return;
    }
  } catch (error) {
    state.datasets = normalizeCatalogDatasets(payload, null);
    state.recommendedInputPeriod = null;
    state.catalogStatus = "fallback";
    state.catalogMessage =
      error instanceof Error && error.message
        ? `数据目录暂不可用：${error.message}`
        : "数据目录暂不可用，已使用沙盒内置元数据";
  }
  const datasetGrid = root.querySelector("[data-sandbox-datasets]");
  if (datasetGrid instanceof HTMLElement) {
    datasetGrid.innerHTML = state.datasets.map(renderDatasetCard).join("");
  }
  updateSimulationPlan(root, state);
}

function renderMaterialCandidates(root, state) {
  const summary = root.querySelector("[data-sandbox-material-picker-summary]");
  if (summary instanceof HTMLElement) {
    summary.outerHTML = renderMaterialPickerSummary(state);
  }
  const modal = document.querySelector("[data-sandbox-material-picker-modal]");
  if (!(modal instanceof HTMLElement)) {
    return;
  }
  modal.outerHTML = renderMaterialPickerModalContent(state);
  bindMaterialPickerModal(root, state);
}

function bindMaterialPickerModal(root, state) {
  const modal = document.querySelector("[data-sandbox-material-picker-modal]");
  if (!(modal instanceof HTMLElement)) {
    return;
  }
  modal.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches("[data-sandbox-material-search]")) {
      state.materialCandidateQuery = target.value;
      renderMaterialCandidates(root, state);
      updateSimulationPlan(root, state);
      void refreshSandboxMaterialCandidates(root, state);
    }
  });
  modal.addEventListener("change", (event) => {
    const target =
      event.target instanceof Element ? event.target.closest("[data-material-candidate-card] input") : null;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    state.materialCandidates = state.materialCandidates.map((candidate) =>
      candidate.materialId === target.value
        ? { ...candidate, checked: target.checked }
        : candidate,
    );
    updateSimulationPlan(root, state);
    renderMaterialCandidates(root, state);
  });
  modal.addEventListener("click", (event) => {
    const applyRecommendedTarget =
      event.target instanceof Element
        ? event.target.closest("[data-sandbox-material-apply-recommended-period]")
        : null;
    if (applyRecommendedTarget instanceof HTMLElement && state.recommendedInputPeriod) {
      const inputStart = root.querySelector('[data-sandbox-period="inputStartDate"]');
      const inputEnd = root.querySelector('[data-sandbox-period="inputEndDate"]');
      if (inputStart instanceof HTMLInputElement) {
        inputStart.value = state.recommendedInputPeriod.startDate;
      }
      if (inputEnd instanceof HTMLInputElement) {
        inputEnd.value = state.recommendedInputPeriod.endDate;
      }
      void refreshSandboxDataCatalog(root, state.payload, state);
      void refreshSandboxMaterialCandidates(root, state);
      return;
    }
    const target =
      event.target instanceof Element
        ? event.target.closest("[data-sandbox-material-picker-close]")
        : null;
    if (target) {
      closeMaterialPickerModal();
      renderMaterialCandidates(root, state);
      updateSimulationPlan(root, state);
    }
  });
}

function openMaterialPickerModal(root, state) {
  closeMaterialPickerModal();
  document.body.insertAdjacentHTML("beforeend", renderMaterialPickerModalContent(state));
  bindMaterialPickerModal(root, state);
}

async function refreshSandboxMaterialCandidates(root, state) {
  const requestId = Number(state.materialCandidateRequestId || 0) + 1;
  state.materialCandidateRequestId = requestId;
  state.materialStatus = "loading";
  state.materialMessage = "正在匹配可选原料";
  updateSimulationPlan(root, state);
  try {
    const candidates = await loadSandboxMaterialCandidates(
      state.token,
      state.periods,
      state.materialCandidateQuery,
    );
    if (requestId !== state.materialCandidateRequestId) {
      return;
    }
    state.materialCandidates = normalizeMaterialCandidates(candidates);
    if (shouldAutoApplyRecommendedPeriod(state)) {
      if (applyRecommendedInputPeriod(root, state)) {
        return;
      }
      return;
    }
    state.materialStatus = "ready";
    state.materialMessage = `已匹配 ${formatCompactNumber(state.materialCandidates.length)} 个可选原料`;
  } catch (error) {
    if (requestId !== state.materialCandidateRequestId) {
      return;
    }
    state.materialCandidates = [];
    state.materialStatus = "fallback";
    state.materialMessage =
      error instanceof Error && error.message
        ? `原料候选暂不可用：${error.message}`
        : "原料候选暂不可用";
  }
  renderMaterialCandidates(root, state);
  updateSimulationPlan(root, state);
}

function updateSimulationPlan(root, state) {
  const plan = root.querySelector("[data-sandbox-plan]");
  const status = root.querySelector("[data-sandbox-catalog-status]");
  const materialStatus = root.querySelector("[data-sandbox-material-status]");
  const spec = readSimulationSpec(root, state);
  state.materialCandidates = state.materialCandidates.map((candidate) => ({
    ...candidate,
    checked: spec.selectedMaterialIds.has(candidate.materialId),
  }));
  if (plan instanceof HTMLElement) {
    plan.innerHTML = renderSimulationPlan(spec, state.catalogStatus, state);
  }
  if (status instanceof HTMLElement) {
    status.textContent = state.catalogMessage;
    status.dataset.catalogStatus = state.catalogStatus;
  }
  if (materialStatus instanceof HTMLElement) {
    materialStatus.textContent = state.materialMessage;
    materialStatus.dataset.catalogStatus = state.materialStatus;
  }
  const summary = root.querySelector("[data-sandbox-material-picker-summary]");
  if (summary instanceof HTMLElement) {
    summary.outerHTML = renderMaterialPickerSummary(state);
  }
}

function updateRunStepState(root, activeIndex, statusMessage = "") {
  const steps = Array.from(root.querySelectorAll("[data-sandbox-run-step]"));
  steps.forEach((step, stepIndex) => {
    step.classList.toggle("is-active", stepIndex === activeIndex);
    step.classList.toggle("is-done", stepIndex < activeIndex);
  });
  if (statusMessage) {
    const status = root.querySelector("[data-sandbox-catalog-status]");
    if (status instanceof HTMLElement) {
      status.textContent = statusMessage;
      status.dataset.catalogStatus = "loading";
    }
  }
}

function inferRunStepIndex(runStatus) {
  const normalized = String(runStatus || "").trim().toLowerCase();
  if (normalized === "queued") {
    return 1;
  }
  if (normalized === "running") {
    return 3;
  }
  if (normalized === "succeeded") {
    return 4;
  }
  return 0;
}

async function pollSandboxRunUntilComplete(root, token, runId) {
  let attempts = 0;
  while (attempts < 60) {
    const status = await loadSandboxRunStatus(token, runId);
    const normalizedStatus = String(status?.status || "running").trim().toLowerCase();
    const statusLabel =
      normalizedStatus === "queued"
        ? "正在排队等待执行"
        : normalizedStatus === "running"
          ? "正在根据已选原料生成模拟结果"
          : `正在执行沙盒模拟：${status?.status || "running"}`;
    updateRunStepState(root, inferRunStepIndex(status?.status), statusLabel);
    if (status?.status === "succeeded" && status?.resultAvailable) {
      return status;
    }
    if (status?.status === "failed") {
      throw new Error(status?.errorMessage || "sandbox_run_failed");
    }
    attempts += 1;
    await new Promise((resolve) => {
      window.setTimeout(resolve, SIMULATION_STEP_DELAY_MS);
    });
  }
  throw new Error("sandbox_run_timeout");
}

function renderSimulationStart(payload, token = "") {
  ensureSurfaceStyle();
  const sandboxName = String(payload?.sandboxName || "沙盒模拟").trim();
  const agentName = String(payload?.agentName || "").trim();
  const state = createInitialSimulationState(payload, token);
  document.title = sandboxName;

  const root = document.createElement("main");
  root.className = "oc-sandbox-view-shell oc-sandbox-view-shell--start";
  root.innerHTML = `
    <section class="oc-sandbox-view-hero">
      <div class="oc-sandbox-view-hero-copy">
        <p class="oc-sandbox-view-eyebrow">经营沙盒 v1</p>
        <h1 class="oc-sandbox-view-title">${escapeHtml(sandboxName)}</h1>
        <p class="oc-sandbox-view-subtitle">${escapeHtml(agentName || "先选择预测目标与投入数据，再生成可解释的采购模拟结果。")}</p>
      </div>
      <div class="oc-sandbox-view-hero-metrics oc-sandbox-view-hero-metrics--inputs" aria-label="模拟输入概览">
        <span>入口模式 <strong>自定义问题</strong></span>
        <span>数据权限 <strong>按成员组织范围</strong></span>
        <span>结果展示 <strong>运行后生成</strong></span>
      </div>
    </section>
    <section class="oc-sandbox-view-start-grid">
      <article class="oc-sandbox-view-panel oc-sandbox-view-wizard">
        <div class="oc-sandbox-view-panel-heading">
          <div>
            <h2 class="oc-sandbox-view-section-title">定义模拟问题</h2>
            <p class="oc-sandbox-view-subtitle">先写下你想验证的经营问题，再选择历史数据期间、预测期间和投入元数据。</p>
          </div>
        </div>
        <textarea class="oc-sandbox-view-question" data-sandbox-question rows="3">${escapeHtml(state.question)}</textarea>
        <input type="hidden" data-sandbox-task-type value="${escapeHtml(state.taskType)}">
        <div class="oc-sandbox-view-choice-grid oc-sandbox-view-choice-grid--questions" data-sandbox-recommended-questions>
          ${RECOMMENDED_SIMULATION_QUESTIONS.map(
            (item, index) => `
              <button type="button" class="oc-sandbox-view-choice ${index === 0 ? "is-selected" : ""}" data-question="${escapeHtml(item.question)}" data-task-type="${escapeHtml(item.taskType)}">
                <strong>${escapeHtml(item.taskType)}</strong>
                <small>${escapeHtml(item.description)}</small>
              </button>`,
          ).join("")}
        </div>
        <div class="oc-sandbox-view-periods">
          <label>历史依据开始 <input type="date" data-sandbox-period="inputStartDate" value="${escapeHtml(state.periods.inputStartDate)}"></label>
          <label>历史依据结束 <input type="date" data-sandbox-period="inputEndDate" value="${escapeHtml(state.periods.inputEndDate)}"></label>
          <label>预测开始 <input type="date" data-sandbox-period="targetStartDate" value="${escapeHtml(state.periods.targetStartDate)}"></label>
          <label>预测结束 <input type="date" data-sandbox-period="targetEndDate" value="${escapeHtml(state.periods.targetEndDate)}"></label>
        </div>
        <div class="oc-sandbox-view-catalog-heading">
          <h3 class="oc-sandbox-view-small-title">投入元数据</h3>
          <span data-sandbox-catalog-status data-catalog-status="${escapeHtml(state.catalogStatus)}">${escapeHtml(state.catalogMessage)}</span>
        </div>
        <div class="oc-sandbox-view-catalog-heading">
          <h3 class="oc-sandbox-view-small-title">选择原料范围</h3>
          <span data-sandbox-material-status data-catalog-status="${escapeHtml(state.materialStatus)}">${escapeHtml(state.materialMessage)}</span>
        </div>
        ${renderMaterialPickerSummary(state)}
        <div class="oc-sandbox-view-metadata-grid" data-sandbox-datasets>
          ${state.datasets.map(renderDatasetCard).join("")}
        </div>
        <h3 class="oc-sandbox-view-small-title">模拟计划预览</h3>
        <div class="oc-sandbox-view-plan" data-sandbox-plan></div>
        <button type="button" class="oc-sandbox-view-primary" data-sandbox-run>开始沙盒模拟</button>
      </article>
      <aside class="oc-sandbox-view-panel oc-sandbox-view-runway">
        <h2 class="oc-sandbox-view-section-title">生成流程</h2>
        <p class="oc-sandbox-view-subtitle">确认后会按下列步骤展开，当前页只展示过程和结果，不会修改业务库。</p>
        <ol class="oc-sandbox-view-run-steps">
          ${["解析自定义问题", "锁定历史与预测期间", "读取成员可见数据目录", "构建原始数据关系", "生成预测与交互结果"].map((step, index) => `<li data-sandbox-run-step="${index}"><span>${index + 1}</span><strong>${step}</strong><i></i></li>`).join("")}
        </ol>
      </aside>
    </section>
  `;

  root.querySelector("[data-sandbox-recommended-questions]")?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-question]") : null;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const question = root.querySelector("[data-sandbox-question]");
    const taskType = root.querySelector("[data-sandbox-task-type]");
    if (question instanceof HTMLTextAreaElement) {
      question.value = target.dataset.question || DEFAULT_SIMULATION_QUESTION;
    }
    if (taskType instanceof HTMLInputElement) {
      taskType.value = target.dataset.taskType || "自定义预测任务";
    }
    root.querySelectorAll("[data-question]").forEach((item) => item.classList.remove("is-selected"));
    target.classList.add("is-selected");
    updateSimulationPlan(root, state);
  });
  root.addEventListener("input", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.matches("[data-sandbox-question]") || target.matches("[data-sandbox-period]"))
    ) {
      if (target.matches("[data-sandbox-period]")) {
        state.periodTouchedByUser = true;
      }
      updateSimulationPlan(root, state);
    }
  });
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.matches('[data-sandbox-period="inputStartDate"], [data-sandbox-period="inputEndDate"]')) {
      state.periodTouchedByUser = true;
      void refreshSandboxDataCatalog(root, payload, state);
      void refreshSandboxMaterialCandidates(root, state);
      return;
    }
    if (
      target.matches("[data-dataset-card] input") ||
      target.matches("[data-sandbox-period]")
    ) {
      updateSimulationPlan(root, state);
      renderMaterialCandidates(root, state);
    }
  });
  root.addEventListener("click", (event) => {
    const materialPickerTarget =
      event.target instanceof Element
        ? event.target.closest("[data-sandbox-material-picker-open]")
        : null;
    if (materialPickerTarget instanceof HTMLElement) {
      openMaterialPickerModal(root, state);
      return;
    }
    const target = event.target instanceof Element ? event.target.closest("[data-apply-recommended-period]") : null;
    if (!(target instanceof HTMLElement) || !state.recommendedInputPeriod) {
      return;
    }
    const inputStart = root.querySelector('[data-sandbox-period="inputStartDate"]');
    const inputEnd = root.querySelector('[data-sandbox-period="inputEndDate"]');
    if (inputStart instanceof HTMLInputElement) {
      inputStart.value = state.recommendedInputPeriod.startDate;
    }
    if (inputEnd instanceof HTMLInputElement) {
      inputEnd.value = state.recommendedInputPeriod.endDate;
    }
    state.periodTouchedByUser = true;
    void refreshSandboxDataCatalog(root, payload, state);
    void refreshSandboxMaterialCandidates(root, state);
  });
  root.querySelector("[data-sandbox-run]")?.addEventListener("click", () => {
    const spec = readSimulationSpec(root, state);
    if (spec.selectedMaterialIds.size === 0) {
      updateSimulationPlan(root, state);
      const status = root.querySelector("[data-sandbox-material-status]");
      if (status instanceof HTMLElement) {
        status.textContent = "请至少选择一个原料后再运行沙盒模拟";
        status.dataset.catalogStatus = "fallback";
      }
      return;
    }
    if (state.catalogStatus === "ready" && !hasDemandEvidenceForRun(spec)) {
      updateSimulationPlan(root, state);
      const status = root.querySelector("[data-sandbox-catalog-status]");
      if (status instanceof HTMLElement) {
        status.textContent =
          "当前历史依据期间没有命中销售订单或销售出库数据，请调整历史依据期间后再运行模拟";
        status.dataset.catalogStatus = "fallback";
      }
      return;
    }
    void runSimulationProgress(root, payload, spec);
  });
  document.body.replaceChildren(root);
  renderMaterialCandidates(root, state);
  updateSimulationPlan(root, state);
  void refreshSandboxDataCatalog(root, payload, state);
  void refreshSandboxMaterialCandidates(root, state);
}

async function runSimulationProgress(root, payload, spec) {
  const button = root.querySelector("[data-sandbox-run]");
  if (button instanceof HTMLButtonElement) {
    button.disabled = true;
    button.textContent = "正在运行...";
  }
  updateRunStepState(root, 0, "正在锁定已选原料并提交模拟任务");
  await Promise.resolve();
  try {
    const run = await submitSandboxRun(spec);
    updateRunStepState(root, 1, `沙盒任务已提交：${run?.runId || "待执行"}`);
    await pollSandboxRunUntilComplete(root, spec.token, run?.runId);
    const resultPayload = await loadSandboxRunResult(spec.token, run?.runId);
    updateRunStepState(root, 4, "沙盒模拟已完成，正在加载结果");
    renderSandboxResults(resultPayload, spec.selectedDatasetIds, spec);
  } catch (error) {
    if (button instanceof HTMLButtonElement) {
      button.disabled = false;
      button.textContent = "开始沙盒模拟";
    }
    const status = root.querySelector("[data-sandbox-catalog-status]");
    if (status instanceof HTMLElement) {
      status.textContent =
        error instanceof Error && error.message
          ? `沙盒模拟执行失败：${error.message}`
          : "沙盒模拟执行失败";
      status.dataset.catalogStatus = "fallback";
    }
  }
}

function renderSandbox(payload, token = "") {
  renderSimulationStart(payload, token);
}

function renderSandboxResults(payload, selectedMetadataIds = null, spec = null) {
  ensureSurfaceStyle();
  const sandboxName = String(payload?.sandboxName || "沙盒模拟").trim();
  const agentName = String(payload?.agentName || "").trim();
  const summary = payload?.summary || {};
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  const report = payload?.report || {};
  const sourceGraph = createSourceRelationshipGraph(payload, selectedMetadataIds);
  const focusState = {
    materialId: "",
    materialName: "",
    metricKey: "",
  };

  document.title = sandboxName;
  const root = document.createElement("main");
  root.className = "oc-sandbox-view-shell";
  root.innerHTML = `
    <header class="oc-sandbox-view-header">
      <div>
        <p class="oc-sandbox-view-eyebrow">沙盒模拟</p>
        <h1 class="oc-sandbox-view-title">${sandboxName}</h1>
        <p class="oc-sandbox-view-subtitle">${agentName || "成员沙盒模拟工作台"} · 点击指标卡片查看完整数据图</p>
      </div>
      <button class="oc-sandbox-view-ghost" type="button" data-sandbox-reset>重新选择输入</button>
    </header>
    ${
      spec
        ? `<section class="oc-sandbox-view-result-spec">
            <span>模拟问题 <strong>${escapeHtml(spec.question)}</strong></span>
            <span>历史依据 <strong>${escapeHtml(spec.inputPeriod.startDate)} 至 ${escapeHtml(spec.inputPeriod.endDate)}</strong></span>
            <span>预测期间 <strong>${escapeHtml(spec.targetPeriod.startDate)} 至 ${escapeHtml(spec.targetPeriod.endDate)}</strong></span>
          </section>`
        : ""
    }
  `;

  const metrics = document.createElement("section");
  metrics.className = "oc-sandbox-view-metrics";
  const metricEntries = [
    { label: "预测需求", value: formatNumber(summary.forecastDemandQty), key: "forecast", description: "点击查看需求 Top 物料" },
    { label: "建议采购量", value: formatNumber(summary.recommendedPurchaseQty), key: "purchase", description: "点击查看建议采购结构" },
    { label: "预计采购成本", value: formatNumber(summary.estimatedPurchaseCost), key: "cost", description: "点击查看成本分布" },
    { label: "缺料风险", value: normalizeRiskLabel(summary.shortageRiskLevel), key: "risk", description: "点击查看风险占比" },
  ];
  metricEntries.forEach((entry) => {
    const metric = createMetric(entry.label, entry.value, entry.description);
    metric.dataset.metricKey = entry.key;
    metrics.append(metric);
  });

  const grid = document.createElement("section");
  grid.className = "oc-sandbox-view-grid";

  const left = document.createElement("section");
  left.className = "oc-sandbox-view-panel";
  left.innerHTML = `
    <div class="oc-sandbox-view-panel-heading">
      <div>
        <h2 class="oc-sandbox-view-section-title">知识图谱</h2>
        <p class="oc-sandbox-view-graph-status" data-sandbox-graph-status>原始数据关系</p>
      </div>
      <button class="oc-sandbox-view-graph-replay" type="button" data-sandbox-graph-play>重播关系展开</button>
    </div>
    <div class="oc-sandbox-view-graph-steps">
      ${["读取场景", "载入组织范围", "连接业务单据", "展开物料关系", "完成关系图谱"].map((step) => `<span data-sandbox-graph-step="${step}">${step}</span>`).join("")}
    </div>
    <div id="oc-sandbox-view-graph"></div>
  `;

  const right = document.createElement("section");
  right.className = "oc-sandbox-view-panel";
  const rowsHtml = recommendations
    .map(
      (item) => `
        <tr data-recommendation-row data-material-id="${escapeAttribute(item.materialId || "")}" data-material-name="${escapeAttribute(getMaterialDisplayName(item))}">
          <td>${escapeHtml(item.materialId || "-")}</td>
          <td>${escapeHtml(getMaterialDisplayName(item))}</td>
          <td>${formatNumber(item.recommendedQty)}</td>
          <td>${formatNumber(item.estimatedCost)}</td>
        </tr>`,
    )
    .join("");
  const bulletsHtml = Array.isArray(report.bullets)
    ? report.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "";
  right.innerHTML = `
    <h2 class="oc-sandbox-view-section-title">采购建议</h2>
    <p class="oc-sandbox-view-subtitle oc-sandbox-view-focus-caption" data-sandbox-focus-caption>当前聚焦 全部物料</p>
    <table class="oc-sandbox-view-table">
      <thead>
        <tr>
          <th>物料编码</th>
          <th>物料名称</th>
          <th>建议数量</th>
          <th>预计成本</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <h2 class="oc-sandbox-view-section-title" style="margin-top:18px;">解释报告</h2>
    <p class="oc-sandbox-view-subtitle">${escapeHtml(report.headline || "")}</p>
    <ul class="oc-sandbox-view-report">${bulletsHtml}</ul>
  `;

  grid.append(left, right);
  root.append(metrics, grid);
  document.body.replaceChildren(root);
  metrics.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-metric-label]") : null;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const metricKey = target.dataset.metricKey || "forecast";
    const metricLabel = target.dataset.metricLabel || "预测需求";
    const ranked = [...recommendations].sort((left, right) => {
      const metricField =
        metricKey === "purchase"
          ? "recommendedQty"
          : metricKey === "cost"
            ? "estimatedCost"
            : metricKey === "risk"
              ? "riskLevel"
              : "predictedDemandQty";
      if (metricField === "riskLevel") {
        const riskScore = (value) => {
          const normalized = String(value || "").toLowerCase();
          if (normalized === "high") {
            return 3;
          }
          if (normalized === "medium") {
            return 2;
          }
          return 1;
        };
        return riskScore(right?.riskLevel) - riskScore(left?.riskLevel);
      }
      return Number(right?.[metricField] || 0) - Number(left?.[metricField] || 0);
    });
    const topItem = ranked[0] || null;
    if (topItem?.materialId) {
      focusState.materialId = String(topItem.materialId);
      focusState.materialName = getMaterialDisplayName(topItem);
      focusState.metricKey = metricKey;
      const caption = root.querySelector("[data-sandbox-focus-caption]");
      if (caption instanceof HTMLElement) {
        caption.textContent = `当前聚焦 ${focusState.materialName}`;
      }
      root.querySelectorAll("[data-recommendation-row]").forEach((row) => {
        if (!(row instanceof HTMLElement)) {
          return;
        }
        row.classList.toggle("is-active", row.dataset.materialId === focusState.materialId);
      });
      syncGraphFocus(sourceGraph, focusState);
    }
    openMetricChartModal(metricKey, metricLabel, recommendations);
  });
  right.querySelector("tbody")?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-recommendation-row]") : null;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    focusState.materialId = String(target.dataset.materialId || "").trim();
    focusState.materialName = String(target.dataset.materialName || "").trim() || "未命名物料";
    focusState.metricKey = "";
    right.querySelectorAll("[data-recommendation-row]").forEach((row) => {
      row.classList.toggle("is-active", row === target);
    });
    const caption = root.querySelector("[data-sandbox-focus-caption]");
    if (caption instanceof HTMLElement) {
      caption.textContent = `当前聚焦 ${focusState.materialName}`;
    }
    syncGraphFocus(sourceGraph, focusState);
  });
  root.querySelector("[data-sandbox-reset]")?.addEventListener("click", () => renderSimulationStart(payload, spec?.token || ""));
  left.querySelector("[data-sandbox-graph-play]")?.addEventListener("click", () => {
    if (window.__openclawSandboxGraphInstance && window.__openclawSandboxGraphReplayStages) {
      startGraphReplay(
        window.__openclawSandboxGraphInstance,
        window.__openclawSandboxGraphReplayStages,
      );
      if (sandboxGraphFocusState?.materialId) {
        window.setTimeout(() => syncGraphFocus(sourceGraph, sandboxGraphFocusState), GRAPH_REPLAY_DELAY_MS * 5);
      }
    }
  });
  void renderGraph(sourceGraph);
}

export async function bootSandboxViewSurface() {
  if (window.__openclawSandboxViewSurfaceBooted) {
    return null;
  }
  window.__openclawSandboxViewSurfaceBooted = true;

  if (!isSandboxViewPublicPath(window.location.pathname)) {
    return null;
  }

  const token = readSandboxViewToken();
  normalizeLocation();
  ensureSurfaceStyle();
  clearHost();
  if (!token) {
    showState({
      eyebrow: "沙盒模拟",
      title: "请选择一个沙盒模拟",
      message: "请从成员侧边栏的“沙盒模拟”进入，系统会自动携带本次模拟访问凭证。",
    });
    return null;
  }

  try {
    showState({
      eyebrow: "沙盒模拟",
      title: "正在装载模拟场景",
      message: "正在读取图谱、预测结果和采购建议。",
    });
    const payload = await loadSandboxPayload(token);
    if (!payload) {
      throw new Error("sandbox_payload_empty");
    }
    normalizeTokenLocation(token);
    renderSandbox(payload, token);
    return payload;
  } catch {
    showState({
      eyebrow: "沙盒模拟",
      title: "沙盒加载失败",
      message: "当前访问凭证不可用，返回成员侧边栏后可重新打开。",
    });
    return null;
  }
}

const PAGE_SELECTOR = "[data-oc-knowledge-graph-page]";

const DEFAULT_NODES = [
  { id: "entity-a", name: "实体A", type: "核心实体", description: "图谱的中心实体，用来串联上下游关系。", color: "#5f94db" },
  { id: "entity-b", name: "实体B", type: "关联实体", description: "与核心实体直接关联，可理解为一级邻居。", color: "#65c7d1" },
  { id: "entity-c", name: "实体C", type: "关联实体", description: "与实体A和实体B形成闭环，便于观察联动。", color: "#87a7ff" },
  { id: "entity-note", name: "文档索引", type: "文档", description: "承接类似 Obsidian 的笔记节点和知识片段。", color: "#f2d5a6" },
  { id: "entity-tag", name: "主题标签", type: "概念", description: "用于聚合同主题的实体和知识分支。", color: "#9d7df2" },
  { id: "entity-task", name: "行动事项", type: "流程", description: "把图谱里的抽象关系落到可执行动作上。", color: "#78d3ad" },
];

const DEFAULT_LINKS = [
  { source: "entity-a", target: "entity-b", label: "关联" },
  { source: "entity-a", target: "entity-c", label: "支撑" },
  { source: "entity-b", target: "entity-c", label: "引用" },
  { source: "entity-a", target: "entity-note", label: "映射" },
  { source: "entity-note", target: "entity-tag", label: "提炼" },
  { source: "entity-a", target: "entity-task", label: "驱动" },
];

const TYPE_COLOR_FALLBACKS = {
  核心实体: "#5f94db",
  关联实体: "#65c7d1",
  文档: "#f2d5a6",
  概念: "#9d7df2",
  流程: "#78d3ad",
};

function cloneNode(node) {
  return { ...node };
}

function cloneLink(link) {
  return { ...link };
}

function normalizeEntityId(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueEntityId(base, nodes) {
  const normalized = normalizeEntityId(base) || "entity";
  const usedIds = new Set(nodes.map((node) => node.id));
  if (!usedIds.has(normalized)) {
    return normalized;
  }

  let index = 2;
  while (usedIds.has(`${normalized}-${index}`)) {
    index += 1;
  }
  return `${normalized}-${index}`;
}

function pickNodeColor(type, explicitColor) {
  return explicitColor || TYPE_COLOR_FALLBACKS[type] || "#6ca8ff";
}

export function createKnowledgeGraphState(seed) {
  const nodes = (seed?.nodes ?? DEFAULT_NODES).map(cloneNode);
  const links = (seed?.links ?? DEFAULT_LINKS).map(cloneLink);
  return {
    nodes,
    links,
    selectedId: seed?.selectedId ?? nodes[0]?.id ?? null,
  };
}

function getNodeById(state, nodeId) {
  return state.nodes.find((node) => node.id === nodeId) ?? null;
}

export function getSelectionFocus(state, selectedId) {
  const nodeIds = new Set();
  const linkIndexes = new Set();
  if (!selectedId) {
    return { nodeIds, linkIndexes };
  }

  nodeIds.add(selectedId);
  state.links.forEach((link, index) => {
    if (link.source === selectedId || link.target === selectedId) {
      nodeIds.add(link.source);
      nodeIds.add(link.target);
      linkIndexes.add(index);
    }
  });

  return { nodeIds, linkIndexes };
}

export function listDirectConnections(state, selectedId) {
  const groups = new Map();
  if (!selectedId) {
    return [];
  }

  for (const link of state.links) {
    if (link.source !== selectedId && link.target !== selectedId) {
      continue;
    }

    const otherId = link.source === selectedId ? link.target : link.source;
    const otherNode = getNodeById(state, otherId);
    if (!otherNode) {
      continue;
    }

    const current = groups.get(otherId) ?? { node: otherNode, labels: [] };
    current.labels.push(link.label || "关联");
    groups.set(otherId, current);
  }

  return Array.from(groups.values());
}

export function buildKnowledgeGraphOption(state) {
  const selectedId = state.selectedId;
  const { nodeIds: focusNodeIds, linkIndexes } = getSelectionFocus(state, selectedId);
  const hasFocus = Boolean(selectedId);

  return {
    animationDurationUpdate: 480,
    animationEasingUpdate: "quarticOut",
    tooltip: {
      backgroundColor: "rgba(19, 31, 47, 0.92)",
      borderColor: "rgba(151, 190, 238, 0.26)",
      textStyle: { color: "#eef6ff" },
      formatter(params) {
        if (params.dataType === "edge") {
          return `${params.data.source} → ${params.data.target}<br/>${params.data.label || "关联"}`;
        }
        const data = params.data;
        return `
          <strong>${data.name}</strong><br/>
          <span>${data.type || "未分类"}</span><br/>
          <span>${data.description || "暂无描述"}</span>
        `;
      },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        animation: true,
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: 7,
        emphasis: {
          focus: "adjacency",
          scale: true,
        },
        force: {
          repulsion: 420,
          edgeLength: [120, 220],
          gravity: 0.06,
          friction: 0.16,
        },
        label: {
          show: true,
          position: "inside",
          color: "#f7fbff",
          fontWeight: 700,
          fontSize: 12,
        },
        edgeLabel: {
          show: true,
          fontSize: 11,
          color: "#607996",
          formatter: ({ data }) => data.label || "",
        },
        lineStyle: {
          curveness: 0.18,
          width: 2,
          color: "rgba(104, 142, 192, 0.6)",
        },
        data: state.nodes.map((node) => {
          const active = !hasFocus || focusNodeIds.has(node.id);
          const isSelected = node.id === selectedId;
          return {
            id: node.id,
            name: node.name,
            type: node.type,
            description: node.description,
            symbolSize: isSelected ? 82 : active ? 66 : 54,
            itemStyle: {
              color: pickNodeColor(node.type, node.color),
              opacity: active ? 1 : 0.14,
              borderColor: isSelected ? "#ffffff" : "rgba(255,255,255,0.7)",
              borderWidth: isSelected ? 3 : active ? 1.5 : 1,
              shadowBlur: isSelected ? 26 : active ? 16 : 0,
              shadowColor: isSelected ? "rgba(123, 183, 255, 0.38)" : "rgba(98, 139, 204, 0.12)",
            },
            label: {
              opacity: active ? 1 : 0.26,
            },
          };
        }),
        links: state.links.map((link, index) => {
          const active = !hasFocus || linkIndexes.has(index);
          return {
            ...link,
            lineStyle: {
              width: active ? 2.8 : 1.2,
              opacity: active ? 0.92 : 0.08,
              color: active ? "rgba(103, 148, 210, 0.76)" : "rgba(103, 148, 210, 0.12)",
              curveness: 0.18,
            },
            edgeLabel: {
              opacity: active ? 0.96 : 0.12,
            },
          };
        }),
      },
    ],
  };
}

export function addKnowledgeEntity(state, input) {
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new Error("实体名称不能为空。");
  }

  const type = String(input.type ?? "").trim() || "未分类";
  const node = {
    id: uniqueEntityId(name, state.nodes),
    name,
    type,
    description: String(input.description ?? "").trim(),
    color: pickNodeColor(type, String(input.color ?? "").trim()),
  };
  state.nodes.push(node);

  const connectTo = String(input.connectToId ?? "").trim();
  const relationLabel = String(input.relationLabel ?? "").trim();
  if (connectTo) {
    addKnowledgeRelation(state, {
      sourceId: connectTo,
      targetId: node.id,
      label: relationLabel || "关联",
    });
  }

  state.selectedId = node.id;
  return node;
}

export function addKnowledgeRelation(state, input) {
  const sourceId = String(input.sourceId ?? "").trim();
  const targetId = String(input.targetId ?? "").trim();
  const label = String(input.label ?? "").trim() || "关联";

  if (!sourceId || !targetId) {
    throw new Error("关系的起点和终点都不能为空。");
  }
  if (sourceId === targetId) {
    throw new Error("同一个实体不能连接到自己。");
  }
  if (!getNodeById(state, sourceId) || !getNodeById(state, targetId)) {
    throw new Error("关系中的实体不存在。");
  }

  const duplicate = state.links.some(
    (link) =>
      link.source === sourceId &&
      link.target === targetId &&
      (link.label || "关联") === label,
  );
  if (duplicate) {
    return null;
  }

  const relation = { source: sourceId, target: targetId, label };
  state.links.push(relation);
  return relation;
}

function renderDetailCard(root, state, onSelectNeighbor) {
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const selected = getNodeById(state, state.selectedId);
  if (!selected) {
    root.innerHTML = `
      <div class="kg-detail__empty">
        选择一个实体后，这里会显示它的类型、描述和直接关联节点。
      </div>
    `;
    return;
  }

  const connections = listDirectConnections(state, selected.id);
  root.innerHTML = `
    <div class="kg-detail__title">
      <span class="kg-detail__chip">${selected.type || "未分类"}</span>
      <h3>${selected.name}</h3>
    </div>
    <div class="kg-detail__meta">
      <div class="kg-detail__row">
        <strong>描述</strong>
        <div>${selected.description || "暂无描述。"}</div>
      </div>
      <div class="kg-detail__row">
        <strong>连接实体</strong>
        <div class="kg-related-list" data-kg-related-list></div>
      </div>
    </div>
  `;

  const list = root.querySelector("[data-kg-related-list]");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  if (connections.length === 0) {
    list.innerHTML = `<span class="kg-detail__empty">当前实体还没有直接连接。</span>`;
    return;
  }

  connections.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${item.node.name} · ${item.labels.join(" / ")}`;
    button.addEventListener("click", () => onSelectNeighbor(item.node.id));
    list.append(button);
  });
}

function updateSelectOptions(select, nodes, placeholder) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const currentValue = select.value;
  const options = [];
  if (placeholder) {
    options.push(`<option value="">${placeholder}</option>`);
  }
  options.push(
    ...nodes.map((node) => `<option value="${node.id}">${node.name} · ${node.type}</option>`),
  );
  select.innerHTML = options.join("");
  if (nodes.some((node) => node.id === currentValue)) {
    select.value = currentValue;
  }
}

function setFeedback(root, message, state = "") {
  if (!(root instanceof HTMLElement)) {
    return;
  }
  root.textContent = message;
  if (state) {
    root.dataset.state = state;
  } else {
    delete root.dataset.state;
  }
}

export function bootKnowledgeGraphPage(root = document.querySelector(PAGE_SELECTOR)) {
  if (!(root instanceof HTMLElement) || root.dataset.ocKnowledgeGraphBooted === "true") {
    return null;
  }
  root.dataset.ocKnowledgeGraphBooted = "true";

  const canvas = root.querySelector("[data-kg-canvas]");
  const feedback = root.querySelector("[data-kg-feedback]");
  const selectedCard = root.querySelector("[data-kg-selected-card]");
  const nodeCount = root.querySelector("[data-kg-stat-nodes]");
  const linkCount = root.querySelector("[data-kg-stat-links]");
  const focusName = root.querySelector("[data-kg-stat-focus]");
  const clearButton = root.querySelector("[data-kg-clear-selection]");
  const resetButton = root.querySelector("[data-kg-reset-graph]");
  const nodeForm = root.querySelector("[data-kg-node-form]");
  const linkForm = root.querySelector("[data-kg-link-form]");

  if (!(canvas instanceof HTMLElement)) {
    return null;
  }

  const echartsApi = window.echarts;
  if (!echartsApi) {
    setFeedback(feedback, "ECharts 没有加载成功，知识图谱页无法渲染。", "error");
    canvas.textContent = "ECharts 未加载";
    return null;
  }

  const state = createKnowledgeGraphState();
  const chart = echartsApi.init(canvas, null, { renderer: "canvas" });

  const syncFormOptions = () => {
    if (!(nodeForm instanceof HTMLFormElement) || !(linkForm instanceof HTMLFormElement)) {
      return;
    }
    updateSelectOptions(nodeForm.elements.namedItem("connectTo"), state.nodes, "暂不关联");
    updateSelectOptions(linkForm.elements.namedItem("sourceId"), state.nodes, "");
    updateSelectOptions(linkForm.elements.namedItem("targetId"), state.nodes, "");

    const sourceSelect = linkForm.elements.namedItem("sourceId");
    const targetSelect = linkForm.elements.namedItem("targetId");
    if (sourceSelect instanceof HTMLSelectElement && state.selectedId) {
      sourceSelect.value = state.selectedId;
    }
    if (targetSelect instanceof HTMLSelectElement && !targetSelect.value && state.nodes[1]) {
      targetSelect.value = state.nodes[1].id;
    }
  };

  const render = () => {
    chart.setOption(buildKnowledgeGraphOption(state), true);
    renderDetailCard(selectedCard, state, (nodeId) => {
      state.selectedId = nodeId;
      render();
    });
    if (nodeCount instanceof HTMLElement) {
      nodeCount.textContent = String(state.nodes.length);
    }
    if (linkCount instanceof HTMLElement) {
      linkCount.textContent = String(state.links.length);
    }
    if (focusName instanceof HTMLElement) {
      focusName.textContent = getNodeById(state, state.selectedId)?.name || "未选中";
    }
    syncFormOptions();
  };

  chart.on("click", (params) => {
    if (params.dataType !== "node") {
      return;
    }
    state.selectedId = params.data.id;
    render();
  });

  chart.getZr().on("click", (event) => {
    if (event.target) {
      return;
    }
    state.selectedId = null;
    render();
  });

  clearButton?.addEventListener("click", () => {
    state.selectedId = null;
    setFeedback(feedback, "已取消当前实体焦点。", "success");
    render();
  });

  resetButton?.addEventListener("click", () => {
    chart.dispatchAction({ type: "restore" });
    setFeedback(feedback, "图谱布局已重置。", "success");
    render();
  });

  nodeForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(nodeForm instanceof HTMLFormElement)) {
      return;
    }

    try {
      const formData = new FormData(nodeForm);
      const node = addKnowledgeEntity(state, {
        name: formData.get("name"),
        type: formData.get("type"),
        description: formData.get("description"),
        color: formData.get("color"),
        connectToId: formData.get("connectTo"),
        relationLabel: formData.get("relationLabel"),
      });
      nodeForm.reset();
      const colorInput = nodeForm.elements.namedItem("color");
      if (colorInput instanceof HTMLInputElement) {
        colorInput.value = "#6ca8ff";
      }
      setFeedback(feedback, `已添加实体“${node.name}”。`, "success");
      render();
    } catch (error) {
      setFeedback(feedback, error instanceof Error ? error.message : String(error), "error");
    }
  });

  linkForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(linkForm instanceof HTMLFormElement)) {
      return;
    }

    try {
      const formData = new FormData(linkForm);
      const relation = addKnowledgeRelation(state, {
        sourceId: formData.get("sourceId"),
        targetId: formData.get("targetId"),
        label: formData.get("label"),
      });
      setFeedback(
        feedback,
        relation ? `已建立“${relation.label}”关系。` : "这条关系已经存在，未重复添加。",
        "success",
      );
      render();
    } catch (error) {
      setFeedback(feedback, error instanceof Error ? error.message : String(error), "error");
    }
  });

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => chart.resize())
      : null;
  resizeObserver?.observe(canvas);
  window.addEventListener("resize", () => chart.resize());

  render();
  setFeedback(feedback, "知识图谱已就绪，可以直接新增实体和关系。");

  return { chart, state };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        bootKnowledgeGraphPage();
      },
      { once: true },
    );
  } else {
    bootKnowledgeGraphPage();
  }
}

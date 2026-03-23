import {
  escapeHtml,
  toDisplayString,
  truncateString,
} from "../framework/shared.js";
import {
  insertPromptIntoChatBox,
  sendPromptToChat,
} from "../framework/chat-composer.js";

let detailModalElements = null;

function cloneSerializableValue(value, seen = new WeakSet(), depth = 0) {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "function") {
    return "[Function]";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (depth >= 4) {
    return "[MaxDepth]";
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value
        .slice(0, 60)
        .map((item) => cloneSerializableValue(item, seen, depth + 1));
    }

    const result = {};
    const entries = Object.entries(value).slice(0, 60);
    for (const [key, child] of entries) {
      result[key] = cloneSerializableValue(child, seen, depth + 1);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function stringifyDetailJson(value) {
  if (typeof value === "undefined") {
    return "";
  }

  try {
    return JSON.stringify(cloneSerializableValue(value), null, 2);
  } catch {
    return toDisplayString(value);
  }
}

function isSafeCssColor(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]{1,64}\)|hsla?\([^)]{1,64}\)|[a-zA-Z]{3,24})$/.test(
    text,
  );
}

function formatDetailValueHtml(value, options = {}) {
  if (typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  if (options.colorSwatch && typeof value === "string" && isSafeCssColor(value)) {
    return `
      <span class="oc-echarts-detail-modal__swatch">
        <span class="oc-echarts-detail-modal__swatch-chip" style="background:${escapeHtml(value)}"></span>
        <span class="oc-echarts-detail-modal__value--mono">${escapeHtml(value)}</span>
      </span>
    `;
  }

  const text = options.mono
    ? toDisplayString(value)
    : truncateString(toDisplayString(value), 220);
  const className = options.mono
    ? "oc-echarts-detail-modal__value oc-echarts-detail-modal__value--mono"
    : "oc-echarts-detail-modal__value";
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function buildDetailCardsHtml(rows, uiText) {
  const visibleRows = rows.filter(
    (row) =>
      typeof row.value !== "undefined" &&
      row.value !== null &&
      row.value !== "",
  );
  if (visibleRows.length === 0) {
    return `<div class="oc-echarts-detail-modal__empty">${escapeHtml(uiText.detailNoData)}</div>`;
  }

  return `
    <div class="oc-echarts-detail-modal__grid">
      ${visibleRows
        .map(
          (row) => `
            <section class="oc-echarts-detail-modal__card">
              <div class="oc-echarts-detail-modal__label">${escapeHtml(row.label)}</div>
              <div class="oc-echarts-detail-modal__value">
                ${formatDetailValueHtml(row.value, row.options)}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function formatPromptValue(value) {
  if (typeof value === "undefined" || value === null || value === "") {
    return "";
  }

  if (typeof value === "object") {
    return truncateString(
      stringifyDetailJson(value).replace(/\s+/g, " ").trim(),
      320,
    );
  }

  return truncateString(toDisplayString(value), 220);
}

function buildDetailPrompt(params, uiText) {
  const lines = [uiText.detailPromptLead];
  const visibleRows = extractClickDetailRows(params, uiText).filter(
    (row) =>
      typeof row.value !== "undefined" &&
      row.value !== null &&
      row.value !== "",
  );

  visibleRows.forEach((row) => {
    const value = formatPromptValue(row.value);
    if (value) {
      lines.push(`- ${row.label}：${value}`);
    }
  });

  const dataValue = formatPromptValue(params.data);
  if (dataValue) {
    lines.push(`- ${uiText.detailPromptData}：${dataValue}`);
  }

  return lines.join("\n");
}

function extractClickDetailRows(params, uiText) {
  return [
    { label: uiText.detailSeries, value: params.seriesName },
    { label: uiText.detailName, value: params.name },
    {
      label: uiText.detailValue,
      value: params.value,
      options: {
        mono: Array.isArray(params.value) || typeof params.value === "object",
      },
    },
    { label: uiText.detailComponent, value: params.componentType },
    { label: uiText.detailSeriesType, value: params.seriesType },
    { label: uiText.detailDataType, value: params.dataType },
    {
      label: uiText.detailDataIndex,
      value: params.dataIndex,
      options: { mono: true },
    },
    {
      label: uiText.detailColor,
      value: typeof params.color === "string" ? params.color : undefined,
      options: { colorSwatch: true },
    },
  ];
}

function ensureDetailModal(uiText) {
  if (detailModalElements?.root?.isConnected) {
    return detailModalElements;
  }

  const root = document.createElement("div");
  root.className = "oc-echarts-detail-modal";
  root.hidden = true;
  root.innerHTML = `
    <div class="oc-echarts-detail-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="oc-echarts-detail-title">
      <div class="oc-echarts-detail-modal__header">
        <h3 id="oc-echarts-detail-title" class="oc-echarts-detail-modal__title">${escapeHtml(uiText.detailTitle)}</h3>
        <button type="button" class="oc-echarts-detail-modal__close">${escapeHtml(uiText.detailClose)}</button>
      </div>
      <div class="oc-echarts-detail-modal__body">
        <div class="oc-echarts-detail-modal__actions">
          <button type="button" class="oc-echarts-detail-modal__action" data-variant="primary">${escapeHtml(uiText.detailActionAsk)}</button>
          <button type="button" class="oc-echarts-detail-modal__action" data-variant="secondary">${escapeHtml(uiText.detailActionInsert)}</button>
        </div>
        <div class="oc-echarts-detail-modal__content"></div>
      </div>
    </div>
  `;

  const content = root.querySelector(".oc-echarts-detail-modal__content");
  const closeButton = root.querySelector(".oc-echarts-detail-modal__close");
  const askButton = root.querySelector(
    '.oc-echarts-detail-modal__action[data-variant="primary"]',
  );
  const insertButton = root.querySelector(
    '.oc-echarts-detail-modal__action[data-variant="secondary"]',
  );

  const closeModal = () => {
    root.hidden = true;
  };

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      closeModal();
    }
  });

  closeButton?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.hidden) {
      closeModal();
    }
  });

  document.body.append(root);
  detailModalElements = {
    root,
    content,
    closeModal,
    askButton,
    insertButton,
  };
  return detailModalElements;
}

export function openChartDetailModal(params, uiText) {
  const modal = ensureDetailModal(uiText);
  const detailRows = extractClickDetailRows(params, uiText);
  const promptText = buildDetailPrompt(params, uiText);

  // const rawData = stringifyDetailJson(params.data);
  // const rawParams = stringifyDetailJson({
  //   componentType: params.componentType,
  //   componentSubType: params.componentSubType,
  //   seriesType: params.seriesType,
  //   seriesIndex: params.seriesIndex,
  //   seriesName: params.seriesName,
  //   name: params.name,
  //   value: params.value,
  //   dataIndex: params.dataIndex,
  //   dataType: params.dataType,
  //   color: params.color,
  //   dimensionNames: params.dimensionNames,
  //   encode: params.encode,
  //   percent: params.percent,
  // });

  modal.content.innerHTML = buildDetailCardsHtml(detailRows, uiText);

  const bindAction = (button, action, label) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.textContent = label;
    button.onclick = () => {
      void action(promptText).then((ok) => {
        if (ok) {
          modal.closeModal();
        }
      });
    };
  };

  bindAction(modal.askButton, sendPromptToChat, uiText.detailActionAsk);
  bindAction(modal.insertButton, insertPromptIntoChatBox, uiText.detailActionInsert);

  modal.root.hidden = false;
}

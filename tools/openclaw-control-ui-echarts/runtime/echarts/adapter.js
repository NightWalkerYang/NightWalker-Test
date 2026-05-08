import { insertPromptIntoChatBox, sendPromptToChat } from "../framework/chat-composer.js";
import { openChartDetailModal } from "./detail-modal.js";
import { createLibraryLoader } from "./libraries.js";
import {
  ECHARTS_LANGUAGE_ALIASES,
  localizeErrorMessage,
  parseEchartsPayload,
  resolveChartHeight,
} from "./parser.js";
import { buildChartPrompt } from "./prompt.js";
import { getEchartsStyles } from "./styles.js";
import { UI_TEXT } from "./ui-text.js";

function createFallbackPrompt(source) {
  const normalized = String(source || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n")
    .slice(0, 360);
  return normalized
    ? `请根据这个图表配置继续分析，并补全缺失字段：\n${normalized}`
    : "请根据这段图表配置继续分析，并补全缺失字段。";
}

function renderFallbackChart(cardEl, detail, source) {
  const wrap = document.createElement("div");
  wrap.className = "oc-echarts-fallback";

  const title = document.createElement("h4");
  title.className = "oc-echarts-fallback__title";
  title.textContent = "图表配置已降级展示";

  const reason = document.createElement("p");
  reason.className = "oc-echarts-fallback__reason";
  reason.textContent = localizeErrorMessage(detail);

  const hint = document.createElement("p");
  hint.className = "oc-echarts-fallback__hint";
  hint.textContent = "卡片保持可用，可继续把修复请求发送到聊天框。";

  const preview = document.createElement("pre");
  preview.className = "oc-echarts-fallback__source";
  preview.textContent = String(source || "").slice(0, 400);

  wrap.append(title, reason, hint, preview);
  cardEl.replaceChildren(wrap);
}

export function createEchartsAdapter({ vendorBaseUrl }) {
  const ensureLibraries = createLibraryLoader(vendorBaseUrl);

  return {
    id: "echarts",
    uiText: UI_TEXT,
    languageAliases: ECHARTS_LANGUAGE_ALIASES,
    getStyles: getEchartsStyles,
    preload() {
      return ensureLibraries();
    },
    ensureReady: ensureLibraries,
    localizeErrorMessage,
    disposeState(state) {
      if (!state) {
        return;
      }

      try {
        state.resizeObserver?.disconnect();
      } catch {
        // Ignore cleanup issues from detached nodes.
      }

      try {
        state.instance?.dispose();
      } catch {
        // Ignore ECharts cleanup issues on partially initialized charts.
      }
    },
    onSourceToggle(state) {
      if (!state?.instance) {
        return;
      }

      queueMicrotask(() => {
        try {
          state.instance.resize();
        } catch {
          // Ignore transient resize failures while layout settles.
        }
      });
    },
    onViewportResize(state) {
      if (!state?.instance) {
        return;
      }
      try {
        state.instance.resize();
      } catch {
        // Ignore resize failures while the UI remounts.
      }
    },
    async renderContent({ source, wrapper, host, context, renderHostScaffold }) {
      const { echarts, json5 } = context;
      let payload = null;
      let parseErrorDetail = "";
      try {
        payload = parseEchartsPayload(source, json5, echarts);
      } catch (error) {
        parseErrorDetail =
          error && typeof error.message === "string"
            ? error.message
            : String(error || "Unknown error");
      }
      const promptText = payload
        ? buildChartPrompt(payload, UI_TEXT)
        : createFallbackPrompt(source);

      const chartEl = renderHostScaffold(host, wrapper, "success", "", {
        summaryText: payload ? UI_TEXT.summarySuccess : `${UI_TEXT.summaryError}（已降级）`,
        actions: [
          {
            label: UI_TEXT.actionInsert,
            onClick: () => insertPromptIntoChatBox(promptText),
          },
          {
            label: UI_TEXT.actionAsk,
            onClick: () => sendPromptToChat(promptText),
          },
        ],
      });
      if (!payload) {
        chartEl.style.height = "320px";
        renderFallbackChart(chartEl, parseErrorDetail, source);
        return { instance: null, resizeObserver: null, promptText };
      }
      const option = payload.option;
      chartEl.style.height = `${resolveChartHeight(payload)}px`;

      if (typeof option.backgroundColor === "undefined") {
        option.backgroundColor = "transparent";
      }

      const instance = echarts.init(chartEl, null, { renderer: "canvas" });
      instance.on("click", (params) => {
        try {
          openChartDetailModal(params, UI_TEXT);
        } catch {
          // Ignore modal rendering failures so the chart interaction remains usable.
        }
      });
      instance.setOption(option, true);

      let resizeObserver = null;
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => {
          try {
            instance.resize();
          } catch {
            // Ignore chart resize errors from detached nodes.
          }
        });
        resizeObserver.observe(chartEl);
      }

      return { instance, resizeObserver, promptText };
    },
  };
}

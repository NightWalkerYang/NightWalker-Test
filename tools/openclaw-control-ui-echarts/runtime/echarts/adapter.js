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

export function createEchartsAdapter({ vendorBaseUrl }) {
  const ensureLibraries = createLibraryLoader(vendorBaseUrl);

  return {
    id: "echarts",
    uiText: UI_TEXT,
    languageAliases: ECHARTS_LANGUAGE_ALIASES,
    getStyles: getEchartsStyles,
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
      const payload = parseEchartsPayload(source, json5, echarts);
      const option = payload.option;
      const promptText = buildChartPrompt(payload, UI_TEXT);

      const chartEl = renderHostScaffold(host, wrapper, "success", "", {
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

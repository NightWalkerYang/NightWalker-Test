import { insertPromptIntoChatBox, sendPromptToChat } from "../framework/chat-composer.js";
import { createJson5Loader } from "../file/libraries.js";
import { getSelectStyles } from "./styles.js";
import {
  detectSelectMode,
  localizeErrorMessage,
  parseSelectPayload,
  SELECT_LANGUAGE_ALIASES,
} from "./parser.js";
import { UI_TEXT } from "./ui-text.js";

function getWrapperLanguage(wrapper) {
  const code = wrapper?.querySelector?.("code");
  if (code instanceof Element) {
    for (const className of code.classList) {
      if (className.startsWith("language-")) {
        return className.slice("language-".length).trim().toLowerCase();
      }
    }
  }

  return String(wrapper?.querySelector?.(".code-block-lang")?.textContent || "")
    .trim()
    .toLowerCase();
}

function createUiText() {
  return {
    badge: UI_TEXT.badge,
    summaryLoading: UI_TEXT.summaryLoading,
    summarySuccess: UI_TEXT.summarySuccessSingle,
    summaryError: UI_TEXT.summaryError,
    loadingTitle: UI_TEXT.loadingTitle,
    loadingRuntimeDetail: UI_TEXT.loadingRuntimeDetail,
    loadingStreamingDetail: UI_TEXT.loadingStreamingDetail,
    errorTitle: UI_TEXT.errorTitle,
  };
}

function getModeLabel(mode) {
  return mode === "multi" ? UI_TEXT.modeMulti : UI_TEXT.modeSingle;
}

function buildSummaryText(payload) {
  return payload.kind === "multi"
    ? `${UI_TEXT.summarySuccessMulti} (${payload.options.length})`
    : `${UI_TEXT.summarySuccessSingle} (${payload.options.length})`;
}

function buildSelectedCountText(payload, selectedCount) {
  if (payload.kind !== "multi") {
    return getModeLabel(payload.kind);
  }
  return UI_TEXT.countSelected.replace("{count}", String(selectedCount));
}

function buildHintText(payload, selectedCount) {
  if (payload.kind === "single") {
    return UI_TEXT.hintSingle;
  }
  if (payload.minSelected > 0 && payload.maxSelected < payload.options.length) {
    return UI_TEXT.hintMultiRange
      .replace("{min}", String(payload.minSelected))
      .replace("{max}", String(payload.maxSelected));
  }
  if (payload.minSelected > 0) {
    return UI_TEXT.hintMultiMin.replace("{min}", String(payload.minSelected));
  }
  return `${UI_TEXT.hintMultiMax.replace("{max}", String(payload.maxSelected))} ${UI_TEXT.countSelected.replace("{count}", String(selectedCount))}`;
}

function composeSelectionPrompt(payload, selectedOptions) {
  const promptLines = selectedOptions
    .map((option) => String(option.prompt || option.label || "").trim())
    .filter(Boolean);
  if (promptLines.length === 0) {
    return "";
  }
  if (payload.kind === "single" || promptLines.length === 1) {
    return promptLines[0];
  }
  return `${UI_TEXT.multiPromptLead}\n${promptLines
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n")}`;
}

function isSelectionValid(payload, selectedValues) {
  if (payload.kind === "single") {
    return selectedValues.size === 1;
  }
  return (
    selectedValues.size >= payload.minSelected &&
    selectedValues.size <= payload.maxSelected
  );
}

function createActionButton(label, variant, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `oc-select-card__button oc-select-card__button--${variant}`;
  button.textContent = label;
  button.setAttribute("data-oc-select-action", action);
  return button;
}

function createSelectCard(payload) {
  const card = document.createElement("section");
  card.className = "oc-select-card";
  card.setAttribute("data-oc-select-card", payload.kind);

  const header = document.createElement("header");
  header.className = "oc-select-card__header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "oc-select-card__title-group";

  const eyebrow = document.createElement("div");
  eyebrow.className = "oc-select-card__eyebrow";
  eyebrow.textContent = getModeLabel(payload.kind);

  const title = document.createElement("h4");
  title.className = "oc-select-card__title";
  title.textContent = payload.title || "请选择下一步动作";

  titleGroup.append(eyebrow, title);

  if (payload.description) {
    const description = document.createElement("p");
    description.className = "oc-select-card__description";
    description.textContent = payload.description;
    titleGroup.append(description);
  }

  const count = document.createElement("div");
  count.className = "oc-select-card__count";
  count.setAttribute("data-oc-select-count", "true");

  header.append(titleGroup, count);

  const options = document.createElement("div");
  options.className = "oc-select-card__options";
  options.setAttribute("data-oc-select-options", "true");

  const footer = document.createElement("footer");
  footer.className = "oc-select-card__footer";

  const hint = document.createElement("div");
  hint.className = "oc-select-card__hint";
  hint.setAttribute("data-oc-select-hint", "true");
  hint.setAttribute("aria-live", "polite");

  const actions = document.createElement("div");
  actions.className = "oc-select-card__actions";

  const insertButton = createActionButton(
    UI_TEXT.actionInsert,
    "secondary",
    "insert",
  );
  const sendButton = createActionButton(
    payload.submitLabel || UI_TEXT.actionSend,
    "primary",
    "send",
  );
  actions.append(insertButton, sendButton);

  footer.append(hint, actions);
  card.append(header, options, footer);

  return {
    card,
    count,
    options,
    hint,
    insertButton,
    sendButton,
  };
}

function createOptionControl(payload, option, index, groupName) {
  const wrapper = document.createElement("label");
  wrapper.className = "oc-select-card__option";
  wrapper.setAttribute("data-oc-select-option", option.value);

  const input = document.createElement("input");
  input.className = "oc-select-card__control";
  input.type = payload.kind === "single" ? "radio" : "checkbox";
  input.name = groupName;
  input.value = option.value;
  input.disabled = option.disabled;
  input.setAttribute("data-oc-select-input", option.value);
  input.setAttribute("aria-label", option.label);

  const copy = document.createElement("div");
  copy.className = "oc-select-card__option-copy";

  const title = document.createElement("div");
  title.className = "oc-select-card__option-title";
  title.textContent = option.label;

  copy.append(title);

  if (option.description) {
    const description = document.createElement("div");
    description.className = "oc-select-card__option-description";
    description.textContent = option.description;
    copy.append(description);
  }

  wrapper.append(input, copy);
  if (option.disabled) {
    wrapper.classList.add("is-disabled");
  }
  wrapper.style.order = String(index);

  return {
    wrapper,
    input,
  };
}

export function createSelectAdapter({ vendorBaseUrl }) {
  const ensureJson5 = createJson5Loader(vendorBaseUrl);

  return {
    id: "select",
    uiText: createUiText(),
    languageAliases: SELECT_LANGUAGE_ALIASES,
    getStyles: getSelectStyles,
    preload() {
      return ensureJson5();
    },
    ensureReady: ensureJson5,
    localizeErrorMessage,
    async renderContent({ source, wrapper, host, context, renderHostScaffold }) {
      const mode = detectSelectMode(source, getWrapperLanguage(wrapper));
      const payload = parseSelectPayload(source, context?.json5, mode);
      const cardEl = renderHostScaffold(host, wrapper, "success", "", {
        summaryText: buildSummaryText(payload),
      });
      cardEl.classList.add("oc-select-renderer");

      const shell = createSelectCard(payload);
      const groupName = `oc-select-${payload.kind}-${Math.random().toString(36).slice(2, 10)}`;
      const inputEntries = payload.options.map((option, index) =>
        createOptionControl(payload, option, index, groupName),
      );
      shell.options.replaceChildren(...inputEntries.map((entry) => entry.wrapper));
      cardEl.replaceChildren(shell.card);

      const optionsByValue = new Map(payload.options.map((option) => [option.value, option]));
      const state = {
        selectedValues: new Set(
          payload.kind === "single"
            ? payload.defaultValue
              ? [payload.defaultValue]
              : []
            : payload.defaultValues,
        ),
      };

      const syncUi = () => {
        const selectedCount = state.selectedValues.size;
        const valid = isSelectionValid(payload, state.selectedValues);
        shell.count.textContent = buildSelectedCountText(payload, selectedCount);
        shell.hint.textContent = buildHintText(payload, selectedCount);
        shell.insertButton.disabled = !valid;
        shell.sendButton.disabled = !valid;

        for (const { wrapper: optionWrapper, input } of inputEntries) {
          const selected = state.selectedValues.has(input.value);
          optionWrapper.classList.toggle("is-selected", selected);

          if (payload.kind === "multi" && !optionsByValue.get(input.value)?.disabled) {
            const reachedMax = state.selectedValues.size >= payload.maxSelected;
            input.disabled = reachedMax ? !selected : false;
          }

          if (optionsByValue.get(input.value)?.disabled) {
            input.disabled = true;
          }
          optionWrapper.classList.toggle("is-disabled", input.disabled);
          input.checked = selected;
        }
      };

      const getSelectedOptions = () =>
        payload.options.filter((option) => state.selectedValues.has(option.value));

      const runSelectionAction = async (action) => {
        if (!isSelectionValid(payload, state.selectedValues)) {
          return false;
        }
        const promptText = composeSelectionPrompt(payload, getSelectedOptions());
        if (!promptText) {
          return false;
        }
        if (action === "send") {
          return sendPromptToChat(promptText);
        }
        return insertPromptIntoChatBox(promptText);
      };

      for (const { input } of inputEntries) {
        input.addEventListener("change", () => {
          if (payload.kind === "single") {
            state.selectedValues = input.checked ? new Set([input.value]) : new Set();
            syncUi();
            return;
          }

          const nextSelected = new Set(state.selectedValues);
          if (input.checked) {
            if (nextSelected.size >= payload.maxSelected) {
              input.checked = false;
              syncUi();
              return;
            }
            nextSelected.add(input.value);
          } else {
            nextSelected.delete(input.value);
          }
          state.selectedValues = nextSelected;
          syncUi();
        });
      }

      shell.insertButton.addEventListener("click", () => {
        void runSelectionAction("insert");
      });
      shell.sendButton.addEventListener("click", () => {
        void runSelectionAction("send");
      });

      syncUi();
      return null;
    },
  };
}

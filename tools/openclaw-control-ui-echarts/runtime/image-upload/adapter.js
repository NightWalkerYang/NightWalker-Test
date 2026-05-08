import {
  insertPromptIntoChatBox,
  sendPromptToChat,
} from "../framework/chat-composer.js";
import { createJson5Loader } from "../file/libraries.js";
import { createTenantApiClient } from "../tenant/api-client.js";
import { readSelectedTenantAgent } from "../tenant/tenant-context.js";
import { getImageUploadStyles } from "./styles.js";
import {
  IMAGE_UPLOAD_LANGUAGE_ALIASES,
  localizeErrorMessage,
  parseImageUploadPayload,
} from "./parser.js";
import { UI_TEXT } from "./ui-text.js";

function normalizeFileExtension(name) {
  const match = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function formatBytes(bytes) {
  const numeric = Number(bytes);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = numeric;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(/\.0+$/, "")} ${units[unitIndex]}`;
}

function matchesAccept(file, acceptList) {
  const fileType = String(file?.type || "").toLowerCase();
  const fileExt = normalizeFileExtension(file?.name || "");
  for (const entry of acceptList) {
    const normalized = String(entry || "").toLowerCase();
    if (!normalized) {
      continue;
    }
    if (normalized.startsWith(".")) {
      if (normalized === fileExt) {
        return true;
      }
      continue;
    }
    if (normalized === fileType) {
      return true;
    }
  }
  return false;
}

function makeUploadedLines(payload, uploadedById) {
  const lines = [];
  for (const slot of payload.slots) {
    if (!uploadedById.has(slot.id)) {
      continue;
    }
    const uploaded = uploadedById.get(slot.id);
    const workspacePath = String(uploaded?.workspacePath || slot.workspacePath || "").trim();
    if (!workspacePath) {
      continue;
    }
    lines.push(`${slot.id} -> ${workspacePath}`);
  }
  return lines;
}

function makeRelativeHints(payload, uploadedById) {
  const lines = [];
  for (const slot of payload.slots) {
    if (!uploadedById.has(slot.id)) {
      continue;
    }
    const uploaded = uploadedById.get(slot.id);
    const workspacePath = String(uploaded?.workspacePath || slot.workspacePath || "").trim();
    if (workspacePath.startsWith("Echarts/assets/")) {
      lines.push(`${slot.id}: ./assets/${workspacePath.slice("Echarts/assets/".length)}`);
    }
  }
  return lines;
}

function buildSuccessPrompt(payload, uploadedById) {
  const uploadedLines = makeUploadedLines(payload, uploadedById);
  const uploadedList = uploadedLines.join("；");
  const prompt = payload.successPrompt.includes("{{uploadedList}}")
    ? payload.successPrompt.replaceAll("{{uploadedList}}", uploadedList)
    : `${payload.successPrompt}\n${uploadedLines.join("\n")}`;
  const relativeHints = makeRelativeHints(payload, uploadedById);
  if (relativeHints.length === 0) {
    return prompt;
  }
  return `${prompt}\n相对路径建议：\n${relativeHints.join("\n")}`;
}

function createStatusBadge(slot, state) {
  const badge = document.createElement("span");
  badge.className = "oc-image-upload-card__slot-status";
  if (state.uploading) {
    badge.textContent = "上传中";
    return badge;
  }
  if (state.failedMessage) {
    badge.textContent = UI_TEXT.statusFailed;
    badge.classList.add("is-failed");
    return badge;
  }
  if (state.uploadCount >= 2) {
    badge.textContent = UI_TEXT.statusReplaceable;
    return badge;
  }
  if (state.uploadCount === 1) {
    badge.textContent = UI_TEXT.statusUploaded;
    return badge;
  }
  badge.textContent = UI_TEXT.statusPending;
  return badge;
}

function createSlotCard(slot, stateById) {
  const state = stateById.get(slot.id);
  const node = document.createElement("section");
  node.className = "oc-image-upload-card__slot";
  node.setAttribute("data-oc-image-upload-slot", slot.id);

  const head = document.createElement("div");
  head.className = "oc-image-upload-card__slot-head";

  const label = document.createElement("div");
  label.className = "oc-image-upload-card__slot-label";
  label.textContent = slot.required ? `${slot.label} *` : slot.label;

  head.append(label, createStatusBadge(slot, state));

  const hint = document.createElement("div");
  hint.className = "oc-image-upload-card__slot-hint";
  hint.textContent = slot.hint || UI_TEXT.dropHint;

  const path = document.createElement("code");
  path.className = "oc-image-upload-card__slot-path";
  path.textContent = slot.workspacePath;

  const input = document.createElement("input");
  input.className = "oc-image-upload-card__slot-input";
  input.type = "file";
  input.setAttribute("data-oc-image-upload-input", slot.id);
  input.setAttribute("aria-label", `${slot.label}${slot.required ? " 必填" : ""}`);
  input.accept = slot.accept.join(",");

  const error = document.createElement("div");
  error.className = "oc-image-upload-card__slot-error";
  error.setAttribute("data-oc-image-upload-error", slot.id);
  if (state.failedMessage) {
    error.textContent = state.failedMessage;
    error.classList.add("is-visible");
  }

  node.append(head, hint, path, input, error);
  return { node, input, error };
}

function createUploadCard(payload) {
  const root = document.createElement("article");
  root.className = "oc-image-upload-card";

  const header = document.createElement("header");
  header.className = "oc-image-upload-card__header";

  const title = document.createElement("h4");
  title.className = "oc-image-upload-card__title";
  title.textContent = payload.title;

  header.append(title);

  if (payload.description) {
    const description = document.createElement("p");
    description.className = "oc-image-upload-card__description";
    description.textContent = payload.description;
    header.append(description);
  }

  const slots = document.createElement("div");
  slots.className = "oc-image-upload-card__slots";

  const actions = document.createElement("div");
  actions.className = "oc-image-upload-card__actions";

  const insertButton = document.createElement("button");
  insertButton.type = "button";
  insertButton.className = "oc-image-upload-card__action";
  insertButton.setAttribute("data-oc-image-upload-action", "insert");
  insertButton.textContent = UI_TEXT.actionInsert;

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "oc-image-upload-card__action oc-image-upload-card__action--primary";
  submitButton.setAttribute("data-oc-image-upload-action", "submit");
  submitButton.textContent = payload.submitLabel || UI_TEXT.actionSubmit;

  actions.append(insertButton, submitButton);
  root.append(header, slots, actions);
  return { root, slots, insertButton, submitButton };
}

function hasUploadedRequiredSlots(payload, uploadedById) {
  for (const slot of payload.slots) {
    if (!slot.required) {
      continue;
    }
    if (!uploadedById.has(slot.id)) {
      return false;
    }
  }
  return true;
}

function createUiText() {
  return {
    badge: UI_TEXT.badge,
    summaryLoading: UI_TEXT.summaryLoading,
    summarySuccess: UI_TEXT.summarySuccess,
    summaryError: UI_TEXT.summaryError,
    loadingTitle: UI_TEXT.loadingTitle,
    loadingRuntimeDetail: UI_TEXT.loadingRuntimeDetail,
    loadingStreamingDetail: UI_TEXT.loadingStreamingDetail,
    errorTitle: UI_TEXT.errorTitle,
  };
}

function renderFallback(cardEl, source, errorDetail) {
  const panel = document.createElement("article");
  panel.className = "oc-image-upload-card";
  const title = document.createElement("h4");
  title.className = "oc-image-upload-card__title";
  title.textContent = "上传卡片配置暂不可用";
  const detail = document.createElement("p");
  detail.className = "oc-image-upload-card__description";
  detail.textContent = localizeErrorMessage(errorDetail);
  const action = document.createElement("button");
  action.type = "button";
  action.className = "oc-image-upload-card__action";
  action.textContent = UI_TEXT.actionInsert;
  const fallbackPrompt = `请修复 image-upload 配置后继续：\n${String(source || "").slice(0, 300)}`;
  action.addEventListener("click", () => {
    void insertPromptIntoChatBox(fallbackPrompt);
  });
  panel.append(title, detail, action);
  cardEl.replaceChildren(panel);
}

export function createImageUploadAdapter({ vendorBaseUrl }) {
  const ensureJson5 = createJson5Loader(vendorBaseUrl);

  return {
    id: "image-upload",
    uiText: createUiText(),
    languageAliases: IMAGE_UPLOAD_LANGUAGE_ALIASES,
    getStyles: getImageUploadStyles,
    preload() {
      return ensureJson5();
    },
    ensureReady: ensureJson5,
    localizeErrorMessage,
    async renderContent({ source, wrapper, host, context, renderHostScaffold }) {
      let payload = null;
      let parseError = "";
      try {
        payload = parseImageUploadPayload(source, context?.json5);
      } catch (error) {
        parseError =
          error && typeof error.message === "string"
            ? error.message
            : String(error || "Unknown error");
      }

      const surface = renderHostScaffold(host, wrapper, "success", "", {
        summaryText: payload ? UI_TEXT.summarySuccess : `${UI_TEXT.summaryError}（已降级）`,
      });
      surface.classList.add("oc-image-upload-renderer");

      if (!payload) {
        renderFallback(surface, source, parseError);
        return null;
      }

      const uploadedById = new Map();
      const stateById = new Map(
        payload.slots.map((slot) => [
          slot.id,
          {
            uploadCount: 0,
            uploading: false,
            failedMessage: "",
          },
        ]),
      );

      const shell = createUploadCard(payload);
      surface.replaceChildren(shell.root);

      const slotEntries = payload.slots.map((slot) => createSlotCard(slot, stateById));
      shell.slots.replaceChildren(...slotEntries.map((entry) => entry.node));

      const syncActions = () => {
        const ready = hasUploadedRequiredSlots(payload, uploadedById);
        shell.submitButton.disabled = !ready;
        shell.insertButton.disabled = !ready;
      };

      const rerenderSlots = () => {
        const nextEntries = payload.slots.map((slot) => createSlotCard(slot, stateById));
        shell.slots.replaceChildren(...nextEntries.map((entry) => entry.node));
        for (const entry of nextEntries) {
          const slotId = entry.input.getAttribute("data-oc-image-upload-input") || "";
          const slot = payload.slots.find((item) => item.id === slotId);
          if (!slot) {
            continue;
          }
          entry.input.addEventListener("change", () => {
            const files = Array.from(entry.input.files || []);
            const file = files[0];
            if (!file) {
              return;
            }
            const slotState = stateById.get(slot.id);
            if (!slotState) {
              return;
            }

            if (!matchesAccept(file, slot.accept)) {
              slotState.failedMessage = `文件类型不支持，仅允许：${slot.accept.join(", ")}`;
              uploadedById.delete(slot.id);
              rerenderSlots();
              syncActions();
              return;
            }
            if (slot.maxBytes > 0 && file.size > slot.maxBytes) {
              slotState.failedMessage = `文件超过大小限制：${formatBytes(slot.maxBytes)}`;
              uploadedById.delete(slot.id);
              rerenderSlots();
              syncActions();
              return;
            }
            slotState.uploading = true;
            slotState.failedMessage = "";
            rerenderSlots();
            syncActions();

            void (async () => {
              try {
                const apiClient = createTenantApiClient();
                const selectedAgent = readSelectedTenantAgent(window.location.href);
                const tenantAgentId = String(
                  selectedAgent?.id ||
                    wrapper?.getAttribute?.("data-oc-tenant-agent-id") ||
                    "",
                ).trim();
                if (!tenantAgentId) {
                  throw new Error("missing_tenant_agent_id");
                }
                const uploadResult = await apiClient.uploadMemberImageAsset({
                  tenantAgentId,
                  slotId: slot.id,
                  workspacePath: slot.workspacePath,
                  file,
                });
                const uploadedItem = Array.isArray(uploadResult?.uploadedItems)
                  ? uploadResult.uploadedItems[0]
                  : null;
                slotState.uploading = false;
                slotState.uploadCount += 1;
                slotState.failedMessage = "";
                uploadedById.set(slot.id, {
                  fileName: file.name,
                  workspacePath: String(
                    uploadedItem?.workspacePath || slot.workspacePath,
                  ).trim(),
                  relativePath: String(uploadedItem?.relativePath || "").trim(),
                });
              } catch (error) {
                slotState.uploading = false;
                slotState.failedMessage = localizeErrorMessage(
                  error && typeof error.message === "string"
                    ? error.message
                    : String(error || "upload_failed"),
                );
                uploadedById.delete(slot.id);
              }
              rerenderSlots();
              syncActions();
            })();
          });
        }
      };

      rerenderSlots();
      syncActions();

      const runAction = async (mode) => {
        const ready = hasUploadedRequiredSlots(payload, uploadedById);
        if (!ready) {
          return false;
        }
        const promptText = buildSuccessPrompt(payload, uploadedById);
        if (mode === "submit") {
          return sendPromptToChat(promptText);
        }
        return insertPromptIntoChatBox(promptText);
      };

      shell.insertButton.addEventListener("click", () => {
        void runAction("insert");
      });
      shell.submitButton.addEventListener("click", () => {
        void runAction("submit");
      });

      return null;
    },
  };
}

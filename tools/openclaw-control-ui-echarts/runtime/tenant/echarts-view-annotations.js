import {
  consumeEchartsViewPendingPrompt,
  readEchartsViewRuntimeContext,
  readEchartsViewToken,
  writeEchartsViewPendingPrompt,
} from "../echarts-view/context.js";
import { backfillChatComposerPrompt, formatMultiAnnotationPrompt } from "./member-chat-annotations.js";
import { buildTenantMemberChatRoute } from "./tenant-context.js";

const HOST_ATTR = "data-oc-echarts-annotation-host";
const STYLE_ATTR = "data-oc-echarts-annotation-style";
const OVERLAY_ATTR = "data-oc-echarts-annotation-overlay";
const PANEL_ATTR = "data-oc-echarts-annotation-panel";
const FRAME_ATTR = "data-oc-echarts-annotation-frame";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureStyle() {
  let link = document.head.querySelector(`[${STYLE_ATTR}]`);
  if (link instanceof HTMLStyleElement) {
    return link;
  }
  link = document.createElement("style");
  link.setAttribute(STYLE_ATTR, "true");
  link.textContent = `
    [${HOST_ATTR}="true"] {
      position: fixed;
      inset: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      background: #f4f7fb;
      z-index: 999999;
    }
    .oc-echarts-annotation-toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
    }
    .oc-echarts-annotation-layout {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
    }
    .oc-echarts-annotation-stage {
      position: relative;
      background: linear-gradient(180deg, #dbe7f7 0%, #eef4fb 100%);
      overflow: auto;
      padding: 18px;
    }
    .oc-echarts-annotation-frame-wrap {
      position: relative;
      width: fit-content;
      max-width: 100%;
      margin: 0 auto;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
      border-radius: 18px;
      overflow: hidden;
      background: #fff;
    }
    .oc-echarts-annotation-frame {
      display: block;
      border: 0;
      background: #fff;
    }
    .oc-echarts-annotation-overlay {
      position: absolute;
      inset: 0;
      cursor: crosshair;
    }
    .oc-echarts-annotation-rect {
      position: absolute;
      border: 2px solid #ef4444;
      background: rgba(239, 68, 68, 0.12);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.8) inset;
    }
    .oc-echarts-annotation-draft {
      border-style: dashed;
    }
    .oc-echarts-annotation-side {
      border-left: 1px solid rgba(15, 23, 42, 0.08);
      background: #ffffff;
      padding: 16px;
      overflow: auto;
    }
    .oc-echarts-annotation-list {
      display: grid;
      gap: 12px;
    }
    .oc-echarts-annotation-card {
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 14px;
      padding: 12px;
      background: #f8fafc;
      display: grid;
      gap: 8px;
    }
    .oc-echarts-annotation-card textarea {
      width: 100%;
      min-height: 88px;
      resize: vertical;
    }
    .oc-echarts-annotation-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  `;
  document.head.append(link);
  return link;
}

function normalizeRect(rect, base) {
  return {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
    pageWidth: Math.max(0, Math.round(base.width)),
    pageHeight: Math.max(0, Math.round(base.height)),
  };
}

function buildRectStyle(rect, baseWidth, baseHeight) {
  const scaleX = baseWidth > 0 ? 100 / baseWidth : 0;
  const scaleY = baseHeight > 0 ? 100 / baseHeight : 0;
  return [
    `left:${rect.x * scaleX}%`,
    `top:${rect.y * scaleY}%`,
    `width:${rect.width * scaleX}%`,
    `height:${rect.height * scaleY}%`,
  ].join(";");
}

function mapAnnotationText(annotation) {
  return String(annotation?.thread?.[0]?.text || annotation?.text || "").trim();
}

function createAnnotationDraft(rect) {
  return {
    id: `draft-${Date.now()}`,
    status: "open",
    rect,
    thread: [],
    text: "",
  };
}

function canUsePendingPromptContext(context) {
  return Boolean(String(context?.tenantAgentId || "").trim());
}

async function createAnnotation(state, text) {
  const payload = {
    tenantAgentId: state.context.tenantAgentId,
    openclawSessionKey: state.context.openclawSessionKey,
    runId: state.context.runId,
    messageId: state.context.messageId,
    pageId: state.context.pageId || state.context.token,
    entryUrl: state.context.entryUrl || window.location.pathname + window.location.search,
    revisionId: state.context.revisionId || "",
    rect: state.draft.rect,
    text,
  };
  const created = await state.apiClient.createMemberAnnotation(payload);
  state.annotations.unshift(created);
  state.draft = null;
  render(state);
}

async function appendReply(state, annotationId, text) {
  const updated = await state.apiClient.replyMemberAnnotation({ annotationId, text });
  state.annotations = state.annotations.map((item) => (item.id === annotationId ? updated : item));
  render(state);
}

async function setStatus(state, annotationId, status) {
  const updated = await state.apiClient.updateMemberAnnotationStatus({ annotationId, status });
  state.annotations = state.annotations.map((item) => (item.id === annotationId ? updated : item));
  render(state);
}

function backfillAndReturn(state, prompt) {
  if (!prompt || !canUsePendingPromptContext(state.context)) {
    return;
  }
  writeEchartsViewPendingPrompt({
    token: state.context.token,
    tenantAgentId: state.context.tenantAgentId,
    openclawSessionKey: state.context.openclawSessionKey,
    pendingPrompt: prompt,
    returnChatHref:
      state.context.returnChatHref ||
      buildTenantMemberChatRoute(state.context.tenantAgentId, state.context.openclawSessionKey || ""),
  });
  const destination =
    state.context.returnChatHref ||
    buildTenantMemberChatRoute(state.context.tenantAgentId, state.context.openclawSessionKey || "");
  if (destination) {
    window.location.assign(destination);
  }
}

function render(state) {
  const { host, frame, visualization, annotations, draft } = state;
  const baseWidth = frame.clientWidth || 1;
  const baseHeight = frame.clientHeight || 1;
  host.innerHTML = `
    <div class="oc-echarts-annotation-toolbar">
      <div>
        <strong>批注模式</strong>
        <span style="margin-left:8px;color:#475569;">${escapeHtml(
          visualization?.title || state.context.visualizationName || "当前预览",
        )}</span>
      </div>
      <div class="oc-echarts-annotation-actions">
        <button type="button" data-action="all-prompts">根据全部未解决批注继续修改</button>
        <button type="button" data-action="back-chat">返回聊天</button>
      </div>
    </div>
    <div class="oc-echarts-annotation-layout">
      <div class="oc-echarts-annotation-stage">
        <div class="oc-echarts-annotation-frame-wrap">
          <iframe class="oc-echarts-annotation-frame" ${FRAME_ATTR}="true"></iframe>
          <div class="oc-echarts-annotation-overlay" ${OVERLAY_ATTR}="true">
            ${annotations
              .map(
                (annotation) => `<div class="oc-echarts-annotation-rect" data-id="${escapeHtml(annotation.id)}" style="${buildRectStyle(
                  annotation.rect,
                  annotation.rect.pageWidth || baseWidth,
                  annotation.rect.pageHeight || baseHeight,
                )}"></div>`,
              )
              .join("")}
            ${
              draft
                ? `<div class="oc-echarts-annotation-rect oc-echarts-annotation-draft" style="${buildRectStyle(
                    draft.rect,
                    draft.rect.pageWidth || baseWidth,
                    draft.rect.pageHeight || baseHeight,
                  )}"></div>`
                : ""
            }
          </div>
        </div>
      </div>
      <aside class="oc-echarts-annotation-side">
        <div class="oc-echarts-annotation-list">
          ${
            draft
              ? `<section class="oc-echarts-annotation-card" data-draft-card="true">
                  <strong>新批注</strong>
                  <textarea placeholder="描述你想修改的这个区域..." data-draft-text></textarea>
                  <div class="oc-echarts-annotation-actions">
                    <button type="button" data-action="save-draft">保存批注</button>
                    <button type="button" data-action="cancel-draft">取消</button>
                  </div>
                </section>`
              : ""
          }
          ${annotations
            .map(
              (annotation) => `<section class="oc-echarts-annotation-card" data-annotation-id="${escapeHtml(annotation.id)}">
                  <div style="display:flex;justify-content:space-between;gap:8px;">
                    <strong>#${escapeHtml(annotation.id.slice(-6))}</strong>
                    <span>${escapeHtml(annotation.status === "resolved" ? "已解决" : "未解决")}</span>
                  </div>
                  <div>${escapeHtml(mapAnnotationText(annotation) || "无内容")}</div>
                  <textarea placeholder="回复此批注..." data-reply-text></textarea>
                  <div class="oc-echarts-annotation-actions">
                    <button type="button" data-action="single-prompt" data-id="${escapeHtml(annotation.id)}">根据此批注继续修改</button>
                    <button type="button" data-action="reply" data-id="${escapeHtml(annotation.id)}">回复</button>
                    <button type="button" data-action="toggle-status" data-id="${escapeHtml(annotation.id)}">${
                      annotation.status === "resolved" ? "重新打开" : "解决"
                    }</button>
                  </div>
                </section>`,
            )
            .join("")}
        </div>
      </aside>
    </div>
  `;
  const mountedFrame = host.querySelector(`iframe[${FRAME_ATTR}]`);
  if (mountedFrame instanceof HTMLIFrameElement) {
    mountedFrame.srcdoc = frame.srcdoc || "";
    mountedFrame.style.width = `${baseWidth}px`;
    mountedFrame.style.height = `${Math.max(frame.clientHeight, 720)}px`;
  }
}

function bindSelection(state) {
  const overlay = state.host.querySelector(`[${OVERLAY_ATTR}]`);
  if (!(overlay instanceof HTMLElement)) {
    return;
  }
  let pointerStart = null;
  overlay.addEventListener("pointerdown", (event) => {
    const bounds = overlay.getBoundingClientRect();
    pointerStart = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      width: overlay.clientWidth,
      height: overlay.clientHeight,
    };
  });
  overlay.addEventListener("pointerup", (event) => {
    if (!pointerStart) {
      return;
    }
    const bounds = overlay.getBoundingClientRect();
    const endX = event.clientX - bounds.left;
    const endY = event.clientY - bounds.top;
    const rect = normalizeRect(
      {
        x: Math.min(pointerStart.x, endX),
        y: Math.min(pointerStart.y, endY),
        width: Math.abs(endX - pointerStart.x),
        height: Math.abs(endY - pointerStart.y),
      },
      {
        width: pointerStart.width,
        height: pointerStart.height,
      },
    );
    pointerStart = null;
    if (rect.width < 12 || rect.height < 12) {
      return;
    }
    state.draft = createAnnotationDraft(rect);
    render(state);
    bindAll(state);
  });
}

function bindActions(state) {
  state.host.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = String(target.dataset.action || "").trim();
    if (!action) {
      return;
    }
    if (action === "cancel-draft") {
      state.draft = null;
      render(state);
      bindAll(state);
      return;
    }
    if (action === "save-draft" && state.draft) {
      const text = String(
        state.host.querySelector("[data-draft-text]") instanceof HTMLTextAreaElement
          ? state.host.querySelector("[data-draft-text]").value
          : "",
      ).trim();
      if (!text) {
        return;
      }
      await createAnnotation(state, text);
      bindAll(state);
      return;
    }
    if (action === "all-prompts") {
      const prompt = formatMultiAnnotationPrompt(state.annotations);
      backfillAndReturn(state, prompt);
      return;
    }
    if (action === "back-chat") {
      if (state.context.returnChatHref) {
        window.location.assign(state.context.returnChatHref);
      }
      return;
    }
    const annotationId = String(target.dataset.id || "").trim();
    const annotation = state.annotations.find((item) => item.id === annotationId);
    if (!annotation) {
      return;
    }
    if (action === "single-prompt") {
      const prompt = formatMultiAnnotationPrompt([annotation]);
      backfillAndReturn(state, prompt);
      return;
    }
    if (action === "toggle-status") {
      await setStatus(state, annotationId, annotation.status === "resolved" ? "open" : "resolved");
      bindAll(state);
      return;
    }
    if (action === "reply") {
      const card = target.closest("[data-annotation-id]");
      const textarea =
        card instanceof HTMLElement ? card.querySelector("[data-reply-text]") : null;
      const text = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : "";
      if (!text) {
        return;
      }
      await appendReply(state, annotationId, text);
      bindAll(state);
    }
  });
}

function bindAll(state) {
  bindSelection(state);
}

export function consumePendingPromptIntoMemberChat(root = document) {
  const promptState = consumeEchartsViewPendingPrompt();
  if (!promptState?.prompt) {
    return false;
  }
  return backfillChatComposerPrompt(promptState.prompt, root);
}

export async function mountEchartsViewAnnotations(params = {}) {
  const frame = params.frame;
  if (!(frame instanceof HTMLIFrameElement)) {
    return null;
  }
  const token = readEchartsViewToken();
  const context = readEchartsViewRuntimeContext(token);
  if (!context?.tenantAgentId) {
    return null;
  }
  ensureStyle();
  const host = document.createElement("div");
  host.setAttribute(HOST_ATTR, "true");
  document.body.replaceChildren(host);
  const apiClient = params.apiClient;
  const pageId = String(context.pageId || token || "echarts-view").trim();
  const annotations = await apiClient.listMemberAnnotations({
    tenantAgentId: context.tenantAgentId,
    openclawSessionKey: context.openclawSessionKey,
    pageId,
  });
  const state = {
    apiClient,
    frame,
    host,
    draft: null,
    annotations: Array.isArray(annotations) ? annotations : [],
    visualization: params.visualization || null,
    context: {
      ...context,
      token,
      pageId,
      entryUrl: window.location.pathname + window.location.search,
    },
  };
  render(state);
  bindActions(state);
  bindAll(state);
  return state;
}

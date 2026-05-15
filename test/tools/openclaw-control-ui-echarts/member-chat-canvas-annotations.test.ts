/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mountMemberChatCanvasAnnotations,
  unmountMemberChatCanvasAnnotations,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-canvas-annotations.js";

function createController() {
  const app = document.createElement("openclaw-app");
  app.chatRunId = "run-1";
  return {
    app,
    selectedAgent: { id: "tenant-agent-1" },
    currentSessionKey: "session-1",
  };
}

function createApiClient() {
  const createdAnnotation = {
    id: "annotation-1",
    status: "open",
    rect: { x: 20, y: 30, width: 160, height: 90, pageWidth: 1024, pageHeight: 768 },
    thread: [{ id: "thread-1", text: "顶部卡片层级不清晰" }],
  };
  return {
    createdAnnotation,
    listMemberAnnotations: vi.fn(async () => []),
    createMemberAnnotation: vi.fn(async () => createdAnnotation),
    replyMemberAnnotation: vi.fn(async () => ({
      ...createdAnnotation,
      thread: [...createdAnnotation.thread, { id: "thread-2", text: "请同时加大标题和图表间距" }],
    })),
    updateMemberAnnotationStatus: vi.fn(async () => ({
      ...createdAnnotation,
      status: "resolved",
    })),
  };
}

function pointer(type: string, x: number, y: number) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  unmountMemberChatCanvasAnnotations();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("member chat canvas annotations", () => {
  it("selects a page region, saves an annotation, and backfills prompts", async () => {
    document.body.innerHTML = `
      <main data-testid="chat-shell">
        <form data-testid="chat-composer">
          <textarea placeholder="Type a message below"></textarea>
          <button type="submit">Send</button>
        </form>
      </main>
    `;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });

    const apiClient = createApiClient();
    const surface = mountMemberChatCanvasAnnotations(createController(), apiClient);

    expect(surface).not.toBeNull();
    expect(document.body.textContent).toContain("批注");

    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    expect(apiClient.listMemberAnnotations).toHaveBeenCalledWith({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      pageId: "member-chat:tenant-agent-1:session-1",
    });
    expect(document.body.textContent).toContain("拖拽页面区域创建批注");

    const overlay = document.querySelector<HTMLElement>(
      "[data-oc-member-canvas-annotation-overlay]",
    );
    expect(overlay).not.toBeNull();
    overlay?.dispatchEvent(pointer("pointerdown", 20, 30));
    window.dispatchEvent(pointer("pointermove", 180, 120));
    window.dispatchEvent(pointer("pointerup", 180, 120));

    const draft = document.querySelector<HTMLTextAreaElement>("[data-draft-text]");
    expect(draft).not.toBeNull();
    draft!.value = "顶部卡片层级不清晰";
    document.querySelector<HTMLElement>('[data-action="save-draft"]')?.click();
    await flush();

    expect(apiClient.createMemberAnnotation).toHaveBeenCalledWith({
      tenantAgentId: "tenant-agent-1",
      openclawSessionKey: "session-1",
      runId: "run-1",
      messageId: "",
      pageId: "member-chat:tenant-agent-1:session-1",
      entryUrl: "/",
      revisionId: "",
      rect: { x: 20, y: 30, width: 160, height: 90, pageWidth: 1024, pageHeight: 768 },
      text: "顶部卡片层级不清晰",
    });
    expect(document.body.textContent).toContain("顶部卡片层级不清晰");

    document.querySelector<HTMLElement>('[data-action="single-prompt"]')?.click();
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "请处理这条标注反馈：顶部卡片层级不清晰",
    );

    document.querySelector<HTMLElement>('[data-action="all-prompts"]')?.click();
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      ["请一起处理这些未解决的标注反馈：", "1. 顶部卡片层级不清晰"].join("\n"),
    );
  });

  it("updates annotation thread and resolved state", async () => {
    const apiClient = createApiClient();
    apiClient.listMemberAnnotations.mockResolvedValueOnce([apiClient.createdAnnotation]);
    mountMemberChatCanvasAnnotations(createController(), apiClient);

    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    const reply = document.querySelector<HTMLTextAreaElement>("[data-reply-text]");
    expect(reply).not.toBeNull();
    reply!.value = "请同时加大标题和图表间距";
    document.querySelector<HTMLElement>('[data-action="reply"]')?.click();
    await flush();

    expect(apiClient.replyMemberAnnotation).toHaveBeenCalledWith({
      annotationId: "annotation-1",
      text: "请同时加大标题和图表间距",
    });
    expect(document.body.textContent).toContain("回复：请同时加大标题和图表间距");

    document.querySelector<HTMLElement>('[data-action="toggle-status"]')?.click();
    await flush();

    expect(apiClient.updateMemberAnnotationStatus).toHaveBeenCalledWith({
      annotationId: "annotation-1",
      status: "resolved",
    });
    expect(document.body.textContent).toContain("已解决");
  });

  it("preserves an open annotation session across same-page remounts", async () => {
    const controller = createController();
    const apiClient = createApiClient();
    const surface = mountMemberChatCanvasAnnotations(controller, apiClient);
    document.querySelector<HTMLElement>("[data-oc-member-canvas-annotation-button]")?.click();
    await flush();

    expect(document.body.textContent).toContain("正在批注");
    expect(document.querySelector("[data-oc-member-canvas-annotation-overlay]")).not.toBeNull();

    const remounted = mountMemberChatCanvasAnnotations(controller, apiClient);

    expect(remounted).toBe(surface);
    expect(document.body.textContent).toContain("正在批注");
    expect(document.querySelector("[data-oc-member-canvas-annotation-overlay]")).not.toBeNull();
  });
});

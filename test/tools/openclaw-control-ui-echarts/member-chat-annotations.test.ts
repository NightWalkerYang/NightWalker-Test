/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backfillChatComposerPrompt,
  formatMultiAnnotationPrompt,
  formatSingleAnnotationPrompt,
} from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-annotations.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("member chat annotations helper", () => {
  it("formats a single annotation prompt", () => {
    expect(
      formatSingleAnnotationPrompt({
        id: "annotation-1",
        text: "顶部图表留白不够",
      }),
    ).toBe("请处理这条标注反馈：顶部图表留白不够");
  });

  it("formats unresolved annotations into a numbered summary prompt", () => {
    expect(
      formatMultiAnnotationPrompt([
        { id: "annotation-1", status: "open", text: "顶部图表留白不够" },
        { id: "annotation-2", status: "resolved", text: "这个已完成" },
        { id: "annotation-3", status: "open", text: "筛选器和标题没有对齐" },
      ]),
    ).toBe(
      ["请一起处理这些未解决的标注反馈：", "1. 顶部图表留白不够", "2. 筛选器和标题没有对齐"].join(
        "\n",
      ),
    );
  });

  it("backfills the composer textarea through dom-compat without fixed classes", () => {
    document.body.innerHTML = `
      <section data-testid="chat-shell">
        <form data-testid="chat-composer">
          <label for="prompt-box">消息输入</label>
          <div>
            <textarea id="prompt-box" placeholder="发送消息"></textarea>
          </div>
          <div role="toolbar" aria-label="chat actions">
            <button type="submit">发送</button>
          </div>
        </form>
      </section>
    `;

    const textarea = document.querySelector("textarea");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);

    const events = [];
    textarea?.addEventListener("input", () => events.push("input"));
    textarea?.addEventListener("change", () => events.push("change"));

    expect(backfillChatComposerPrompt("请修复顶部间距", document)).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("请修复顶部间距");
    expect(events).toEqual(["input", "change"]);
  });
});

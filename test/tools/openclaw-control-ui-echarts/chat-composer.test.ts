/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertPromptIntoChatBox,
  sendPromptToChat,
} from "../../../tools/openclaw-control-ui-echarts/runtime/framework/chat-composer.js";

function mountComposer(initialValue = "") {
  document.body.innerHTML = `
    <div class="agent-chat__input">
      <div class="agent-chat__composer-combobox">
        <textarea>${initialValue}</textarea>
      </div>
      <div class="agent-chat__toolbar">
        <div class="agent-chat__toolbar-right">
          <button class="chat-send-btn" type="button">send</button>
        </div>
      </div>
    </div>
  `;
  return {
    textarea: document.querySelector("textarea"),
    sendButton: document.querySelector(".chat-send-btn"),
  };
}

function mountComposerWithoutFixedClasses() {
  document.body.innerHTML = `
    <form data-testid="chat-composer">
      <textarea aria-label="输入消息"></textarea>
      <div role="toolbar" aria-label="chat actions">
        <button type="button" aria-label="Stop generating">stop</button>
        <button type="button" aria-label="发送消息">发送</button>
      </div>
    </form>
  `;
  return {
    textarea: document.querySelector("textarea"),
    sendButton: document.querySelector("button[aria-label='发送消息']"),
  };
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", ((callback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("chat composer helpers", () => {
  it("inserts prompts into the nested native composer textarea", async () => {
    const { textarea } = mountComposer("现有草稿");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);

    const inserted = await insertPromptIntoChatBox("补充内容");

    expect(inserted).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("现有草稿\n\n补充内容");
  });

  it("sends prompts through the nested native composer textarea", async () => {
    const { textarea, sendButton } = mountComposer();
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(sendButton).toBeInstanceOf(HTMLButtonElement);
    const clickSpy = vi.spyOn(sendButton as HTMLButtonElement, "click");

    const sent = await sendPromptToChat("直接发送");

    expect(sent).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("直接发送");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("supports capability probing when class names change", async () => {
    const { textarea, sendButton } = mountComposerWithoutFixedClasses();
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(sendButton).toBeInstanceOf(HTMLButtonElement);
    const clickSpy = vi.spyOn(sendButton as HTMLButtonElement, "click");

    const inserted = await insertPromptIntoChatBox("探测插入");
    expect(inserted).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("探测插入");

    const sent = await sendPromptToChat("探测发送");
    expect(sent).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("探测发送");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const insertPromptIntoChatBox = vi.fn(async () => true);
const sendPromptToChat = vi.fn(async () => true);

vi.mock(
  "../../../tools/openclaw-control-ui-echarts/runtime/framework/chat-composer.js",
  () => ({
    insertPromptIntoChatBox,
    sendPromptToChat,
  }),
);

describe("select adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    insertPromptIntoChatBox.mockClear();
    sendPromptToChat.mockClear();
  });

  it("renders a single-select card and sends the selected prompt", async () => {
    const { createSelectAdapter } = await import(
      "../../../tools/openclaw-control-ui-echarts/runtime/select/adapter.js"
    );
    const adapter = createSelectAdapter({
      vendorBaseUrl: new URL("https://hailstone.cn:18789/assets/vendor/"),
    });

    const host = document.createElement("div");
    const wrapper = document.createElement("pre");
    wrapper.innerHTML = `<span class="code-block-lang">single-select</span><code class="language-single-select"></code>`;

    await adapter.renderContent({
      source: String.raw`{
  title: "下一步怎么做？",
  defaultValue: "theme-blue",
  options: [
    { value: "theme-red", label: "把界面优化成红色", prompt: "把界面优化成红色。" },
    { value: "theme-blue", label: "把界面优化成蓝色", prompt: "把界面优化成蓝色。" }
  ]
}`,
      wrapper,
      host,
      context: { json5: (await import("json5")).default },
      renderHostScaffold(currentHost) {
        const surface = document.createElement("div");
        currentHost.append(surface);
        return surface;
      },
    });

    const radio = host.querySelector<HTMLInputElement>(
      '[data-oc-select-input="theme-red"]',
    );
    expect(radio).not.toBeNull();
    radio!.checked = true;
    radio!.dispatchEvent(new Event("change", { bubbles: true }));

    const sendButton = host.querySelector<HTMLButtonElement>(
      '[data-oc-select-action="send"]',
    );
    expect(sendButton?.disabled).toBe(false);
    sendButton?.click();

    expect(sendPromptToChat).toHaveBeenCalledWith("把界面优化成红色。");
  });

  it("renders a multi-select card, enforces maxSelected, and inserts a combined prompt", async () => {
    const { createSelectAdapter } = await import(
      "../../../tools/openclaw-control-ui-echarts/runtime/select/adapter.js"
    );
    const adapter = createSelectAdapter({
      vendorBaseUrl: new URL("https://hailstone.cn:18789/assets/vendor/"),
    });

    const host = document.createElement("div");
    const wrapper = document.createElement("pre");
    wrapper.innerHTML = `<span class="code-block-lang">multi-select</span><code class="language-multi-select"></code>`;

    await adapter.renderContent({
      source: String.raw`{
  title: "下一步同时处理哪些项？",
  minSelected: 1,
  maxSelected: 2,
  options: [
    { value: "theme-red", label: "改成红色主题", prompt: "把界面优化成红色主题。" },
    { value: "tight-spacing", label: "收紧页面间距", prompt: "把页面间距收紧，让信息密度更高。" },
    { value: "improve-contrast", label: "增强对比度", prompt: "增强界面对比度。" }
  ]
}`,
      wrapper,
      host,
      context: { json5: (await import("json5")).default },
      renderHostScaffold(currentHost) {
        const surface = document.createElement("div");
        currentHost.append(surface);
        return surface;
      },
    });

    const first = host.querySelector<HTMLInputElement>(
      '[data-oc-select-input="theme-red"]',
    );
    const second = host.querySelector<HTMLInputElement>(
      '[data-oc-select-input="tight-spacing"]',
    );
    const third = host.querySelector<HTMLInputElement>(
      '[data-oc-select-input="improve-contrast"]',
    );

    first!.checked = true;
    first!.dispatchEvent(new Event("change", { bubbles: true }));
    second!.checked = true;
    second!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(third?.disabled).toBe(true);

    const insertButton = host.querySelector<HTMLButtonElement>(
      '[data-oc-select-action="insert"]',
    );
    expect(insertButton?.disabled).toBe(false);
    insertButton?.click();

    expect(insertPromptIntoChatBox).toHaveBeenCalledWith(
      "请按以下已选项继续：\n1. 把界面优化成红色主题。\n2. 把页面间距收紧，让信息密度更高。",
    );
  });
});

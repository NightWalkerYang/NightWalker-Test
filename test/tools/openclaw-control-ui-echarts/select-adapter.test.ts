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

  it("renders strict JSON when code block text contains invisible whitespace characters", async () => {
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
      source:
        "{\n\u200b\u200b\"title\": \"下一步你要我把页面继续改成哪种方向？\",\n\u00a0\u00a0\"description\": \"我可以直接在现有页面基础上继续深化。\",\n\u00a0\u00a0\"submitLabel\": \"按所选继续设计\",\n\u202f\u202f\"defaultValue\": \"finance-dashboard\",\n\u00a0\u00a0\"options\": [\n\u00a0\u00a0\u00a0\u00a0{\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"value\": \"finance-dashboard\",\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"label\": \"改成财务分析大屏\",\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"description\": \"更偏收入、成本、利润、现金流展示\",\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"prompt\": \"把这版页面继续改成财务分析大屏，突出收入、成本、利润和现金流。\"\n\u00a0\u00a0\u00a0\u00a0},\n\u00a0\u00a0\u00a0\u00a0{\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"value\": \"official-website\",\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"label\": \"改成官网首页\",\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"description\": \"更偏品牌展示、产品介绍和转化按钮\",\n\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\"prompt\": \"把这版页面改成官网首页风格，突出品牌展示、产品介绍和行动按钮。\"\n\u00a0\u00a0\u00a0\u00a0}\n\u00a0\u00a0]\n}",
      wrapper,
      host,
      context: { json5: (await import("json5")).default },
      renderHostScaffold(currentHost) {
        const surface = document.createElement("div");
        currentHost.append(surface);
        return surface;
      },
    });

    expect(host.querySelector('[data-oc-select-card="single"]')).not.toBeNull();
    expect(
      host.querySelector('[data-oc-select-input="finance-dashboard"]'),
    ).not.toBeNull();
    expect(host.textContent).toContain("改成财务分析大屏");
  });

  it("renders a degraded fallback card instead of throwing when payload is malformed", async () => {
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
      source: "single-select {{{ not-valid-json",
      wrapper,
      host,
      context: { json5: (await import("json5")).default },
      renderHostScaffold(currentHost) {
        const surface = document.createElement("div");
        currentHost.append(surface);
        return surface;
      },
    });

    expect(host.textContent).toContain("已启用容错降级");
    const sendButton = host.querySelector<HTMLButtonElement>(
      '[data-oc-select-action="send"]',
    );
    expect(sendButton).not.toBeNull();
    sendButton?.click();
    expect(sendPromptToChat).toHaveBeenCalledTimes(1);
  });
});

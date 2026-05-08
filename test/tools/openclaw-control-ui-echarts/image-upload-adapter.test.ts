/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const insertPromptIntoChatBox = vi.fn(async () => true);
const sendPromptToChat = vi.fn(async () => true);
const uploadMemberImageAsset = vi.fn(async ({ workspacePath, slotId }) => ({
  uploadedItems: [
    {
      slotId,
      workspacePath,
      relativePath: workspacePath.startsWith("Echarts/assets/")
        ? `./assets/${workspacePath.slice("Echarts/assets/".length)}`
        : `./${workspacePath}`,
    },
  ],
}));

vi.mock("../../../tools/openclaw-control-ui-echarts/runtime/framework/chat-composer.js", () => ({
  insertPromptIntoChatBox,
  sendPromptToChat,
}));
vi.mock("../../../tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js", () => ({
  createTenantApiClient() {
    return {
      uploadMemberImageAsset,
    };
  },
}));
vi.mock("../../../tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js", () => ({
  readSelectedTenantAgent() {
    return { id: "tenant-agent-1" };
  },
}));

describe("image-upload adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    insertPromptIntoChatBox.mockClear();
    sendPromptToChat.mockClear();
    uploadMemberImageAsset.mockClear();
  });

  it("renders single-card multi-slot upload UI and gates continue by required slots", async () => {
    const { createImageUploadAdapter } =
      await import("../../../tools/openclaw-control-ui-echarts/runtime/image-upload/adapter.js");
    const adapter = createImageUploadAdapter({
      vendorBaseUrl: new URL("https://hailstone.cn:18789/assets/vendor/"),
    });

    const host = document.createElement("div");
    const wrapper = document.createElement("pre");
    wrapper.innerHTML = `<span class="code-block-lang">image-upload</span><code class="language-image-upload"></code>`;

    await adapter.renderContent({
      source: String.raw`{
  title: "上传官网素材",
  targetDir: "Echarts/assets",
  submitLabel: "素材已上传，继续生成页面",
  successPrompt: "素材已上传：{{uploadedList}}。请继续修改页面，并优先使用 ./assets 下的相对路径。",
  slots: [
    { id: "logo", label: "Logo", path: "logo.png", required: true },
    { id: "hero", label: "主页图片", path: "hero-banner.jpg", required: true }
  ]
}`,
      wrapper,
      context: { json5: (await import("json5")).default },
      renderHostScaffold(currentHost) {
        const surface = document.createElement("div");
        currentHost.append(surface);
        return surface;
      },
      host,
    });

    expect(host.querySelector('[data-oc-image-upload-trigger="logo"]')).not.toBeNull();
    expect(host.querySelector('[data-oc-image-upload-trigger="hero"]')).not.toBeNull();
    expect(host.textContent || "").not.toContain("Echarts/assets/logo.png");
    expect(host.textContent || "").not.toContain("Echarts/assets/hero-banner.jpg");

    const submitButton = host.querySelector<HTMLButtonElement>(
      '[data-oc-image-upload-action="submit"]',
    );
    expect(submitButton).not.toBeNull();
    expect(submitButton?.disabled).toBe(true);

    const fileInput = host.querySelector<HTMLInputElement>('[data-oc-image-upload-input="logo"]');
    expect(fileInput).not.toBeNull();

    const logoFile = new File(["abc"], "logo.png", { type: "image/png" });
    Object.defineProperty(fileInput!, "files", {
      configurable: true,
      value: [logoFile],
    });
    fileInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    const rerenderedSubmitButton = host.querySelector<HTMLButtonElement>(
      '[data-oc-image-upload-action="submit"]',
    );
    expect(rerenderedSubmitButton?.disabled).toBe(true);
    expect(uploadMemberImageAsset).toHaveBeenCalledTimes(0);
    expect(host.textContent || "").toContain("待上传");
    const logoPreview = host.querySelector<HTMLImageElement>(
      '[data-oc-image-upload-slot="logo"] .oc-image-upload-card__slot-preview-image',
    );
    expect(logoPreview?.getAttribute("src") || "").toContain("blob:");

    const heroInput = host.querySelector<HTMLInputElement>('[data-oc-image-upload-input="hero"]');
    const heroFile = new File(["xyz"], "hero-banner.jpg", { type: "image/jpeg" });
    Object.defineProperty(heroInput!, "files", {
      configurable: true,
      value: [heroFile],
    });
    heroInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    const enabledSubmitButton = host.querySelector<HTMLButtonElement>(
      '[data-oc-image-upload-action="submit"]',
    );
    expect(enabledSubmitButton?.disabled).toBe(false);
    expect(uploadMemberImageAsset).toHaveBeenCalledTimes(0);
    enabledSubmitButton?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(sendPromptToChat).toHaveBeenCalledTimes(1);
    const promptArg = sendPromptToChat.mock.calls[0]?.[0] || "";
    expect(promptArg).toContain("logo -> Echarts/assets/logo.png");
    expect(promptArg).toContain("hero -> Echarts/assets/hero-banner.jpg");
    expect(promptArg).toContain("./assets/logo.png");
    expect(promptArg).toContain("./assets/hero-banner.jpg");
    expect(uploadMemberImageAsset).toHaveBeenCalledTimes(2);
  });
});

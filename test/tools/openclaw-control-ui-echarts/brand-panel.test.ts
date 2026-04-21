/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { bootBrandPanel } from "../../../tools/openclaw-control-ui-echarts/runtime/branding/brand-panel.js";
import {
  getCurrentBrandState,
  resetBrandStateForTests,
} from "../../../tools/openclaw-control-ui-echarts/runtime/branding/brand-state.js";

const ONE_PIXEL_PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x04, 0x00, 0x00, 0x00, 0xb5, 0x1c, 0x0c, 0x02, 0x00, 0x00, 0x00,
  0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0xfc, 0xff, 0x1f, 0x00,
  0x03, 0x03, 0x02, 0x00, 0xef, 0xa7, 0x5f, 0xdb, 0x00, 0x00, 0x00, 0x00,
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function createApiClient() {
  return {
    getPublicBranding: vi.fn().mockResolvedValue({
      brandName: "苏博泰克",
      pageTitle: "苏博泰克",
      logoMode: "text",
      logoText: "SPTC",
      logoImage: null,
    }),
    savePlatformBranding: vi.fn().mockResolvedValue({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "text",
      logoText: "ACME",
      logoImage: null,
    }),
    restorePlatformBranding: vi.fn().mockResolvedValue({
      brandName: "苏博泰克",
      pageTitle: "苏博泰克",
      logoMode: "text",
      logoText: "SPTC",
      logoImage: null,
    }),
  };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.localStorage.clear();
  delete window.__openclawBrandPanelBooted;
  resetBrandStateForTests();
  vi.restoreAllMocks();
});

describe("zero-intrusive brand panel", () => {
  it("opens the brand settings panel when the platform-admin utility entry is clicked", async () => {
    const apiClient = createApiClient();
    document.body.innerHTML = `
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link oc-brand-settings-link" href="#">更改品牌</a>
      </div>
    `;

    bootBrandPanel({ apiClient });

    document.querySelector(".oc-brand-settings-link")?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const dialog = document.querySelector("[data-oc-brand-panel]");
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute("open")).toBe(true);
    expect(apiClient.getPublicBranding).toHaveBeenCalledTimes(1);
  });

  it("keeps text and image logo modes mutually exclusive", async () => {
    const apiClient = createApiClient();
    document.body.innerHTML = `
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link oc-brand-settings-link" href="#">更改品牌</a>
      </div>
    `;

    bootBrandPanel({ apiClient });
    document.querySelector(".oc-brand-settings-link")?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const mode = document.querySelector('[data-oc-brand-logo-mode]') as HTMLSelectElement;
    const textInput = document.querySelector('[data-oc-brand-logo-text]') as HTMLInputElement;
    const fileInput = document.querySelector('[data-oc-brand-logo-file]') as HTMLInputElement;

    mode.value = "image";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    expect(textInput.disabled).toBe(true);
    expect(fileInput.disabled).toBe(false);

    mode.value = "text";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    expect(textInput.disabled).toBe(false);
    expect(fileInput.disabled).toBe(true);
  });

  it("submits text branding through the tenant api client and applies the returned state", async () => {
    const apiClient = createApiClient();
    document.body.innerHTML = `
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link oc-brand-settings-link" href="#">更改品牌</a>
      </div>
    `;

    bootBrandPanel({ apiClient });
    document.querySelector(".oc-brand-settings-link")?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    (document.querySelector('[data-oc-brand-name]') as HTMLInputElement).value = "Acme AI";
    (document.querySelector('[data-oc-brand-page-title]') as HTMLInputElement).value =
      "Acme AI Console";
    (document.querySelector('[data-oc-brand-logo-text]') as HTMLInputElement).value = "ACME";

    document.querySelector("[data-oc-brand-form]")?.dispatchEvent(
      new Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    expect(apiClient.savePlatformBranding).toHaveBeenCalledWith({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "text",
      logoText: "ACME",
    });
    expect(getCurrentBrandState()).toMatchObject({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoText: "ACME",
    });
  });

  it("submits image branding through the tenant api client with a data URL payload", async () => {
    const apiClient = createApiClient();
    apiClient.savePlatformBranding.mockResolvedValue({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "image",
      logoText: "",
      logoImage: {
        fileName: "logo.png",
        mimeType: "image/png",
        src: "/tenant-platform-api/v1/public/branding/logo?v=1",
      },
    });
    document.body.innerHTML = `
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link oc-brand-settings-link" href="#">更改品牌</a>
      </div>
    `;

    bootBrandPanel({ apiClient });
    document.querySelector(".oc-brand-settings-link")?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    const mode = document.querySelector('[data-oc-brand-logo-mode]') as HTMLSelectElement;
    mode.value = "image";
    mode.dispatchEvent(new Event("change", { bubbles: true }));

    const file = new File([ONE_PIXEL_PNG_BYTES], "logo.png", { type: "image/png" });
    const fileInput = document.querySelector('[data-oc-brand-logo-file]') as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });

    (document.querySelector('[data-oc-brand-name]') as HTMLInputElement).value = "Acme AI";
    (document.querySelector('[data-oc-brand-page-title]') as HTMLInputElement).value =
      "Acme AI Console";

    document.querySelector("[data-oc-brand-form]")?.dispatchEvent(
      new Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();
    await flushAsync();

    expect(apiClient.savePlatformBranding).toHaveBeenCalledWith(
      expect.objectContaining({
        brandName: "Acme AI",
        pageTitle: "Acme AI Console",
        logoMode: "image",
        logoImageDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    );
    expect(getCurrentBrandState()).toMatchObject({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "image",
    });
  });

  it("keeps the existing image logo when only text fields are updated", async () => {
    const apiClient = createApiClient();
    apiClient.getPublicBranding.mockResolvedValue({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "image",
      logoText: "",
      logoImage: {
        fileName: "logo.png",
        mimeType: "image/png",
        src: "/tenant-platform-api/v1/public/branding/logo?v=1",
      },
    });
    apiClient.savePlatformBranding.mockResolvedValue({
      brandName: "Acme AI Plus",
      pageTitle: "Acme AI Console Plus",
      logoMode: "image",
      logoText: "",
      logoImage: {
        fileName: "logo.png",
        mimeType: "image/png",
        src: "/tenant-platform-api/v1/public/branding/logo?v=2",
      },
    });
    document.body.innerHTML = `
      <div class="sidebar-utility-group">
        <a class="sidebar-utility-link oc-brand-settings-link" href="#">更改品牌</a>
      </div>
    `;

    bootBrandPanel({ apiClient });
    document.querySelector(".oc-brand-settings-link")?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    (document.querySelector('[data-oc-brand-name]') as HTMLInputElement).value = "Acme AI Plus";
    (document.querySelector('[data-oc-brand-page-title]') as HTMLInputElement).value =
      "Acme AI Console Plus";

    document.querySelector("[data-oc-brand-form]")?.dispatchEvent(
      new Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsync();

    expect(apiClient.savePlatformBranding).toHaveBeenCalledWith({
      brandName: "Acme AI Plus",
      pageTitle: "Acme AI Console Plus",
      logoMode: "image",
      keepExistingLogoImage: true,
    });
    expect(getCurrentBrandState()).toMatchObject({
      brandName: "Acme AI Plus",
      pageTitle: "Acme AI Console Plus",
      logoMode: "image",
      logoImage: {
        src: "/tenant-platform-api/v1/public/branding/logo?v=2",
      },
    });
  });
});

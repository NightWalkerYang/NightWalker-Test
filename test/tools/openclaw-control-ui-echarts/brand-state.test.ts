/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootBrandStateSync,
  BRAND_STATE_SYNC_STORAGE_KEY,
  getCurrentBrandState,
  loadBrandState,
  resetBrandStateForTests,
  setCurrentBrandState,
  subscribeBrandState,
} from "../../../tools/openclaw-control-ui-echarts/runtime/branding/brand-state.js";

afterEach(() => {
  resetBrandStateForTests();
});

describe("zero-intrusive brand state", () => {
  it("falls back to built-in defaults when the public branding API is unavailable", async () => {
    const state = await loadBrandState(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(state.brandName).toBe("苏博泰克");
    expect(state.pageTitle).toBe("苏博泰克");
    expect(state.logoMode).toBe("text");
    expect(state.logoText).toBe("SPTC");
  });

  it("prefers the public branding payload when available", async () => {
    const state = await loadBrandState(async () => ({
      json: async () => ({
        ok: true,
        data: {
          brandName: "Acme AI",
          pageTitle: "Acme AI Console",
          logoMode: "text",
          logoText: "ACME",
        },
      }),
    }));

    expect(state.brandName).toBe("Acme AI");
    expect(state.pageTitle).toBe("Acme AI Console");
    expect(state.logoText).toBe("ACME");
    expect(getCurrentBrandState().brandName).toBe("Acme AI");
  });

  it("notifies subscribers when the resolved brand state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBrandState(listener);

    setCurrentBrandState({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "text",
      logoText: "ACME",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        brandName: "Acme AI",
        pageTitle: "Acme AI Console",
        logoText: "ACME",
      }),
    );

    unsubscribe();
  });

  it("applies cross-tab branding updates from storage events", () => {
    const listener = vi.fn();
    subscribeBrandState(listener);
    bootBrandStateSync();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: BRAND_STATE_SYNC_STORAGE_KEY,
        newValue: JSON.stringify({
          brandName: "Acme AI",
          pageTitle: "Acme AI Console",
          logoMode: "text",
          logoText: "ACME",
        }),
      }),
    );

    expect(getCurrentBrandState()).toMatchObject({
      brandName: "Acme AI",
      pageTitle: "Acme AI Console",
      logoMode: "text",
      logoText: "ACME",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

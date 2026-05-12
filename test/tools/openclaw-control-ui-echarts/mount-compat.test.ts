/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureFallbackMountRoot,
  observeMountTargets,
  resolvePrimaryMountRoot,
} from "../../../tools/openclaw-control-ui-echarts/runtime/framework/mount-compat.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("mount compat", () => {
  it("resolves the native content root without requiring the exact .content selector", () => {
    document.body.innerHTML = `
      <main class="workspace-content">
        <div>native</div>
      </main>
    `;

    expect(resolvePrimaryMountRoot(document, "", "test")?.tagName.toLowerCase()).toBe("main");
  });

  it("creates a fallback mount root when native content is unavailable", () => {
    document.body.innerHTML = `<openclaw-app></openclaw-app>`;

    const fallback = ensureFallbackMountRoot(document, "tenant-surface", "test");

    expect(fallback).toBeInstanceOf(HTMLElement);
    expect(fallback?.classList.contains("content")).toBe(true);
    expect(fallback?.hasAttribute("data-oc-tenant-surface-fallback")).toBe(true);
  });

  it("observes later mount-target insertion", async () => {
    const callback = vi.fn();
    const disconnect = observeMountTargets(document, callback, "test");

    document.body.innerHTML = `<main class="workspace-content"></main>`;
    await Promise.resolve();
    await Promise.resolve();

    expect(callback).toHaveBeenCalled();
    disconnect();
  });
});

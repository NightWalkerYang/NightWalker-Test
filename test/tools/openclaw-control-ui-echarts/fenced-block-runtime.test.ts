/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createFencedBlockRuntime } from "../../../tools/openclaw-control-ui-echarts/runtime/framework/fenced-block-runtime.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("zero-intrusive fenced-block runtime", () => {
  it("installs framework styles on boot even before any blocks render", async () => {
    document.body.innerHTML = `<div id="app"></div>`;

    const runtime = createFencedBlockRuntime([
      {
        id: "dummy",
        languageAliases: new Set(["dummy"]),
        uiText: {
          badge: "Dummy",
          loadingTitle: "Loading",
          loadingRuntimeDetail: "Loading runtime",
          loadingStreamingDetail: "Loading stream",
          summaryLoading: "Loading",
          summaryError: "Error",
          summarySuccess: "Success",
          errorTitle: "Error",
        },
        getStyles() {
          return ".oc-test-adapter { color: red; }";
        },
        async ensureReady() {
          return {};
        },
        localizeErrorMessage(detail) {
          return detail;
        },
        async renderContent() {
          return null;
        },
      },
    ]);

    runtime.boot();
    await Promise.resolve();

    const styleText = [...document.head.querySelectorAll("style")]
      .map((element) => element.textContent || "")
      .join("\n");

    expect(styleText).toContain(".agent-chat__input");
    expect(styleText).toContain(".oc-test-adapter { color: red; }");
  });

  it("warms adapter libraries on boot before fenced blocks appear", async () => {
    const preload = vi.fn(async () => ({}));
    const runtime = createFencedBlockRuntime([
      {
        id: "dummy",
        languageAliases: new Set(["dummy"]),
        uiText: {
          badge: "Dummy",
          loadingTitle: "Loading",
          loadingRuntimeDetail: "Loading runtime",
          loadingStreamingDetail: "Loading stream",
          summaryLoading: "Loading",
          summaryError: "Error",
          summarySuccess: "Success",
          errorTitle: "Error",
        },
        getStyles() {
          return "";
        },
        preload,
        async ensureReady() {
          return {};
        },
        localizeErrorMessage(detail) {
          return detail;
        },
        async renderContent() {
          return null;
        },
      },
    ]);

    runtime.boot();
    await Promise.resolve();
    await Promise.resolve();

    expect(preload).toHaveBeenCalledTimes(1);
  });

  it("renders fenced blocks that are inserted after boot without rescanning the whole page first", async () => {
    const renderContent = vi.fn(async ({ host, renderHostScaffold, wrapper }) => {
      renderHostScaffold(host, wrapper, "success", "");
      return null;
    });

    document.body.innerHTML = `<div id="app"></div>`;

    const runtime = createFencedBlockRuntime([
      {
        id: "dummy",
        languageAliases: new Set(["dummy"]),
        uiText: {
          badge: "Dummy",
          loadingTitle: "Loading",
          loadingRuntimeDetail: "Loading runtime",
          loadingStreamingDetail: "Loading stream",
          summaryLoading: "Loading",
          summaryError: "Error",
          summarySuccess: "Success",
          errorTitle: "Error",
        },
        getStyles() {
          return "";
        },
        async ensureReady() {
          return {};
        },
        localizeErrorMessage(detail) {
          return detail;
        },
        renderContent,
      },
    ]);

    runtime.boot();
    await Promise.resolve();

    document.querySelector("#app")?.insertAdjacentHTML(
      "beforeend",
      `
        <pre class="code-block-wrapper">
          <span class="code-block-lang">dummy</span>
          <code class="language-dummy">dummy payload</code>
        </pre>
      `,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(renderContent).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".oc-block-renderer--dummy")).not.toBeNull();
  });
});

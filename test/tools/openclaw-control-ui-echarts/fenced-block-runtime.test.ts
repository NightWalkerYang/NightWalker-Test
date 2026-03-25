/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
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
});

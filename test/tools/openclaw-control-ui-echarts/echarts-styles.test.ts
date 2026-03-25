import { describe, expect, it } from "vitest";
import { getEchartsStyles } from "../../../tools/openclaw-control-ui-echarts/runtime/echarts/styles.js";

describe("zero-intrusive echarts styles", () => {
  it("keeps charts on the same blue commercial palette as the chat page", () => {
    const styles = getEchartsStyles();

    expect(styles).toContain(".oc-block-renderer--echarts,\n    .oc-echarts-detail-modal");
    expect(styles).toContain("--accent: #7eaad4;");
    expect(styles).toContain(".oc-block-renderer--echarts .oc-block-renderer__badge");
    expect(styles).not.toContain("#f59e0b");
    expect(styles).not.toContain("#f97316");
  });
});

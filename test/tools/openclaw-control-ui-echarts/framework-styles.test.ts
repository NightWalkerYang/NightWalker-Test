import { describe, expect, it } from "vitest";
import { getFrameworkStyles } from "../../../tools/openclaw-control-ui-echarts/runtime/framework/styles.js";

describe("zero-intrusive framework styles", () => {
  it("collapses focus mode into a pure chat canvas", () => {
    const styles = getFrameworkStyles();

    expect(styles).toContain(".shell--chat-focus .topbar");
    expect(styles).toContain(".shell--chat-focus .content-header");
    expect(styles).toContain(".shell--chat-focus .agent-chat__search-bar");
    expect(styles).toContain(".shell--chat-focus .chat-queue");
    expect(styles).toContain(".shell--chat-focus .chat-sidebar");
    expect(styles).toContain(".shell--chat-focus resizable-divider");
    expect(styles).toContain(".shell--chat-focus .card.chat");
    expect(styles).toContain("grid-template-rows: 0 minmax(0, 1fr) !important");
  });
});

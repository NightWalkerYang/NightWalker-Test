import { describe, expect, it } from "vitest";
import { getFrameworkStyles } from "../../../tools/openclaw-control-ui-echarts/runtime/framework/styles.js";

describe("zero-intrusive framework styles", () => {
  it("does not override native focus mode shell selectors", () => {
    const styles = getFrameworkStyles();

    expect(styles).not.toContain(".shell--chat-focus .topbar");
    expect(styles).not.toContain(".shell--chat-focus .chat-sidebar");
  });

  it("restyles the native chat composer without changing its footprint selectors", () => {
    const styles = getFrameworkStyles();

    expect(styles).toContain(".content--chat");
    expect(styles).toContain("--accent: #7eaad4;");
    expect(styles).toContain(".agent-chat__input");
    expect(styles).toContain(".agent-chat__input::after");
    expect(styles).toContain(".chat-attachments-preview");
    expect(styles).toContain(".agent-chat__toolbar");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(styles).toContain(".agent-chat__toolbar-left");
    expect(styles).toContain(".chat-send-btn");
    expect(styles).toContain(".agent-chat__input-btn");
  });
});

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
    expect(styles).toContain(".chat-avatar");
    expect(styles).toContain("display: none;");
    expect(styles).toContain(".agent-chat__input");
    expect(styles).toContain("background: transparent;");
    expect(styles).toContain(".chat-attachments-preview");
    expect(styles).toContain(".agent-chat__toolbar");
    expect(styles).toContain("position: static;");
    expect(styles).toContain("justify-content: center;");
    expect(styles).toContain("display: contents;");
    expect(styles).toContain(".chat-send-btn");
    expect(styles).toContain("position: absolute;");
    expect(styles).toContain("min-height: 56px;");
    expect(styles).toContain(".agent-chat__input-btn");
  });
});

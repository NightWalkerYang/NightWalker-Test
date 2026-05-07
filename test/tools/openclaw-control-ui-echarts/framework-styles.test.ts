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
    expect(styles).toContain(".oc-chat-ambient");
    expect(styles).toContain(".oc-chat-ambient__svg");
    expect(styles).toContain("@keyframes oc-chat-ambient-sway");
    expect(styles).toContain("@keyframes oc-chat-ambient-trace");
    expect(styles).toContain(".oc-text-logo");
    expect(styles).toContain(".oc-text-logo--sidebar");
    expect(styles).toContain(".oc-text-logo--badge");
    expect(styles).toContain(".oc-image-logo");
    expect(styles).toContain(".oc-image-logo--sidebar");
    expect(styles).toContain("object-fit: contain;");
    expect(styles).toContain(".chat-avatar");
    expect(styles).toContain("display: none;");
    expect(styles).toContain(".chat-group.user .chat-bubble");
    expect(styles).toContain("[data-oc-tool-run]");
    expect(styles).toContain('[data-oc-tool-run-hidden="true"]');
    expect(styles).toContain('[data-oc-tool-run-stack="true"]');
    expect(styles).toContain('[data-oc-tool-run-entry-hidden="true"]');
    expect(styles).toContain("display: none !important;");
    expect(styles).toContain(".oc-tool-run-cluster");
    expect(styles).toContain(".oc-tool-run-cluster__toggle");
    expect(styles).toContain('data-oc-tool-run-open="true"');
    expect(styles).toContain('.chat-group[data-oc-tool-run="start"] .chat-group-footer');
    expect(styles).toContain('.chat-group[data-oc-tool-run="mid"] .chat-bubble');
    expect(styles).toContain("--oc-chat-user-bubble-bg");
    expect(styles).toContain("color: var(--oc-chat-user-bubble-text);");
    expect(styles).toContain('[data-oc-voice-recording="true"]');
    expect(styles).toContain('[data-oc-voice-state="starting"]');
    expect(styles).toContain('[data-oc-voice-state="recording"]');
    expect(styles).toContain(".oc-voice-status");
    expect(styles).toContain(".oc-voice-status--active");
    expect(styles).toContain(".agent-chat__input-btn--pending");
    expect(styles).toContain(
      ".agent-chat__input-btn--recording:not(.agent-chat__input-btn--pending)",
    );
    expect(styles).toContain("@keyframes oc-voice-pulse");
    expect(styles).toContain(".chat-attachments-preview");
    expect(styles).toContain(".chat-send-btn");
    expect(styles).toContain(".agent-chat__input-btn");
  });

  it("does not redraw the native chat composer shell in the zero-intrusive layer", () => {
    const styles = getFrameworkStyles();

    expect(styles).not.toContain(".agent-chat__input::before");
    expect(styles).not.toContain(".agent-chat__input::after");
    expect(styles).not.toContain("border-radius: 24px;");
    expect(styles).not.toContain("display: contents;");
  });
});

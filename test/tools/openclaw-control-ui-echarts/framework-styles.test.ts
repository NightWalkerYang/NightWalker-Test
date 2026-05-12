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

    expect(styles).toContain('[data-oc-chat-surface="true"]');
    expect(styles).toContain("--accent: #7eaad4;");
    expect(styles).toContain(".oc-chat-ambient");
    expect(styles).toContain(".oc-chat-ambient__svg");
    expect(styles).toContain("@keyframes oc-chat-ambient-sway");
    expect(styles).toContain("@keyframes oc-chat-ambient-trace");
    expect(styles).toContain(':root[data-oc-member-chat-route="true"] .oc-chat-ambient');
    expect(styles).toContain(
      ':root[data-oc-member-chat-route="true"] :is([data-oc-chat-surface="true"], .content--chat, .shell--chat-focus .content)',
    );
    expect(styles).toContain(
      ':root[data-oc-member-chat-route="true"] :is([data-oc-chat-composer="true"], .agent-chat__input)',
    );
    expect(styles).toContain(".oc-text-logo");
    expect(styles).toContain(".oc-text-logo--sidebar");
    expect(styles).toContain(".oc-text-logo--badge");
    expect(styles).toContain(".oc-image-logo");
    expect(styles).toContain(".oc-image-logo--sidebar");
    expect(styles).toContain("object-fit: contain;");
    expect(styles).toContain('[data-oc-chat-avatar="true"]');
    expect(styles).toContain("display: none;");
    expect(styles).toContain('[data-oc-chat-group-role="user"] [data-oc-chat-bubble="true"]');
    expect(styles).toContain("[data-oc-tool-run]");
    expect(styles).toContain('[data-oc-tool-run-hidden="true"]');
    expect(styles).toContain('[data-oc-tool-run-stack="true"]');
    expect(styles).toContain('[data-oc-tool-run-entry-hidden="true"]');
    expect(styles).toContain("display: none !important;");
    expect(styles).toContain(".oc-tool-run-cluster");
    expect(styles).toContain(".oc-tool-run-cluster__toggle");
    expect(styles).toContain('data-oc-tool-run-open="true"');
    expect(styles).toContain('[data-oc-chat-group-footer="true"]');
    expect(styles).toContain('[data-oc-chat-bubble="true"]');
    expect(styles).toContain("--oc-chat-user-bubble-bg");
    expect(styles).toContain("color: var(--oc-chat-user-bubble-text);");
    expect(styles).toContain('[data-oc-chat-composer="true"]');
    expect(styles).toContain("overflow: hidden;");
    expect(styles).toContain("border-radius: 24px;");
    expect(styles).toContain('[data-oc-chat-composer="true"]');
    expect(styles).toContain(":focus-within");
    expect(styles).toContain(".agent-chat__composer-combobox > textarea");
    expect(styles).toContain('[data-oc-voice-recording="true"]');
    expect(styles).toContain('[data-oc-voice-state="starting"]');
    expect(styles).toContain('[data-oc-voice-state="recording"]');
    expect(styles).toContain(".oc-voice-status");
    expect(styles).toContain(".oc-voice-status--active");
    expect(styles).toContain('[data-oc-chat-button-state="pending"]');
    expect(styles).toContain('[data-oc-chat-button-state="recording"]');
    expect(styles).toContain("@keyframes oc-voice-pulse");
    expect(styles).toContain(".chat-attachments-preview");
    expect(styles).toContain('[data-oc-chat-toolbar="true"]');
    expect(styles).toContain('[data-oc-chat-send-button="true"]');
    expect(styles).toContain('[data-oc-chat-action-button="true"]');
  });

  it("keeps the native chat composer structure while avoiding the old intrusive redraw", () => {
    const styles = getFrameworkStyles();

    expect(styles).not.toContain(".agent-chat__input::before");
    expect(styles).not.toContain(".agent-chat__input::after");
    expect(styles).not.toContain("display: contents;");
  });
});

export function getFrameworkStyles() {
  const memberChatRouteRoot = ':root[data-oc-member-chat-route="true"]';
  const chatSurfaceRoot =
    ':is([data-oc-chat-surface="true"], .content--chat, .shell--chat-focus .content)';
  const memberChatSurfaceRoot = `${memberChatRouteRoot} ${chatSurfaceRoot}`;
  const composerRoot = ':is([data-oc-chat-composer="true"], .agent-chat__input)';
  const memberChatComposerRoot = `${memberChatRouteRoot} ${composerRoot}`;
  const toolbarRoot = ':is([data-oc-chat-toolbar="true"], .agent-chat__toolbar)';
  const actionButtonRoot =
    ':is([data-oc-chat-action-button="true"], .agent-chat__input-btn, .agent-chat__toolbar .btn--ghost)';
  const sendButtonRoot = ':is([data-oc-chat-send-button="true"], .chat-send-btn)';
  const stopButtonRoot = ':is([data-oc-chat-stop-button="true"], .chat-send-btn--stop)';
  const chatAvatarRoot = ':is([data-oc-chat-avatar="true"], .chat-avatar)';
  const chatGroupRoot = ':is([data-oc-chat-group="true"], .chat-group)';
  const userBubbleRoot =
    ':is([data-oc-chat-group-role="user"] [data-oc-chat-bubble="true"], .chat-group.user .chat-bubble)';
  const userBubbleTextRoot =
    ':is([data-oc-chat-group-role="user"] [data-oc-chat-text="true"], [data-oc-chat-group-role="user"] [data-oc-chat-bubble="true"] p, [data-oc-chat-group-role="user"] [data-oc-chat-bubble="true"] li, [data-oc-chat-group-role="user"] [data-oc-chat-bubble="true"] code, .chat-group.user .chat-bubble .chat-text, .chat-group.user .chat-bubble p, .chat-group.user .chat-bubble li, .chat-group.user .chat-bubble code)';
  const assistantGroupRoot = ':is([data-oc-chat-group-role="assistant"], .chat-group.assistant)';
  const welcomeAvatarRoot =
    ':is([data-oc-chat-welcome-avatar="true"], .agent-chat__welcome > img, .agent-chat__welcome .agent-chat__avatar, .agent-chat__welcome .agent-chat__avatar--logo)';
  return `
    ${chatSurfaceRoot} {
      --accent: #7eaad4;
      --accent-hover: #96bce0;
      --accent-muted: #7eaad4;
      --accent-subtle: rgba(126, 170, 212, 0.16);
      --accent-foreground: #f8fbff;
      --accent-glow: rgba(126, 170, 212, 0.24);
      --accent-2: #5f88b1;
      --accent-2-muted: rgba(95, 136, 177, 0.72);
      --accent-2-subtle: rgba(95, 136, 177, 0.14);
      --danger: #759bc3;
      --danger-muted: rgba(117, 155, 195, 0.76);
      --danger-subtle: rgba(117, 155, 195, 0.14);
      --ring: rgba(126, 170, 212, 0.42);
      --focus-glow: 0 0 0 2px var(--bg), 0 0 0 3px var(--ring), 0 0 18px var(--accent-glow);
      --shadow-glow: 0 0 24px var(--accent-glow);
      --primary: #7eaad4;
      --primary-foreground: #f8fbff;
      --oc-chat-user-bubble-bg: rgba(255, 255, 255, 0.96);
      --oc-chat-user-bubble-bg-hover: rgba(255, 255, 255, 0.99);
      --oc-chat-user-bubble-border: rgba(223, 231, 241, 0.96);
      --oc-chat-user-bubble-text: #26384d;
      --oc-chat-user-bubble-shadow: 0 14px 34px rgba(64, 92, 126, 0.1);
    }

    :root[data-theme-mode="light"] ${chatSurfaceRoot} {
      --accent: #5d88b5;
      --accent-hover: #729bc5;
      --accent-muted: #5d88b5;
      --accent-subtle: rgba(93, 136, 181, 0.12);
      --accent-foreground: #ffffff;
      --accent-glow: rgba(93, 136, 181, 0.18);
      --accent-2: #7a9fc8;
      --accent-2-muted: rgba(122, 159, 200, 0.74);
      --accent-2-subtle: rgba(122, 159, 200, 0.12);
      --danger: #678db8;
      --danger-muted: rgba(103, 141, 184, 0.72);
      --danger-subtle: rgba(103, 141, 184, 0.12);
      --ring: rgba(93, 136, 181, 0.3);
      --focus-glow: 0 0 0 2px var(--bg), 0 0 0 3px var(--ring), 0 0 14px var(--accent-glow);
      --shadow-glow: 0 0 20px var(--accent-glow);
      --primary: #5d88b5;
      --primary-foreground: #ffffff;
      --oc-chat-user-bubble-bg: rgba(255, 255, 255, 0.98);
      --oc-chat-user-bubble-bg-hover: rgba(255, 255, 255, 1);
      --oc-chat-user-bubble-border: rgba(220, 229, 239, 0.98);
      --oc-chat-user-bubble-text: #233246;
      --oc-chat-user-bubble-shadow: 0 12px 28px rgba(40, 64, 92, 0.08);
    }

    ${chatSurfaceRoot} {
      position: relative;
      --oc-chat-surface-top: #f8fbff;
      --oc-chat-surface-bottom: #eef3fa;
      background:
        radial-gradient(circle at 14% 84%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 24%),
        radial-gradient(circle at 82% 34%, color-mix(in srgb, var(--accent-2) 10%, transparent), transparent 24%),
        linear-gradient(180deg, var(--oc-chat-surface-top), var(--oc-chat-surface-bottom));
    }

    :root[data-theme-mode="dark"] ${chatSurfaceRoot} {
      --oc-chat-surface-top: #111b27;
      --oc-chat-surface-bottom: #142033;
    }

    ${memberChatSurfaceRoot} {
      --oc-chat-user-bubble-shadow: 0 6px 16px rgba(40, 64, 92, 0.06);
      background: linear-gradient(180deg, var(--oc-chat-surface-top), var(--oc-chat-surface-bottom));
    }

    ${chatSurfaceRoot} .callout.danger {
      border-color: color-mix(in srgb, var(--danger) 26%, var(--border) 74%);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--danger-subtle) 92%, transparent), color-mix(in srgb, var(--panel, var(--card)) 90%, transparent));
      color: color-mix(in srgb, var(--danger) 82%, var(--text) 18%);
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
    }

    .oc-text-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--text) 56%, var(--accent) 44%);
      background:
        linear-gradient(145deg, color-mix(in srgb, white 86%, transparent), color-mix(in srgb, var(--accent-subtle) 72%, transparent));
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border) 82%);
      box-shadow:
        0 12px 26px color-mix(in srgb, var(--bg, #020617) 8%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 46%, transparent);
      user-select: none;
      white-space: nowrap;
    }

    .oc-text-logo--sidebar,
    .oc-text-logo--avatar {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      font-size: 10px;
    }

    .oc-text-logo--login,
    .oc-text-logo--hero {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      font-size: 12px;
    }

    .oc-text-logo--badge {
      height: 18px;
      padding: 0 8px;
      margin-right: 6px;
      border-radius: 999px;
      font-size: 9px;
      letter-spacing: 0.18em;
      vertical-align: middle;
    }

    .agent-chat__avatar--logo > .oc-text-logo--hero {
      width: 100%;
      height: 100%;
      border-radius: inherit;
      border: 0;
      box-shadow: none;
      background:
        linear-gradient(145deg, color-mix(in srgb, white 74%, transparent), color-mix(in srgb, var(--accent-subtle) 78%, transparent));
    }

    .oc-image-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border) 84%);
      background: color-mix(in srgb, var(--panel, var(--card)) 82%, transparent);
      box-shadow:
        0 10px 22px color-mix(in srgb, var(--bg, #020617) 7%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 34%, transparent);
      vertical-align: middle;
    }

    .oc-image-logo > img {
      display: block;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .oc-image-logo--sidebar,
    .oc-image-logo--avatar {
      width: 32px;
      height: 32px;
      max-width: 32px;
      max-height: 32px;
      border-radius: 10px;
    }

    .sidebar-brand .oc-image-logo--sidebar {
      flex: 0 0 32px;
      min-width: 32px;
    }

    .oc-image-logo--login,
    .oc-image-logo--hero {
      width: 48px;
      height: 48px;
      max-width: 48px;
      max-height: 48px;
      border-radius: 14px;
    }

    .oc-image-logo--badge {
      width: auto;
      max-width: 72px;
      height: 18px;
      padding: 0 6px;
      margin-right: 6px;
      border-radius: 999px;
    }

    .oc-image-logo--badge > img {
      width: auto;
      max-width: 60px;
    }

    .agent-chat__avatar--logo > .oc-image-logo--hero {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      border-radius: inherit;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    ${chatSurfaceRoot} ${chatAvatarRoot},
    ${chatSurfaceRoot} .oc-text-logo--avatar,
    ${chatSurfaceRoot} .oc-image-logo--avatar {
      display: none;
    }

    ${chatSurfaceRoot} ${chatGroupRoot} {
      gap: 0;
      margin-left: 0;
      margin-right: 0;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] {
      margin-bottom: 0;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-hidden="true"] {
      display: none !important;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-chat-group-messages="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] .chat-group-messages {
      gap: 0;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry-hidden="true"] {
      display: none !important;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="mid"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="end"] {
      margin-top: -1px;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] [data-oc-chat-group-messages="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] .chat-group-messages {
      gap: 0;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="start"] [data-oc-chat-group-footer="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="start"] .chat-group-footer,
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="mid"] [data-oc-chat-group-footer="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="mid"] .chat-group-footer {
      display: none;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] [data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] .chat-bubble {
      position: relative;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 96%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 94%, transparent));
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
        0 10px 24px color-mix(in srgb, var(--bg, #020617) 5%, transparent);
    }

    ${memberChatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] [data-oc-chat-bubble="true"],
    ${memberChatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] .chat-bubble {
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
        0 4px 12px color-mix(in srgb, var(--bg, #020617) 4%, transparent);
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="start"] [data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="start"] .chat-bubble {
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="mid"] [data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="mid"] .chat-bubble {
      border-top: 0;
      border-radius: 0;
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--border) 54%, transparent);
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="end"] [data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="end"] .chat-bubble {
      border-top: 0;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] [data-oc-chat-tool-msg-summary="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] .chat-tool-msg-summary,
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] [data-oc-chat-tools-summary="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run] .chat-tools-summary,
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-chat-tool-msg-summary="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] .chat-tool-msg-summary,
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-chat-tools-summary="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] .chat-tools-summary {
      position: relative;
      min-height: 34px;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="end"] [data-oc-chat-group-footer="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run="end"] .chat-group-footer {
      margin-top: 8px;
      padding-left: 2px;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster:not([data-oc-tool-run-open="true"]) > ${chatGroupRoot}[data-oc-tool-run="end"] {
      margin-top: 0;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster:not([data-oc-tool-run-open="true"]) > ${chatGroupRoot}[data-oc-tool-run="end"] [data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} .oc-tool-run-cluster:not([data-oc-tool-run-open="true"]) > ${chatGroupRoot}[data-oc-tool-run="end"] .chat-bubble {
      border-top: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
      border-radius: 18px;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster > ${chatGroupRoot}[data-oc-tool-run="end"] [data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} .oc-tool-run-cluster > ${chatGroupRoot}[data-oc-tool-run="end"] .chat-bubble {
      padding-right: 52px;
    }

    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry="end"] > [data-oc-chat-tools-summary="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry="end"] > .chat-tools-summary,
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry="end"] > [data-oc-chat-tool-msg-summary="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry="end"] > .chat-tool-msg-summary,
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry="end"][data-oc-chat-bubble="true"],
    ${chatSurfaceRoot} ${chatGroupRoot}[data-oc-tool-run-stack="true"] [data-oc-tool-run-entry="end"].chat-bubble {
      padding-right: 52px;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster__toggle {
      position: absolute;
      top: 10px;
      right: 12px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel, var(--card)) 88%, transparent);
      color: color-mix(in srgb, var(--text) 70%, var(--accent) 30%);
      box-shadow:
        0 10px 22px color-mix(in srgb, var(--bg, #020617) 7%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 34%, transparent);
      cursor: pointer;
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        color 180ms ease,
        box-shadow 180ms ease;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster__toggle:hover {
      color: color-mix(in srgb, var(--accent) 76%, white 24%);
      border-color: color-mix(in srgb, var(--accent) 36%, white 64%);
      background: color-mix(in srgb, var(--panel, var(--card)) 72%, var(--accent) 28%);
      box-shadow:
        0 14px 28px color-mix(in srgb, var(--bg, #020617) 9%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 42%, transparent);
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster__toggle:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--accent) 56%, white 44%);
      outline-offset: 2px;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster__toggle-icon {
      width: 12px;
      height: 12px;
      transition: transform 180ms ease;
    }

    ${chatSurfaceRoot} .oc-tool-run-cluster[data-oc-tool-run-open="true"] .oc-tool-run-cluster__toggle-icon {
      transform: rotate(180deg);
    }

    ${chatSurfaceRoot} ${userBubbleRoot} {
      background: var(--oc-chat-user-bubble-bg);
      border-color: var(--oc-chat-user-bubble-border);
      color: var(--oc-chat-user-bubble-text);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.88),
        var(--oc-chat-user-bubble-shadow);
    }

    ${chatSurfaceRoot} ${userBubbleRoot}:hover {
      background: var(--oc-chat-user-bubble-bg-hover);
      border-color: color-mix(in srgb, var(--oc-chat-user-bubble-border) 82%, white 18%);
    }

    ${chatSurfaceRoot} ${userBubbleTextRoot} {
      color: inherit;
    }

    .oc-block-renderer {
      margin: 12px 0;
      border: 1px solid rgba(127, 127, 127, 0.24);
      border-radius: 14px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
        rgba(127, 127, 127, 0.04);
    }

    .chat-bubble[data-oc-block-loading="true"] > .chat-bubble-actions {
      display: none;
    }

    ${composerRoot} {
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid
        color-mix(in srgb, var(--border-strong, var(--border)) 38%, transparent);
      border-radius: 24px;
      background:
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--card) 96%, rgba(255, 255, 255, 0.03)),
          color-mix(in srgb, var(--panel, var(--card)) 94%, transparent)
        );
      box-shadow:
        0 18px 42px color-mix(in srgb, var(--bg, #020617) 12%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
    }

    ${memberChatComposerRoot} {
      box-shadow:
        0 10px 24px color-mix(in srgb, var(--bg, #020617) 8%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 10%, transparent);
    }

    ${composerRoot}[data-oc-voice-recording="true"] {
      --ring: rgba(126, 170, 212, 0.52);
    }

    ${composerRoot}[data-oc-voice-state="starting"] {
      --ring: rgba(143, 181, 221, 0.58);
    }

    ${composerRoot}[data-oc-voice-state="recording"] {
      --ring: rgba(99, 152, 211, 0.62);
    }

    :root[data-theme-mode="light"] ${composerRoot} {
      background:
        linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.98),
          color-mix(in srgb, var(--card) 96%, var(--panel, white) 4%)
        );
      box-shadow:
        0 16px 34px rgba(15, 23, 42, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    ${composerRoot}:focus-within {
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border) 72%);
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent),
        0 18px 36px color-mix(in srgb, var(--accent) 12%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 14%, transparent);
    }

    ${memberChatComposerRoot}:focus-within {
      box-shadow:
        0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent),
        0 12px 28px color-mix(in srgb, var(--accent) 10%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
    }

    .agent-chat__composer-combobox > textarea {
      background: transparent;
      color: var(--text-strong, var(--text));
    }

    .agent-chat__composer-combobox > textarea::placeholder {
      color: color-mix(in srgb, var(--text) 52%, transparent);
    }

    .chat-attachments-preview {
      padding-inline: 10px;
      padding-top: 10px;
    }

    .agent-chat__stt-interim {
      margin: 0 10px;
      padding: 0 0 10px;
      color: color-mix(in srgb, var(--accent) 72%, var(--muted, var(--text)) 28%);
      font-size: 13px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    ${toolbarRoot} {
      border-top-color: color-mix(in srgb, var(--border) 62%, transparent);
      background: color-mix(in srgb, var(--panel, var(--card)) 18%, transparent);
    }

    .oc-voice-status {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 10px);
      transform: translateX(-50%);
      z-index: 7;
      max-width: min(72vw, 560px);
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 95%, white 5%), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 90%, transparent));
      color: color-mix(in srgb, var(--text) 84%, var(--accent) 16%);
      font-size: 12px;
      line-height: 1.35;
      letter-spacing: 0.01em;
      box-shadow:
        0 14px 30px color-mix(in srgb, var(--bg, #020617) 10%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.56);
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .oc-voice-status--error {
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border) 72%);
      color: color-mix(in srgb, var(--text) 72%, var(--accent) 28%);
    }

    .oc-voice-status--active {
      border-color: color-mix(in srgb, var(--accent) 36%, var(--border) 64%);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, var(--panel, var(--card)) 88%), color-mix(in srgb, var(--accent) 8%, var(--bg-elevated, var(--panel, var(--card))) 92%));
      color: color-mix(in srgb, var(--text) 76%, var(--accent) 24%);
      box-shadow:
        0 16px 34px color-mix(in srgb, var(--accent) 14%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.58);
    }

    ${actionButtonRoot} {
      color: color-mix(in srgb, var(--accent) 52%, var(--muted, var(--text)) 48%);
    }

    ${actionButtonRoot}:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent) 12%, var(--bg-elevated, var(--panel, var(--card))) 88%);
      color: var(--text-strong, var(--text));
    }

    ${actionButtonRoot}[data-oc-chat-button-state="active"],
    .agent-chat__input-btn--active {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: color-mix(in srgb, var(--accent) 86%, var(--text) 14%);
    }

    ${actionButtonRoot}[data-oc-chat-button-state="pending"],
    .agent-chat__input-btn--pending {
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      color: color-mix(in srgb, var(--accent) 88%, white 12%);
      animation: oc-voice-pulse 1.2s ease-in-out infinite;
    }

    ${actionButtonRoot}[data-oc-chat-button-state="recording"],
    .agent-chat__input-btn--recording:not(.agent-chat__input-btn--pending) {
      background: color-mix(in srgb, var(--accent) 20%, transparent);
      color: color-mix(in srgb, var(--accent) 88%, white 12%);
    }

    ${sendButtonRoot} {
      color: color-mix(in srgb, var(--accent) 52%, var(--muted, var(--text)) 48%);
    }

    ${sendButtonRoot}:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent) 12%, var(--bg-hover, transparent) 88%);
      color: var(--text-strong, var(--text));
    }

    ${stopButtonRoot} {
      background: var(--danger, #dc2626);
      color: var(--destructive-foreground, #fff);
    }

    ${stopButtonRoot}:hover:not(:disabled) {
      background: color-mix(in srgb, var(--danger, #dc2626) 85%, #fff);
    }

    @keyframes oc-voice-pulse {
      0%,
      100% {
        transform: scale(1);
        box-shadow:
          0 0 0 4px color-mix(in srgb, var(--accent) 8%, transparent),
          0 10px 24px color-mix(in srgb, var(--accent) 16%, transparent);
      }
      50% {
        transform: scale(1.06);
        box-shadow:
          0 0 0 8px color-mix(in srgb, var(--accent) 6%, transparent),
          0 14px 28px color-mix(in srgb, var(--accent) 20%, transparent);
      }
    }

    .oc-block-renderer__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(127, 127, 127, 0.18);
      background: rgba(127, 127, 127, 0.05);
    }

    .oc-block-renderer__toolbar--no-toggle {
      justify-content: flex-start;
    }

    .oc-block-renderer__meta {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .oc-block-renderer__controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    .oc-block-renderer__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--primary-foreground, #f8fbff);
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 88%, white 8%), color-mix(in srgb, var(--accent-hover, var(--accent)) 86%, black 4%));
    }

    .oc-block-renderer__summary {
      font-size: 12px;
      color: inherit;
      opacity: 0.78;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* 中文标记：源码开关按钮已停用，这里仅保留历史样式定义供后续回看。 */
    .oc-block-renderer__toggle,
    .oc-block-renderer__action {
      appearance: none;
      border-radius: 999px;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      padding: 6px 10px;
    }

    .oc-block-renderer__toggle {
      border: 1px solid rgba(127, 127, 127, 0.25);
      background: transparent;
    }

    .oc-block-renderer__action {
      border: 1px solid rgba(127, 127, 127, 0.22);
      background: rgba(255, 255, 255, 0.62);
      font-weight: 600;
    }

    .oc-block-renderer__toggle:hover,
    .oc-block-renderer__action:hover {
      background: rgba(127, 127, 127, 0.08);
    }

    .oc-block-renderer__body {
      padding: 12px;
    }

    .oc-block-renderer__status {
      font-size: 13px;
      line-height: 1.5;
      border-radius: 10px;
      padding: 10px 12px;
    }

    .oc-block-renderer__status--loading {
      color: inherit;
      opacity: 0.78;
      background: rgba(127, 127, 127, 0.05);
    }

    .oc-block-renderer__status--error {
      color: color-mix(in srgb, var(--danger, var(--accent)) 84%, var(--text, #e5eefc) 16%);
      background: color-mix(in srgb, var(--danger-subtle, rgba(117, 155, 195, 0.14)) 88%, transparent);
    }

    .oc-block-renderer__status code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }

    .oc-block-renderer__loading-shell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .oc-block-renderer__spinner {
      position: relative;
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border: 2px solid color-mix(in srgb, var(--accent) 18%, transparent);
      border-top-color: color-mix(in srgb, var(--accent) 88%, transparent);
      border-radius: 999px;
      animation: oc-block-renderer-spin 1s linear infinite;
    }

    .oc-block-renderer__spinner::after {
      content: "";
      position: absolute;
      inset: 5px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }

    .oc-block-renderer__loading-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .oc-block-renderer__loading-title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .oc-block-renderer__loading-subtitle {
      font-size: 12px;
      opacity: 0.8;
    }

    .oc-block-renderer__pulse-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .oc-block-renderer__pulse-dots > span {
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: currentColor;
      opacity: 0.32;
      animation: oc-block-renderer-pulse 1.2s ease-in-out infinite;
    }

    .oc-block-renderer__pulse-dots > span:nth-child(2) {
      animation-delay: 0.16s;
    }

    .oc-block-renderer__pulse-dots > span:nth-child(3) {
      animation-delay: 0.32s;
    }

    .oc-block-renderer__error-title {
      margin-bottom: 6px;
      font-weight: 600;
    }

    .oc-block-renderer__error-detail {
      display: block;
      white-space: pre-wrap;
      word-break: break-word;
    }

    @media (max-width: 720px) {
      .chat-attachments-preview {
        padding-inline: 8px;
        padding-top: 8px;
      }
    }

    @keyframes oc-block-renderer-spin {
      from {
        transform: rotate(0deg);
      }

      to {
        transform: rotate(360deg);
      }
    }

    @keyframes oc-block-renderer-pulse {
      0%,
      80%,
      100% {
        opacity: 0.25;
        transform: translateY(0);
      }

      40% {
        opacity: 0.9;
        transform: translateY(-1px);
      }
    }
    .update-banner {
      display: none !important;
    }
  `;
}

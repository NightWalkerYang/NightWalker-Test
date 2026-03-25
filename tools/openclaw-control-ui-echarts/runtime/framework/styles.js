export function getFrameworkStyles() {
  return `
    .content--chat,
    .shell--chat-focus .content {
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

    :root[data-theme-mode="light"] .content--chat,
    :root[data-theme-mode="light"] .shell--chat-focus .content {
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

    .content--chat,
    .shell--chat-focus .content {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      --oc-chat-surface-top: #f8fbff;
      --oc-chat-surface-bottom: #eef3fa;
      --oc-chat-haze-a: rgba(121, 170, 219, 0.18);
      --oc-chat-haze-b: rgba(128, 200, 205, 0.16);
      --oc-chat-band-a-start: rgba(116, 177, 238, 0.12);
      --oc-chat-band-a-mid: rgba(123, 192, 248, 0.52);
      --oc-chat-band-a-end: rgba(223, 243, 255, 0.18);
      --oc-chat-band-b-start: rgba(102, 190, 202, 0.1);
      --oc-chat-band-b-mid: rgba(144, 227, 224, 0.4);
      --oc-chat-band-b-end: rgba(215, 247, 236, 0.14);
      --oc-chat-band-c-start: rgba(194, 165, 108, 0.08);
      --oc-chat-band-c-end: rgba(245, 226, 183, 0.24);
      --oc-chat-trace-soft: rgba(150, 196, 236, 0.34);
      --oc-chat-trace-bright: rgba(241, 248, 255, 0.96);
      --oc-chat-trace-warm-start: rgba(236, 217, 177, 0.18);
      --oc-chat-trace-warm-end: rgba(255, 243, 215, 0.82);
      --oc-chat-orbit: rgba(255, 245, 228, 0.44);
      --oc-chat-orbit-soft: rgba(172, 216, 240, 0.3);
      background:
        radial-gradient(circle at 14% 84%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 24%),
        radial-gradient(circle at 82% 34%, color-mix(in srgb, var(--accent-2) 10%, transparent), transparent 24%),
        linear-gradient(180deg, var(--oc-chat-surface-top), var(--oc-chat-surface-bottom));
    }

    :root[data-theme-mode="dark"] .content--chat,
    :root[data-theme-mode="dark"] .shell--chat-focus .content {
      --oc-chat-surface-top: #111b27;
      --oc-chat-surface-bottom: #142033;
      --oc-chat-haze-a: rgba(77, 134, 200, 0.2);
      --oc-chat-haze-b: rgba(81, 185, 177, 0.18);
      --oc-chat-band-a-start: rgba(94, 149, 214, 0.14);
      --oc-chat-band-a-mid: rgba(123, 188, 255, 0.44);
      --oc-chat-band-a-end: rgba(211, 234, 255, 0.16);
      --oc-chat-band-b-start: rgba(72, 165, 171, 0.12);
      --oc-chat-band-b-mid: rgba(118, 224, 214, 0.34);
      --oc-chat-band-b-end: rgba(205, 246, 231, 0.12);
      --oc-chat-band-c-start: rgba(169, 143, 92, 0.1);
      --oc-chat-band-c-end: rgba(243, 220, 167, 0.18);
      --oc-chat-trace-soft: rgba(141, 183, 223, 0.28);
      --oc-chat-trace-bright: rgba(227, 242, 255, 0.84);
      --oc-chat-trace-warm-start: rgba(229, 210, 170, 0.14);
      --oc-chat-trace-warm-end: rgba(252, 238, 207, 0.68);
      --oc-chat-orbit: rgba(255, 244, 221, 0.3);
      --oc-chat-orbit-soft: rgba(152, 204, 235, 0.22);
    }

    .content--chat > :not(.oc-chat-ambient),
    .shell--chat-focus .content > :not(.oc-chat-ambient) {
      position: relative;
      z-index: 1;
    }

    .oc-chat-ambient {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
      filter: saturate(1.08);
    }

    .oc-chat-ambient__svg {
      width: 100%;
      height: 100%;
      display: block;
      opacity: 0.99;
    }

    .oc-chat-ambient__wash {
      opacity: 0.94;
      filter: blur(34px);
      animation: oc-chat-ambient-breathe 20s ease-in-out infinite alternate;
    }

    .oc-chat-ambient__bands {
      transform-origin: 50% 62%;
      will-change: transform, opacity, filter;
    }

    .oc-chat-ambient__bands--back {
      opacity: 0.98;
      filter: blur(30px) saturate(1.08);
      animation:
        oc-chat-ambient-sway 18s ease-in-out infinite alternate,
        oc-chat-ambient-blur-pulse 9s ease-in-out infinite alternate;
    }

    .oc-chat-ambient__bands--front {
      opacity: 0.92;
      filter: blur(14px);
      animation:
        oc-chat-ambient-glide 14s ease-in-out infinite alternate-reverse,
        oc-chat-ambient-blur-pulse 7s ease-in-out infinite alternate-reverse;
    }

    .oc-chat-ambient__band--primary {
      animation: oc-chat-ambient-ribbon-flow 12s ease-in-out infinite alternate;
    }

    .oc-chat-ambient__band--secondary {
      animation: oc-chat-ambient-ribbon-flow-alt 16s ease-in-out infinite alternate;
    }

    .oc-chat-ambient__band--accent {
      animation: oc-chat-ambient-ribbon-flow 10s ease-in-out infinite alternate-reverse;
    }

    .oc-chat-ambient__band,
    .oc-chat-ambient__thread,
    .oc-chat-ambient__orbit {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      transform-box: fill-box;
      transform-origin: center;
    }

    .oc-chat-ambient__thread {
      stroke-width: 3;
      opacity: 0.88;
      filter: blur(2px);
    }

    .oc-chat-ambient__thread--cool,
    .oc-chat-ambient__thread--dash {
      stroke-dasharray: 10 14;
      animation:
        oc-chat-ambient-trace 16s linear infinite,
        oc-chat-ambient-thread-drift 8s ease-in-out infinite alternate;
    }

    .oc-chat-ambient__thread--warm {
      stroke-dasharray: 6 18;
      animation:
        oc-chat-ambient-trace 20s linear infinite reverse,
        oc-chat-ambient-thread-drift 10s ease-in-out infinite alternate-reverse;
    }

    .oc-chat-ambient__thread--dash {
      stroke-width: 2.2;
      stroke-dasharray: 3 16;
      opacity: 0.74;
    }

    .oc-chat-ambient__orbit {
      stroke: var(--oc-chat-orbit);
      stroke-width: 1.8;
      opacity: 0.34;
      filter: blur(4px);
    }

    .oc-chat-ambient__orbit--low {
      stroke: var(--oc-chat-orbit-soft);
      opacity: 0.24;
    }

    .content--chat .callout.danger,
    .shell--chat-focus .content .callout.danger {
      border-color: color-mix(in srgb, var(--danger) 26%, var(--border) 74%);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--danger-subtle) 92%, transparent), color-mix(in srgb, var(--panel, var(--card)) 90%, transparent));
      color: color-mix(in srgb, var(--danger) 82%, var(--text) 18%);
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
    }

    .content--chat .chat-avatar,
    .shell--chat-focus .content .chat-avatar {
      display: none;
    }

    .content--chat .chat-group,
    .shell--chat-focus .content .chat-group {
      gap: 0;
      margin-left: 0;
      margin-right: 0;
    }

    .content--chat .chat-group[data-oc-tool-run],
    .shell--chat-focus .content .chat-group[data-oc-tool-run] {
      margin-bottom: 0;
    }

    .content--chat .chat-group[data-oc-tool-run="mid"],
    .content--chat .chat-group[data-oc-tool-run="end"],
    .shell--chat-focus .content .chat-group[data-oc-tool-run="mid"],
    .shell--chat-focus .content .chat-group[data-oc-tool-run="end"] {
      margin-top: -1px;
    }

    .content--chat .chat-group[data-oc-tool-run] .chat-group-messages,
    .shell--chat-focus .content .chat-group[data-oc-tool-run] .chat-group-messages {
      gap: 0;
    }

    .content--chat .chat-group[data-oc-tool-run="start"] .chat-group-footer,
    .content--chat .chat-group[data-oc-tool-run="mid"] .chat-group-footer,
    .shell--chat-focus .content .chat-group[data-oc-tool-run="start"] .chat-group-footer,
    .shell--chat-focus .content .chat-group[data-oc-tool-run="mid"] .chat-group-footer {
      display: none;
    }

    .content--chat .chat-group[data-oc-tool-run] .chat-bubble,
    .shell--chat-focus .content .chat-group[data-oc-tool-run] .chat-bubble {
      position: relative;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 96%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 94%, transparent));
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
        0 10px 24px color-mix(in srgb, var(--bg, #020617) 5%, transparent);
    }

    .content--chat .chat-group[data-oc-tool-run="start"] .chat-bubble,
    .shell--chat-focus .content .chat-group[data-oc-tool-run="start"] .chat-bubble {
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
    }

    .content--chat .chat-group[data-oc-tool-run="mid"] .chat-bubble,
    .shell--chat-focus .content .chat-group[data-oc-tool-run="mid"] .chat-bubble {
      border-top: 0;
      border-radius: 0;
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--border) 54%, transparent);
    }

    .content--chat .chat-group[data-oc-tool-run="end"] .chat-bubble,
    .shell--chat-focus .content .chat-group[data-oc-tool-run="end"] .chat-bubble {
      border-top: 0;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }

    .content--chat .chat-group[data-oc-tool-run] .chat-tool-msg-summary,
    .content--chat .chat-group[data-oc-tool-run] .chat-tools-summary,
    .shell--chat-focus .content .chat-group[data-oc-tool-run] .chat-tool-msg-summary,
    .shell--chat-focus .content .chat-group[data-oc-tool-run] .chat-tools-summary {
      min-height: 34px;
    }

    .content--chat .chat-group[data-oc-tool-run="end"] .chat-group-footer,
    .shell--chat-focus .content .chat-group[data-oc-tool-run="end"] .chat-group-footer {
      margin-top: 8px;
      padding-left: 2px;
    }

    .content--chat .chat-group.user .chat-bubble,
    .shell--chat-focus .content .chat-group.user .chat-bubble {
      background: var(--oc-chat-user-bubble-bg);
      border-color: var(--oc-chat-user-bubble-border);
      color: var(--oc-chat-user-bubble-text);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.88),
        var(--oc-chat-user-bubble-shadow);
    }

    .content--chat .chat-group.user .chat-bubble:hover,
    .shell--chat-focus .content .chat-group.user .chat-bubble:hover {
      background: var(--oc-chat-user-bubble-bg-hover);
      border-color: color-mix(in srgb, var(--oc-chat-user-bubble-border) 82%, white 18%);
    }

    .content--chat .chat-group.user .chat-bubble .chat-text,
    .content--chat .chat-group.user .chat-bubble p,
    .content--chat .chat-group.user .chat-bubble li,
    .content--chat .chat-group.user .chat-bubble code,
    .shell--chat-focus .content .chat-group.user .chat-bubble .chat-text,
    .shell--chat-focus .content .chat-group.user .chat-bubble p,
    .shell--chat-focus .content .chat-group.user .chat-bubble li,
    .shell--chat-focus .content .chat-group.user .chat-bubble code {
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

    .agent-chat__input {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: visible;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    :root[data-theme-mode="light"] .agent-chat__input {
      background: transparent;
      box-shadow: none;
    }

    .agent-chat__input::before {
      display: none;
    }

    .agent-chat__input::after {
      display: none;
    }

    .agent-chat__input > textarea {
      position: relative;
      z-index: 1;
      order: 3;
      min-height: 56px;
      padding: 14px 64px 14px 16px;
      border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
      border-radius: 20px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 94%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 88%, transparent)),
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 7%, transparent), transparent 60%);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
        0 14px 30px color-mix(in srgb, var(--bg, #020617) 10%, transparent);
      letter-spacing: 0.01em;
      color: var(--text-strong, var(--text));
      text-wrap: pretty;
    }

    :root[data-theme-mode="light"] .agent-chat__input > textarea {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), color-mix(in srgb, var(--card) 94%, white 6%)),
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 7%, transparent), transparent 58%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.8),
        0 8px 24px rgba(15, 23, 42, 0.04);
    }

    .agent-chat__input:focus-within > textarea {
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border) 72%);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
        0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent),
        0 16px 34px color-mix(in srgb, var(--accent) 10%, transparent);
    }

    .agent-chat__input > textarea::placeholder {
      color: color-mix(in srgb, var(--text) 48%, transparent);
    }

    .chat-attachments-preview {
      position: relative;
      z-index: 1;
      order: 2;
      margin-bottom: 2px;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .agent-chat__stt-interim {
      position: relative;
      z-index: 1;
      order: 2;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: center;
      padding: 8px 12px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border) 82%);
      background: color-mix(in srgb, var(--accent) 10%, var(--panel, var(--card)) 90%);
      color: color-mix(in srgb, var(--accent) 84%, white 10%);
      font-size: 13px;
      line-height: 1.35;
      max-width: 100%;
      word-break: break-word;
    }

    .agent-chat__toolbar {
      position: static;
      z-index: auto;
      order: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 0;
      margin: 0 0 2px;
      border-top: none;
      background: transparent;
    }

    .agent-chat__toolbar-left,
    .agent-chat__toolbar-right {
      display: contents;
    }

    .agent-chat__input-btn,
    .agent-chat__toolbar .btn--ghost {
      width: 36px;
      height: 36px;
      border: 1px solid color-mix(in srgb, var(--border) 74%, transparent);
      border-radius: 999px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 94%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 86%, transparent));
      color: color-mix(in srgb, var(--text) 78%, transparent);
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    :root[data-theme-mode="light"] .agent-chat__input-btn,
    :root[data-theme-mode="light"] .agent-chat__toolbar .btn--ghost {
      background: rgba(255, 255, 255, 0.86);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .agent-chat__input-btn:hover:not(:disabled),
    .agent-chat__toolbar .btn--ghost:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--accent) 26%, var(--border) 74%);
      background: color-mix(in srgb, var(--accent) 12%, var(--bg-elevated, var(--panel, var(--card))) 88%);
      color: var(--text-strong, var(--text));
      box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 18%, transparent);
    }

    .agent-chat__input-btn--active {
      border-color: color-mix(in srgb, var(--accent) 34%, transparent);
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: color-mix(in srgb, var(--accent) 86%, white 14%);
      box-shadow: 0 10px 20px color-mix(in srgb, var(--accent) 16%, transparent);
    }

    .agent-chat__input-divider {
      display: none;
    }

    .agent-chat__token-count {
      position: absolute;
      left: 16px;
      bottom: 12px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 9px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel, var(--card)) 88%, transparent);
      color: color-mix(in srgb, var(--text) 72%, transparent);
      font-size: 11px;
      line-height: 1;
      border: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .chat-send-btn {
      position: absolute;
      right: 10px;
      bottom: 8px;
      z-index: 3;
      width: 40px;
      height: 40px;
      border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
      border-radius: 14px;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--accent) 84%, white 6%), color-mix(in srgb, var(--accent-hover, var(--accent)) 86%, black 2%));
      color: var(--primary-foreground, #fff);
      box-shadow: 0 12px 26px color-mix(in srgb, var(--accent) 26%, transparent);
    }

    .chat-send-btn:hover:not(:disabled) {
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--accent) 90%, white 4%), color-mix(in srgb, var(--accent-hover, var(--accent)) 92%, black 4%));
      box-shadow: 0 16px 28px color-mix(in srgb, var(--accent) 30%, transparent);
    }

    .chat-send-btn--stop {
      border-color: color-mix(in srgb, var(--danger, #dc2626) 28%, transparent);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--danger, #dc2626) 90%, white 4%), color-mix(in srgb, var(--danger, #dc2626) 82%, black 8%));
      box-shadow: 0 12px 26px color-mix(in srgb, var(--danger, #dc2626) 22%, transparent);
    }

    .chat-send-btn--stop:hover:not(:disabled) {
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--danger, #dc2626) 96%, white 4%), color-mix(in srgb, var(--danger, #dc2626) 86%, black 10%));
      box-shadow: 0 16px 28px color-mix(in srgb, var(--danger, #dc2626) 28%, transparent);
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
      .agent-chat__toolbar {
        gap: 8px;
      }

      .agent-chat__input > textarea {
        min-height: 54px;
        padding-right: 60px;
      }

      .agent-chat__token-count {
        left: 14px;
        bottom: 11px;
      }

      .chat-send-btn {
        right: 9px;
        bottom: 7px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .oc-chat-ambient__wash,
      .oc-chat-ambient__bands,
      .oc-chat-ambient__thread,
      .oc-chat-ambient__band {
        animation: none;
      }
    }

    @keyframes oc-chat-ambient-sway {
      0% {
        transform: translate3d(-2%, 1%, 0) scale(1.01);
      }

      50% {
        transform: translate3d(1.2%, -1.4%, 0) scale(1.03);
      }

      100% {
        transform: translate3d(2.8%, -2%, 0) scale(1.02);
      }
    }

    @keyframes oc-chat-ambient-glide {
      0% {
        transform: translate3d(4%, 2%, 0) scale(1.01);
      }

      50% {
        transform: translate3d(-2.8%, -2.2%, 0) scale(1.05);
      }

      100% {
        transform: translate3d(-5.2%, -3.4%, 0) scale(1.03);
      }
    }

    @keyframes oc-chat-ambient-trace {
      from {
        stroke-dashoffset: 0;
      }

      to {
        stroke-dashoffset: -240;
      }
    }

    @keyframes oc-chat-ambient-blur-pulse {
      0% {
        opacity: 0.76;
        filter: blur(20px) saturate(1.02);
      }

      100% {
        opacity: 1;
        filter: blur(36px) saturate(1.12);
      }
    }

    @keyframes oc-chat-ambient-ribbon-flow {
      0% {
        transform: translate3d(-2.4%, 1.8%, 0) scale(1);
      }

      50% {
        transform: translate3d(2%, -1.4%, 0) scale(1.06);
      }

      100% {
        transform: translate3d(4.6%, -3.2%, 0) scale(1.03);
      }
    }

    @keyframes oc-chat-ambient-ribbon-flow-alt {
      0% {
        transform: translate3d(2.6%, 1.4%, 0) scale(1.01);
      }

      50% {
        transform: translate3d(-1.8%, -2.6%, 0) scale(1.05);
      }

      100% {
        transform: translate3d(-4.8%, -1%, 0) scale(1.02);
      }
    }

    @keyframes oc-chat-ambient-thread-drift {
      0% {
        transform: translate3d(0, 0, 0) scale(1);
      }

      100% {
        transform: translate3d(1.6%, -1.4%, 0) scale(1.02);
      }
    }

    @keyframes oc-chat-ambient-breathe {
      0% {
        opacity: 0.72;
        transform: scale(0.98);
      }

      100% {
        opacity: 0.96;
        transform: scale(1.04);
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
  `;
}

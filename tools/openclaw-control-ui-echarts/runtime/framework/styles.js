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
    }

    .content--chat,
    .shell--chat-focus .content {
      position: relative;
      isolation: isolate;
      --oc-chat-flow-a: rgba(93, 136, 181, 0.34);
      --oc-chat-flow-b: rgba(128, 191, 203, 0.28);
      --oc-chat-flow-c: rgba(203, 184, 146, 0.2);
      background:
        radial-gradient(circle at 10% 82%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 20%),
        radial-gradient(circle at 84% 32%, color-mix(in srgb, var(--accent-2) 10%, transparent), transparent 22%),
        linear-gradient(180deg, color-mix(in srgb, var(--bg, #020617) 97%, rgba(255, 255, 255, 0.02)), color-mix(in srgb, var(--bg-content, var(--bg, #020617)) 94%, transparent));
    }

    .content--chat > *,
    .shell--chat-focus .content > * {
      position: relative;
      z-index: 1;
    }

    .content--chat::before,
    .content--chat::after,
    .shell--chat-focus .content::before,
    .shell--chat-focus .content::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      transform: translate3d(0, 0, 0);
      will-change: transform, opacity;
    }

    .content--chat::before,
    .shell--chat-focus .content::before {
      background:
        radial-gradient(circle at 18% 78%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 22%),
        radial-gradient(circle at 76% 30%, color-mix(in srgb, var(--accent-2) 14%, transparent), transparent 24%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1800 1000' fill='none'%3E%3Cpath d='M-120 760C110 560 336 498 546 544C742 588 878 716 1058 662C1236 610 1350 382 1546 352C1656 334 1750 350 1860 430' stroke='%235f8cb9' stroke-width='86' stroke-opacity='.24' stroke-linecap='round'/%3E%3Cpath d='M-90 860C170 676 420 652 646 700C848 742 994 860 1184 776C1360 698 1476 532 1634 548C1742 560 1818 628 1886 706' stroke='%238ec6d0' stroke-width='62' stroke-opacity='.2' stroke-linecap='round'/%3E%3Cpath d='M180 694C372 574 560 566 732 638C884 700 1050 708 1226 594C1374 500 1538 456 1702 506' stroke='%23d3c0a0' stroke-width='34' stroke-opacity='.16' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat, no-repeat, no-repeat;
      background-size: 34% 34%, 40% 40%, 138% 82%;
      background-position: 10% 84%, 84% 30%, center 71%;
      opacity: 0.74;
      filter: blur(16px) saturate(1.04);
      mask-image: linear-gradient(180deg, transparent 6%, #000 18%, #000 88%, transparent 98%);
      animation: oc-chat-curve-drift 28s ease-in-out infinite alternate;
    }

    .content--chat::after,
    .shell--chat-focus .content::after {
      background:
        radial-gradient(circle at 66% 66%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 20%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1800 1000' fill='none'%3E%3Cpath d='M-110 752C132 552 360 494 566 540C752 582 892 716 1064 666C1236 616 1360 392 1548 366C1662 350 1768 372 1864 446' stroke='%236f9fd4' stroke-width='4.6' stroke-linecap='round'/%3E%3Cpath d='M-76 852C184 674 436 654 658 702C854 744 994 852 1180 780C1348 714 1478 548 1642 564C1748 574 1820 638 1882 702' stroke='%2399cfd7' stroke-width='3.2' stroke-linecap='round'/%3E%3Cpath d='M202 680C392 568 584 562 746 630C892 690 1050 696 1214 590C1354 500 1508 458 1664 500' stroke='%23d9c7ab' stroke-width='2.6' stroke-linecap='round' stroke-dasharray='8 18' stroke-opacity='.82'/%3E%3C/svg%3E");
      background-repeat: no-repeat, no-repeat;
      background-size: 42% 42%, 134% 80%;
      background-position: 68% 68%, center 70%;
      opacity: 0.72;
      mask-image: linear-gradient(180deg, transparent 10%, #000 20%, #000 90%, transparent 100%);
      animation: oc-chat-curve-float 34s ease-in-out infinite alternate-reverse;
    }

    :root[data-theme-mode="light"] .content--chat::before,
    :root[data-theme-mode="light"] .shell--chat-focus .content::before {
      opacity: 0.78;
    }

    :root[data-theme-mode="light"] .content--chat::after,
    :root[data-theme-mode="light"] .shell--chat-focus .content::after {
      opacity: 0.66;
    }

    :root[data-theme-mode="dark"] .content--chat::before,
    :root[data-theme-mode="dark"] .shell--chat-focus .content::before {
      opacity: 0.7;
    }

    :root[data-theme-mode="dark"] .content--chat::after,
    :root[data-theme-mode="dark"] .shell--chat-focus .content::after {
      opacity: 0.58;
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
      .content--chat::before,
      .content--chat::after,
      .shell--chat-focus .content::before,
      .shell--chat-focus .content::after {
        animation: none;
      }
    }

    @keyframes oc-chat-curve-drift {
      0% {
        transform: translate3d(-2%, 1%, 0) scale(1.02);
      }

      50% {
        transform: translate3d(1%, -1.5%, 0) scale(1.05);
      }

      100% {
        transform: translate3d(3%, -2%, 0) scale(1.04);
      }
    }

    @keyframes oc-chat-curve-float {
      0% {
        transform: translate3d(2%, 1%, 0) scale(1.01);
      }

      50% {
        transform: translate3d(-1%, -1%, 0) scale(1.03);
      }

      100% {
        transform: translate3d(-3%, -2%, 0) scale(1.02);
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

export function getFrameworkStyles() {
  return `
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

    /* Focus mode: keep only the chat thread, compose box, and native exit button. */
    .shell--chat-focus {
      grid-template-columns: 0 minmax(0, 1fr) !important;
      grid-template-rows: 0 minmax(0, 1fr) !important;
    }

    .shell--chat-focus .topbar,
    .shell--chat-focus .shell-nav,
    .shell--chat-focus .shell-nav-backdrop,
    .shell--chat-focus .content-header {
      display: none !important;
    }

    .shell--chat-focus .content,
    .shell--chat-focus .content.content--chat {
      height: 100%;
      min-height: 0;
      padding: 0 !important;
    }

    .shell--chat-focus .card.chat {
      min-height: 100%;
      height: 100%;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
    }

    .shell--chat-focus .agent-chat__search-bar,
    .shell--chat-focus .agent-chat__pinned,
    .shell--chat-focus .chat-queue,
    .shell--chat-focus .context-notice,
    .shell--chat-focus .compaction-indicator,
    .shell--chat-focus .chat-new-messages,
    .shell--chat-focus .chat-sidebar,
    .shell--chat-focus resizable-divider {
      display: none !important;
    }

    .shell--chat-focus .chat-split-container {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }

    .shell--chat-focus .chat-main {
      min-width: 0;
      width: 100%;
      flex: 1 1 100% !important;
    }

    .shell--chat-focus .chat-thread {
      padding: 22px 18px 8px !important;
      border-radius: 0 !important;
    }

    .shell--chat-focus .chat-thread-inner {
      padding-right: 42px;
    }

    .shell--chat-focus .chat-focus-exit {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 12px);
      right: calc(env(safe-area-inset-right, 0px) + 12px);
      z-index: 120;
    }

    .shell--chat-focus .agent-chat__input {
      margin: 0 18px calc(env(safe-area-inset-bottom, 0px) + 18px) !important;
      flex-shrink: 0;
    }

    .agent-chat__input {
      position: relative;
      overflow: hidden;
      border-color: color-mix(in srgb, var(--border-strong, var(--border)) 42%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--card) 94%, rgba(255, 255, 255, 0.02)), color-mix(in srgb, var(--panel, var(--card)) 96%, transparent)),
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, transparent), transparent 52%);
      box-shadow:
        0 18px 42px color-mix(in srgb, var(--bg, #020617) 18%, transparent),
        inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
    }

    :root[data-theme-mode="light"] .agent-chat__input {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), color-mix(in srgb, var(--card) 94%, var(--panel, white) 6%)),
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 7%, transparent), transparent 48%);
      box-shadow:
        0 16px 34px rgba(15, 23, 42, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.66);
    }

    .agent-chat__input::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 1px;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 56%, transparent), transparent);
      opacity: 0.9;
      pointer-events: none;
    }

    .agent-chat__input > textarea {
      letter-spacing: 0.01em;
      color: var(--text-strong, var(--text));
    }

    .agent-chat__toolbar {
      border-top-color: color-mix(in srgb, var(--border) 62%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 92%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 86%, transparent));
    }

    .agent-chat__toolbar-left,
    .agent-chat__toolbar-right {
      gap: 6px;
    }

    .agent-chat__input-btn,
    .agent-chat__toolbar .btn--ghost {
      border: 1px solid color-mix(in srgb, var(--border) 74%, transparent);
      background: color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 78%, transparent);
      color: color-mix(in srgb, var(--text) 78%, transparent);
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 12%, transparent);
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

    .agent-chat__token-count {
      padding: 0 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel, var(--card)) 82%, transparent);
      color: color-mix(in srgb, var(--text) 72%, transparent);
      line-height: 22px;
    }

    .chat-send-btn {
      border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
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
      color: #0f172a;
      background: #f59e0b;
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
      color: #991b1b;
      background: rgba(220, 38, 38, 0.08);
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
      border: 2px solid rgba(245, 158, 11, 0.18);
      border-top-color: rgba(245, 158, 11, 0.88);
      border-radius: 999px;
      animation: oc-block-renderer-spin 1s linear infinite;
    }

    .oc-block-renderer__spinner::after {
      content: "";
      position: absolute;
      inset: 5px;
      border-radius: 999px;
      background: rgba(245, 158, 11, 0.12);
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

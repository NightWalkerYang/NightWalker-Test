export function getEchartsStyles() {
  return `
    .oc-block-renderer--echarts {
      --oc-chart-surface:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, #0f172a) 94%, transparent), color-mix(in srgb, var(--card, #111827) 96%, transparent));
      --oc-chart-border: color-mix(in srgb, var(--border-strong, rgba(148, 163, 184, 0.28)) 44%, transparent);
      --oc-chart-shadow: 0 24px 54px color-mix(in srgb, var(--bg, #020617) 26%, transparent);
      --oc-chart-toolbar-bg:
        linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated, #111827) 96%, transparent), color-mix(in srgb, var(--panel, #0f172a) 88%, transparent));
      --oc-chart-panel-bg:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 12%, transparent), transparent 38%),
        linear-gradient(180deg, color-mix(in srgb, var(--panel, #0f172a) 92%, transparent), color-mix(in srgb, var(--bg-elevated, #111827) 94%, transparent));
      --oc-chart-panel-border: color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.22)) 72%, transparent);
      --oc-chart-grid:
        linear-gradient(color-mix(in srgb, var(--border) 18%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--border) 18%, transparent) 1px, transparent 1px);
      border-color: var(--oc-chart-border);
      background: var(--oc-chart-surface);
      box-shadow: var(--oc-chart-shadow);
    }

    :root[data-theme-mode="light"] .oc-block-renderer--echarts {
      --oc-chart-surface:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), color-mix(in srgb, var(--card) 94%, var(--panel, white) 6%));
      --oc-chart-border: rgba(15, 23, 42, 0.08);
      --oc-chart-shadow: 0 22px 44px rgba(15, 23, 42, 0.08);
      --oc-chart-toolbar-bg:
        linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.92));
      --oc-chart-panel-bg:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 8%, transparent), transparent 36%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
      --oc-chart-panel-border: rgba(15, 23, 42, 0.08);
      --oc-chart-grid:
        linear-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.16) 1px, transparent 1px);
    }

    .oc-block-renderer--echarts .oc-block-renderer__toolbar {
      padding: 12px 14px;
      border-bottom-color: color-mix(in srgb, var(--oc-chart-border) 78%, transparent);
      background: var(--oc-chart-toolbar-bg);
    }

    .oc-block-renderer--echarts .oc-block-renderer__badge {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #fff7ed;
      box-shadow: 0 8px 18px rgba(249, 115, 22, 0.24);
    }

    .oc-block-renderer--echarts .oc-block-renderer__summary {
      font-weight: 600;
      opacity: 0.88;
    }

    .oc-block-renderer--echarts .oc-block-renderer__action {
      border-color: color-mix(in srgb, var(--accent) 18%, var(--oc-chart-border) 82%);
      background: color-mix(in srgb, var(--panel, var(--card)) 88%, transparent);
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 10%, transparent);
    }

    .oc-block-renderer--echarts .oc-block-renderer__action:hover {
      background: color-mix(in srgb, var(--accent) 10%, var(--panel, var(--card)) 90%);
      border-color: color-mix(in srgb, var(--accent) 28%, var(--oc-chart-border) 72%);
      box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 14%, transparent);
    }

    .oc-block-renderer--echarts .oc-block-renderer__body {
      padding: 14px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 52%, transparent), transparent);
    }

    .oc-block-renderer__chart {
      width: 100%;
      min-height: 320px;
    }

    .oc-block-renderer--echarts .oc-block-renderer__chart {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--oc-chart-panel-border);
      border-radius: 16px;
      background:
        var(--oc-chart-grid),
        var(--oc-chart-panel-bg);
      background-size: 22px 22px, auto;
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
        inset 0 -24px 40px color-mix(in srgb, var(--bg, #020617) 8%, transparent);
    }

    .oc-block-renderer--echarts .oc-block-renderer__chart::before {
      content: "";
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 72px;
      background: linear-gradient(180deg, color-mix(in srgb, white 6%, transparent), transparent);
      pointer-events: none;
      z-index: 0;
    }

    .oc-echarts-detail-modal[hidden] {
      display: none;
    }

    .oc-echarts-detail-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, rgba(59, 130, 246, 0.14), transparent 42%),
        rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(10px);
    }

    .oc-echarts-detail-modal__dialog {
      width: min(720px, calc(100vw - 32px));
      max-height: min(80vh, 880px);
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.28)) 78%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--card, #0f172a) 96%, transparent), color-mix(in srgb, var(--panel, #111827) 94%, transparent));
      color: var(--text-strong, #e5eefc);
      box-shadow: 0 32px 90px rgba(15, 23, 42, 0.32);
      backdrop-filter: blur(16px);
    }

    :root[data-theme-mode="light"] .oc-echarts-detail-modal__dialog {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
      color: #0f172a;
      box-shadow: 0 28px 84px rgba(15, 23, 42, 0.18);
    }

    .oc-echarts-detail-modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.2)) 72%, transparent);
    }

    .oc-echarts-detail-modal__title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .oc-echarts-detail-modal__close {
      appearance: none;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.22)) 72%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel, var(--card)) 82%, transparent);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      padding: 7px 12px;
    }

    .oc-echarts-detail-modal__close:hover {
      background: color-mix(in srgb, var(--accent) 10%, var(--panel, var(--card)) 90%);
    }

    .oc-echarts-detail-modal__body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 18px 20px 20px;
      max-height: calc(min(80vh, 880px) - 74px);
    }

    .oc-echarts-detail-modal__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .oc-echarts-detail-modal__action {
      appearance: none;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border) 82%);
      background: color-mix(in srgb, var(--panel, var(--card)) 90%, transparent);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 9px 14px;
      transition:
        transform 0.18s ease,
        box-shadow 0.18s ease,
        background 0.18s ease,
        border-color 0.18s ease;
    }

    .oc-echarts-detail-modal__action:hover {
      transform: translateY(-1px);
    }

    .oc-echarts-detail-modal__action[data-variant="primary"] {
      border-color: color-mix(in srgb, var(--accent) 22%, transparent);
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 86%, white 6%), color-mix(in srgb, var(--accent-hover, var(--accent)) 88%, black 4%));
      color: #fff;
      box-shadow: 0 16px 30px color-mix(in srgb, var(--accent) 22%, transparent);
    }

    .oc-echarts-detail-modal__action[data-variant="secondary"]:hover {
      background: color-mix(in srgb, var(--accent) 8%, var(--panel, var(--card)) 92%);
      border-color: color-mix(in srgb, var(--accent) 24%, transparent);
      box-shadow: 0 12px 24px color-mix(in srgb, var(--bg, #020617) 10%, transparent);
    }

    .oc-echarts-detail-modal__content {
      overflow: auto;
      min-height: 0;
      padding-right: 2px;
    }

    .oc-echarts-detail-modal__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .oc-echarts-detail-modal__card {
      border-radius: 16px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.18)) 74%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 88%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 92%, transparent));
      padding: 12px 14px;
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
    }

    :root[data-theme-mode="light"] .oc-echarts-detail-modal__card {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
    }

    .oc-echarts-detail-modal__label {
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: color-mix(in srgb, currentColor 58%, transparent);
    }

    .oc-echarts-detail-modal__value {
      font-size: 14px;
      line-height: 1.55;
      word-break: break-word;
    }

    .oc-echarts-detail-modal__value--mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
    }

    .oc-echarts-detail-modal__swatch {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .oc-echarts-detail-modal__swatch-chip {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      flex: 0 0 auto;
    }

    .oc-echarts-detail-modal__empty {
      font-size: 14px;
      line-height: 1.6;
      color: color-mix(in srgb, currentColor 72%, transparent);
    }
  `;
}

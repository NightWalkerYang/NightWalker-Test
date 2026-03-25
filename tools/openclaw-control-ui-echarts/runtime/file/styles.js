export function getFileStyles() {
  return `
    .oc-block-renderer--file {
      --oc-file-surface:
        linear-gradient(180deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--bg-elevated) 90%, transparent));
      --oc-file-border: color-mix(in srgb, var(--border-strong) 72%, transparent);
      --oc-file-muted: color-mix(in srgb, var(--text) 62%, transparent);
      --oc-file-chip-bg: color-mix(in srgb, var(--accent) 14%, transparent);
      --oc-file-chip-fg: color-mix(in srgb, var(--text-strong) 92%, var(--accent) 8%);
      --oc-file-icon-bg:
        linear-gradient(145deg, color-mix(in srgb, var(--accent) 28%, var(--panel) 72%), color-mix(in srgb, var(--accent-2, var(--accent)) 16%, var(--panel-strong) 84%));
      --oc-file-icon-fg: var(--primary-foreground, #fff);
      --oc-file-shadow: 0 18px 34px color-mix(in srgb, var(--bg) 72%, transparent);
      --oc-file-button-bg: color-mix(in srgb, var(--panel-strong) 82%, transparent);
      --oc-file-button-border: color-mix(in srgb, var(--border) 84%, transparent);
      --oc-file-button-fg: var(--text-strong);
      --oc-file-button-primary-bg:
        linear-gradient(135deg, color-mix(in srgb, var(--accent) 82%, white 6%), color-mix(in srgb, var(--accent-hover, var(--accent)) 90%, black 4%));
      --oc-file-button-primary-fg: var(--primary-foreground, #fff);
    }

    :root[data-theme-mode="light"] .oc-block-renderer--file {
      --oc-file-surface:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), color-mix(in srgb, var(--card) 94%, var(--panel) 6%));
      --oc-file-border: rgba(15, 23, 42, 0.09);
      --oc-file-muted: rgba(15, 23, 42, 0.58);
      --oc-file-chip-bg: color-mix(in srgb, var(--accent) 10%, white 90%);
      --oc-file-chip-fg: color-mix(in srgb, var(--accent) 88%, #0f172a 12%);
      --oc-file-icon-bg:
        linear-gradient(145deg, color-mix(in srgb, var(--accent) 72%, white 28%), color-mix(in srgb, var(--accent-2, var(--accent)) 18%, white 82%));
      --oc-file-icon-fg: #fff;
      --oc-file-shadow: 0 16px 28px rgba(15, 23, 42, 0.08);
      --oc-file-button-bg: rgba(255, 255, 255, 0.88);
      --oc-file-button-border: rgba(15, 23, 42, 0.08);
      --oc-file-button-fg: var(--text-strong);
    }

    .oc-block-renderer--file .oc-block-renderer__chart {
      min-height: 0;
    }

    .oc-file-card {
      min-height: 0;
    }

    .oc-file-card__surface {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid var(--oc-file-border);
      background: var(--oc-file-surface);
      box-shadow: var(--oc-file-shadow);
    }

    .oc-file-card__icon {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: var(--oc-file-icon-bg);
      color: var(--oc-file-icon-fg);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
      overflow: hidden;
    }

    .oc-file-card__icon::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.14), transparent 48%),
        radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.22), transparent 34%);
      pointer-events: none;
    }

    .oc-file-card__icon-label {
      position: relative;
      z-index: 1;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .oc-file-card__content {
      min-width: 0;
      display: grid;
      gap: 8px;
    }

    .oc-file-card__heading {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex-wrap: wrap;
    }

    .oc-file-card__title {
      min-width: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-strong);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .oc-file-card__kind {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: var(--oc-file-chip-fg);
      background: var(--oc-file-chip-bg);
      flex: 0 0 auto;
    }

    .oc-file-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 10px;
      font-size: 12px;
      color: var(--oc-file-muted);
    }

    .oc-file-card__meta strong {
      color: var(--text-strong);
      font-weight: 600;
    }

    .oc-file-card__path {
      display: block;
      margin: 0;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--oc-file-border) 82%, transparent);
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      color: var(--text);
      font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
      font-size: 12px;
      line-height: 1.5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .oc-file-card__description {
      font-size: 12px;
      line-height: 1.55;
      color: var(--oc-file-muted);
    }

    .oc-file-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .oc-file-card__button {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid var(--oc-file-button-border);
      background: var(--oc-file-button-bg);
      color: var(--oc-file-button-fg);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      transition:
        transform 0.18s ease,
        box-shadow 0.18s ease,
        border-color 0.18s ease,
        background 0.18s ease;
    }

    .oc-file-card__button:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px color-mix(in srgb, var(--bg) 28%, transparent);
    }

    .oc-file-card__button--primary {
      border-color: transparent;
      background: var(--oc-file-button-primary-bg);
      color: var(--oc-file-button-primary-fg);
      box-shadow: 0 10px 24px color-mix(in srgb, var(--accent) 26%, transparent);
    }

    .oc-file-card__button[data-copied="true"] {
      border-color: color-mix(in srgb, var(--ok, #22c55e) 44%, transparent);
      background: color-mix(in srgb, var(--ok, #22c55e) 14%, transparent);
      color: color-mix(in srgb, var(--ok, #22c55e) 86%, var(--text-strong) 14%);
      box-shadow: none;
    }

    @media (max-width: 720px) {
      .oc-file-card__surface {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .oc-file-card__icon {
        width: 42px;
        height: 42px;
      }

      .oc-file-card__actions {
        width: 100%;
      }

      .oc-file-card__button {
        flex: 1 1 132px;
      }
    }
  `;
}

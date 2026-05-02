export function getSelectStyles() {
  return `
    .oc-block-renderer--select {
      --oc-select-surface:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, #0f172a) 94%, transparent), color-mix(in srgb, var(--card, #111827) 96%, transparent));
      --oc-select-border: color-mix(in srgb, var(--border-strong, rgba(148, 163, 184, 0.28)) 44%, transparent);
      --oc-select-shadow: 0 24px 54px color-mix(in srgb, var(--bg, #020617) 26%, transparent);
      --oc-select-panel:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 12%, transparent), transparent 40%),
        linear-gradient(180deg, color-mix(in srgb, var(--panel, #0f172a) 92%, transparent), color-mix(in srgb, var(--bg-elevated, #111827) 94%, transparent));
      border-color: var(--oc-select-border);
      background: var(--oc-select-surface);
      box-shadow: var(--oc-select-shadow);
    }

    :root[data-theme-mode="light"] .oc-block-renderer--select {
      --oc-select-surface:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), color-mix(in srgb, var(--card) 94%, var(--panel, white) 6%));
      --oc-select-border: rgba(15, 23, 42, 0.08);
      --oc-select-shadow: 0 22px 44px rgba(15, 23, 42, 0.08);
      --oc-select-panel:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 8%, transparent), transparent 36%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
    }

    .oc-block-renderer--select .oc-block-renderer__toolbar {
      padding: 12px 14px;
      border-bottom-color: color-mix(in srgb, var(--oc-select-border) 78%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated, #111827) 96%, transparent), color-mix(in srgb, var(--panel, #0f172a) 88%, transparent));
    }

    .oc-block-renderer--select .oc-block-renderer__body {
      padding: 14px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 52%, transparent), transparent);
    }

    .oc-select-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.22)) 72%, transparent);
      border-radius: 16px;
      padding: 16px;
      background: var(--oc-select-panel);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
        0 16px 36px color-mix(in srgb, var(--bg, #020617) 8%, transparent);
    }

    .oc-select-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .oc-select-card__title-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .oc-select-card__eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--accent) 78%, white 12%);
    }

    .oc-select-card__title {
      margin: 0;
      font-size: 16px;
      line-height: 1.45;
      color: var(--text-strong, var(--text));
      word-break: break-word;
    }

    .oc-select-card__description {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: color-mix(in srgb, currentColor 76%, transparent);
      word-break: break-word;
    }

    .oc-select-card__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border) 80%);
      background: color-mix(in srgb, var(--accent) 10%, var(--panel, var(--card)) 90%);
      color: color-mix(in srgb, var(--accent) 82%, white 10%);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .oc-select-card__options {
      display: grid;
      gap: 10px;
    }

    .oc-select-card__option {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.22)) 72%, transparent);
      background: color-mix(in srgb, var(--panel, var(--card)) 88%, transparent);
      transition:
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease,
        transform 180ms ease;
      cursor: pointer;
    }

    .oc-select-card__option:hover {
      border-color: color-mix(in srgb, var(--accent) 28%, var(--border) 72%);
      background: color-mix(in srgb, var(--accent) 8%, var(--panel, var(--card)) 92%);
      box-shadow: 0 10px 22px color-mix(in srgb, var(--bg, #020617) 8%, transparent);
      transform: translateY(-1px);
    }

    .oc-select-card__option.is-selected {
      border-color: color-mix(in srgb, var(--accent) 44%, var(--border) 56%);
      background: color-mix(in srgb, var(--accent) 12%, var(--panel, var(--card)) 88%);
      box-shadow:
        inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),
        0 14px 30px color-mix(in srgb, var(--accent) 12%, transparent);
    }

    .oc-select-card__option.is-disabled {
      opacity: 0.56;
      cursor: not-allowed;
      transform: none;
    }

    .oc-select-card__option-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .oc-select-card__option-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.5;
      color: var(--text-strong, var(--text));
      word-break: break-word;
    }

    .oc-select-card__option-description {
      font-size: 12px;
      line-height: 1.55;
      color: color-mix(in srgb, currentColor 72%, transparent);
      word-break: break-word;
    }

    .oc-select-card__control {
      width: 18px;
      height: 18px;
      margin: 1px 0 0;
      accent-color: var(--accent, #7eaad4);
      cursor: pointer;
    }

    .oc-select-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .oc-select-card__hint {
      font-size: 12px;
      line-height: 1.5;
      color: color-mix(in srgb, currentColor 70%, transparent);
    }

    .oc-select-card__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .oc-select-card__button {
      appearance: none;
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 14px;
      transition:
        transform 180ms ease,
        box-shadow 180ms ease,
        border-color 180ms ease,
        background 180ms ease;
    }

    .oc-select-card__button:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .oc-select-card__button:disabled {
      opacity: 0.48;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .oc-select-card__button--secondary {
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border) 82%);
      background: color-mix(in srgb, var(--panel, var(--card)) 88%, transparent);
      color: inherit;
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 10%, transparent);
    }

    .oc-select-card__button--secondary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent) 10%, var(--panel, var(--card)) 90%);
      box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 12%, transparent);
    }

    .oc-select-card__button--primary {
      border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--accent) 86%, white 6%), color-mix(in srgb, var(--accent-hover, var(--accent)) 88%, black 4%));
      color: var(--primary-foreground, #fff);
      box-shadow: 0 14px 30px color-mix(in srgb, var(--accent) 20%, transparent);
    }

    .oc-select-card__button--primary:hover:not(:disabled) {
      box-shadow: 0 18px 34px color-mix(in srgb, var(--accent) 24%, transparent);
    }

    @media (max-width: 720px) {
      .oc-select-card {
        padding: 14px;
      }

      .oc-select-card__header,
      .oc-select-card__footer {
        flex-direction: column;
        align-items: stretch;
      }

      .oc-select-card__count {
        align-self: flex-start;
      }

      .oc-select-card__actions {
        width: 100%;
      }

      .oc-select-card__button {
        flex: 1 1 160px;
        justify-content: center;
      }
    }
  `;
}

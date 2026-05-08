export function getImageUploadStyles() {
  return `
    .oc-block-renderer--image-upload .oc-block-renderer__body {
      padding: 12px;
    }

    .oc-image-upload-card {
      display: grid;
      gap: 12px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.26)) 78%, transparent);
      border-radius: 14px;
      padding: 12px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 90%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 86%, transparent));
    }

    .oc-image-upload-card__header {
      display: grid;
      gap: 6px;
    }

    .oc-image-upload-card__title {
      margin: 0;
      font-size: 15px;
      line-height: 1.45;
      color: var(--text-strong, var(--text));
    }

    .oc-image-upload-card__description {
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      color: color-mix(in srgb, currentColor 76%, transparent);
    }

    .oc-image-upload-card__slots {
      display: grid;
      gap: 10px;
    }

    .oc-image-upload-card__slot {
      display: grid;
      gap: 8px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.2)) 76%, transparent);
      border-radius: 12px;
      padding: 10px;
      background: color-mix(in srgb, var(--panel, var(--card)) 86%, transparent);
    }

    .oc-image-upload-card__slot-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .oc-image-upload-card__slot-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-strong, var(--text));
    }

    .oc-image-upload-card__slot-status {
      font-size: 11px;
      font-weight: 700;
      color: color-mix(in srgb, var(--accent, #7eaad4) 82%, var(--text-strong, #fff) 8%);
      background: color-mix(in srgb, var(--accent, #7eaad4) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent, #7eaad4) 30%, transparent);
      border-radius: 999px;
      padding: 2px 8px;
      white-space: nowrap;
    }

    .oc-image-upload-card__slot-status.is-failed {
      color: color-mix(in srgb, #ef4444 86%, var(--text-strong, #fff) 8%);
      border-color: color-mix(in srgb, #ef4444 34%, transparent);
      background: color-mix(in srgb, #ef4444 12%, transparent);
    }

    .oc-image-upload-card__slot-hint {
      font-size: 12px;
      line-height: 1.45;
      color: color-mix(in srgb, currentColor 72%, transparent);
    }

    .oc-image-upload-card__slot-path {
      font-size: 11px;
      line-height: 1.45;
      color: color-mix(in srgb, currentColor 62%, transparent);
      font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
      word-break: break-word;
    }

    .oc-image-upload-card__slot-input {
      width: 100%;
      font-size: 12px;
      line-height: 1.4;
    }

    .oc-image-upload-card__slot-error {
      display: none;
      font-size: 12px;
      line-height: 1.45;
      color: #ef4444;
    }

    .oc-image-upload-card__slot-error.is-visible {
      display: block;
    }

    .oc-image-upload-card__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .oc-image-upload-card__action {
      appearance: none;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.3)) 84%, transparent);
      background: color-mix(in srgb, var(--panel, var(--card)) 90%, transparent);
      color: var(--text-strong, var(--text));
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 12px;
    }

    .oc-image-upload-card__action--primary {
      border-color: color-mix(in srgb, var(--accent, #7eaad4) 26%, transparent);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--accent, #7eaad4) 84%, white 8%), color-mix(in srgb, var(--accent-hover, var(--accent, #7eaad4)) 88%, black 4%));
      color: var(--primary-foreground, #fff);
    }

    .oc-image-upload-card__action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
}


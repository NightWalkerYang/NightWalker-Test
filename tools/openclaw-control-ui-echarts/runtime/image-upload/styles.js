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
      transition:
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease,
        opacity 180ms ease;
    }

    .oc-image-upload-card.is-submitting {
      opacity: 0.84;
    }

    .oc-image-upload-card.is-complete {
      border-color: color-mix(in srgb, #22c55e 34%, var(--border, rgba(148, 163, 184, 0.26)) 66%);
      background:
        radial-gradient(circle at top right, color-mix(in srgb, #22c55e 10%, transparent), transparent 42%),
        linear-gradient(180deg, color-mix(in srgb, var(--panel, var(--card)) 90%, transparent), color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 86%, transparent));
      box-shadow: 0 18px 34px color-mix(in srgb, #22c55e 10%, transparent);
    }

    .oc-image-upload-card__header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 6px;
    }

    .oc-image-upload-card__title {
      margin: 0;
      font-size: 15px;
      line-height: 1.45;
      color: var(--text-strong, var(--text));
    }

    .oc-image-upload-card__description {
      grid-column: 1 / -1;
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      color: color-mix(in srgb, currentColor 76%, transparent);
    }

    .oc-image-upload-card__status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent, #7eaad4) 22%, transparent);
      background: color-mix(in srgb, var(--accent, #7eaad4) 10%, transparent);
      color: color-mix(in srgb, var(--accent, #7eaad4) 84%, var(--text-strong, #fff) 8%);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .oc-image-upload-card.is-complete .oc-image-upload-card__status {
      border-color: color-mix(in srgb, #22c55e 26%, transparent);
      background: color-mix(in srgb, #22c55e 12%, transparent);
      color: color-mix(in srgb, #22c55e 84%, white 8%);
    }

    .oc-image-upload-card__slots {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(156px, 1fr));
      align-items: stretch;
    }

    .oc-image-upload-card__slot {
      display: grid;
      gap: 6px;
      border: 1px solid color-mix(in srgb, var(--border, rgba(148, 163, 184, 0.2)) 76%, transparent);
      border-radius: 12px;
      padding: 10px 10px 8px;
      background: color-mix(in srgb, var(--panel, var(--card)) 86%, transparent);
      min-height: 170px;
      align-content: start;
    }

    .oc-image-upload-card__slot.is-locked {
      opacity: 0.84;
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
      font-size: 10px;
      font-weight: 700;
      color: color-mix(in srgb, var(--accent, #7eaad4) 82%, var(--text-strong, #fff) 8%);
      background: color-mix(in srgb, var(--accent, #7eaad4) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent, #7eaad4) 30%, transparent);
      border-radius: 999px;
      padding: 2px 7px;
      white-space: nowrap;
    }

    .oc-image-upload-card__slot-status.is-ready {
      color: color-mix(in srgb, #2563eb 84%, var(--text-strong, #fff) 8%);
      border-color: color-mix(in srgb, #2563eb 28%, transparent);
      background: color-mix(in srgb, #2563eb 10%, transparent);
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

    .oc-image-upload-card__slot-upload-box {
      appearance: none;
      width: 100%;
      border: 1px dashed color-mix(in srgb, var(--accent, #7eaad4) 42%, var(--border, rgba(148, 163, 184, 0.4)));
      border-radius: 12px;
      min-height: 100px;
      background:
        linear-gradient(
          0deg,
          color-mix(in srgb, var(--panel, var(--card)) 94%, transparent),
          color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 88%, transparent)
        );
      display: grid;
      place-items: center;
      gap: 6px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      padding: 0;
    }

    .oc-image-upload-card__slot-upload-box::before,
    .oc-image-upload-card__slot-upload-box::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .oc-image-upload-card__slot-upload-box::before {
      background:
        linear-gradient(
          to right,
          transparent calc(50% - 0.5px),
          color-mix(in srgb, var(--accent, #7eaad4) 22%, transparent) calc(50% - 0.5px),
          color-mix(in srgb, var(--accent, #7eaad4) 22%, transparent) calc(50% + 0.5px),
          transparent calc(50% + 0.5px)
        ),
        linear-gradient(
          to bottom,
          transparent calc(50% - 0.5px),
          color-mix(in srgb, var(--accent, #7eaad4) 22%, transparent) calc(50% - 0.5px),
          color-mix(in srgb, var(--accent, #7eaad4) 22%, transparent) calc(50% + 0.5px),
          transparent calc(50% + 0.5px)
        );
    }

    .oc-image-upload-card__slot-upload-box::after {
      inset: 12px;
      border: 1px solid color-mix(in srgb, var(--accent, #7eaad4) 18%, transparent);
      border-radius: 10px;
    }

    .oc-image-upload-card__slot-upload-box:hover {
      border-color: color-mix(in srgb, var(--accent, #7eaad4) 62%, var(--border, rgba(148, 163, 184, 0.2)));
      background:
        linear-gradient(
          0deg,
          color-mix(in srgb, var(--panel, var(--card)) 90%, transparent),
          color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 84%, transparent)
        );
    }

    .oc-image-upload-card__slot-upload-box:disabled,
    .oc-image-upload-card__slot.is-locked .oc-image-upload-card__slot-upload-box {
      cursor: not-allowed;
    }

    .oc-image-upload-card__slot-upload-box:disabled:hover,
    .oc-image-upload-card__slot.is-locked .oc-image-upload-card__slot-upload-box:hover {
      border-color: color-mix(in srgb, var(--accent, #7eaad4) 42%, var(--border, rgba(148, 163, 184, 0.4)));
      background:
        linear-gradient(
          0deg,
          color-mix(in srgb, var(--panel, var(--card)) 94%, transparent),
          color-mix(in srgb, var(--bg-elevated, var(--panel, var(--card))) 88%, transparent)
        );
    }

    .oc-image-upload-card__slot-upload-box.has-preview {
      border-style: solid;
      border-color: color-mix(in srgb, var(--accent, #7eaad4) 30%, var(--border, rgba(148, 163, 184, 0.35)));
      background: color-mix(in srgb, var(--panel, var(--card)) 96%, transparent);
    }

    .oc-image-upload-card__slot-upload-box.has-preview::before {
      opacity: 0;
    }

    .oc-image-upload-card__slot-preview-image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      position: absolute;
      inset: 0;
    }

    .oc-image-upload-card__slot-upload-overlay {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      gap: 4px;
      padding: 12px;
      min-height: 100px;
      width: 100%;
      background: color-mix(in srgb, var(--panel, var(--card)) 12%, transparent);
      backdrop-filter: blur(0px);
      transition: background 160ms ease;
    }

    .oc-image-upload-card__slot-upload-box.has-preview .oc-image-upload-card__slot-upload-overlay {
      background: linear-gradient(
        180deg,
        color-mix(in srgb, rgba(15, 23, 42, 0.02) 20%, transparent),
        color-mix(in srgb, rgba(15, 23, 42, 0.5) 100%, transparent)
      );
      align-content: end;
    }

    .oc-image-upload-card__slot-upload-plus {
      font-size: 32px;
      line-height: 1;
      font-weight: 700;
      color: color-mix(in srgb, var(--accent, #7eaad4) 90%, var(--text-strong, #fff) 10%);
    }

    .oc-image-upload-card__slot-upload-box.has-preview .oc-image-upload-card__slot-upload-plus,
    .oc-image-upload-card__slot-upload-box.has-preview .oc-image-upload-card__slot-upload-guide {
      color: #fff;
      text-shadow: 0 1px 6px rgba(15, 23, 42, 0.45);
    }

    .oc-image-upload-card__slot-upload-guide {
      font-size: 12px;
      line-height: 1.3;
      font-weight: 600;
      color: color-mix(in srgb, currentColor 75%, transparent);
    }

    .oc-image-upload-card__slot-input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
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

    @media (max-width: 720px) {
      .oc-image-upload-card__slots {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      }
    }

    .oc-image-upload-card__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .oc-image-upload-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .oc-image-upload-card__hint {
      font-size: 12px;
      line-height: 1.45;
      color: color-mix(in srgb, currentColor 72%, transparent);
    }

    .oc-image-upload-card.is-complete .oc-image-upload-card__hint {
      color: color-mix(in srgb, #22c55e 78%, currentColor 22%);
      font-weight: 600;
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

    .oc-image-upload-card.is-complete .oc-image-upload-card__action--primary {
      border-color: color-mix(in srgb, #22c55e 24%, transparent);
      background:
        linear-gradient(135deg, color-mix(in srgb, #22c55e 84%, white 8%), color-mix(in srgb, #16a34a 88%, black 4%));
      box-shadow: 0 14px 26px color-mix(in srgb, #22c55e 14%, transparent);
    }

    .oc-image-upload-card__action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    @media (max-width: 720px) {
      .oc-image-upload-card__header {
        grid-template-columns: 1fr;
      }

      .oc-image-upload-card__footer {
        flex-direction: column;
        align-items: stretch;
      }

      .oc-image-upload-card__status {
        justify-self: start;
      }

      .oc-image-upload-card__actions {
        width: 100%;
      }

      .oc-image-upload-card__action {
        flex: 1 1 160px;
      }
    }
  `;
}

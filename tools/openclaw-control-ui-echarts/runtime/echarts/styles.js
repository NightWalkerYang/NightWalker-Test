export function getEchartsStyles() {
  return `
    .oc-block-renderer__chart {
      width: 100%;
      min-height: 320px;
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
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(6px);
    }

    .oc-echarts-detail-modal__dialog {
      width: min(720px, calc(100vw - 32px));
      max-height: min(80vh, 880px);
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid rgba(127, 127, 127, 0.2);
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
    }

    .oc-echarts-detail-modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid rgba(127, 127, 127, 0.14);
    }

    .oc-echarts-detail-modal__title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
    }

    .oc-echarts-detail-modal__close {
      appearance: none;
      border: 1px solid rgba(127, 127, 127, 0.22);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      padding: 7px 12px;
    }

    .oc-echarts-detail-modal__close:hover {
      background: rgba(127, 127, 127, 0.08);
    }

    .oc-echarts-detail-modal__body {
      padding: 18px;
      overflow: auto;
      max-height: calc(min(80vh, 880px) - 74px);
    }

    .oc-echarts-detail-modal__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .oc-echarts-detail-modal__card {
      border-radius: 14px;
      border: 1px solid rgba(127, 127, 127, 0.16);
      background: rgba(248, 250, 252, 0.92);
      padding: 12px 14px;
    }

    .oc-echarts-detail-modal__label {
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(15, 23, 42, 0.68);
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

    .oc-echarts-detail-modal__section {
      margin-top: 18px;
    }

    .oc-echarts-detail-modal__section:first-child {
      margin-top: 0;
    }

    .oc-echarts-detail-modal__section-title {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
    }

    .oc-echarts-detail-modal__pre {
      margin: 0;
      padding: 12px 14px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 14px;
      border: 1px solid rgba(127, 127, 127, 0.16);
      background: rgba(248, 250, 252, 0.92);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
    }

    .oc-echarts-detail-modal__empty {
      font-size: 14px;
      line-height: 1.6;
      color: rgba(15, 23, 42, 0.7);
    }
  `;
}

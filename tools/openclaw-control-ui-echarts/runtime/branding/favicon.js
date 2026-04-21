import { getCurrentBrandState } from "./brand-state.js";

const BRAND_FAVICON_TEXT = "SPTC";

function escapeSvgText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getResolvedTextFaviconLabel() {
  const state = getCurrentBrandState();
  const label = state.logoMode === "text" ? state.logoText : state.brandName;
  return String(label || BRAND_FAVICON_TEXT).trim() || BRAND_FAVICON_TEXT;
}

export function getBrandFaviconSvg() {
  const faviconText = escapeSvgText(getResolvedTextFaviconLabel());
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="sptc-bg" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#f7fbff" />
          <stop offset="1" stop-color="#d9e6f4" />
        </linearGradient>
        <linearGradient id="sptc-stroke" x1="14" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#88acd0" />
          <stop offset="1" stop-color="#5f88b1" />
        </linearGradient>
      </defs>
      <rect x="5.5" y="5.5" width="53" height="53" rx="16" fill="url(#sptc-bg)" stroke="url(#sptc-stroke)" stroke-width="1.5" />
      <text x="32" y="37" text-anchor="middle" font-size="18" font-weight="800" letter-spacing="2.2" fill="#48698d" font-family="Inter, Segoe UI, Arial, sans-serif">${faviconText}</text>
    </svg>
  `.trim();
}

export function getBrandFaviconDataUrl() {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getBrandFaviconSvg())}`;
}

export function getBrandFaviconAsset() {
  const state = getCurrentBrandState();
  if (state.logoMode === "image" && state.logoImage?.src) {
    return {
      href: state.logoImage.src,
      type: state.logoImage.mimeType || "image/png",
    };
  }

  return {
    href: getBrandFaviconDataUrl(),
    type: "image/svg+xml",
  };
}

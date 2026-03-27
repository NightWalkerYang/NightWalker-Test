const BRAND_FAVICON_TEXT = "SPTC";

export function getBrandFaviconSvg() {
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
      <text x="32" y="37" text-anchor="middle" font-size="18" font-weight="800" letter-spacing="2.2" fill="#48698d" font-family="Inter, Segoe UI, Arial, sans-serif">${BRAND_FAVICON_TEXT}</text>
    </svg>
  `.trim();
}

export function getBrandFaviconDataUrl() {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getBrandFaviconSvg())}`;
}

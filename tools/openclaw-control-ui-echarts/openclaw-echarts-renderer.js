import { createFencedBlockRuntime } from "./runtime/framework/fenced-block-runtime.js";
import { bootBrandReplacer } from "./runtime/branding/brand-replacer.js";
import { createEchartsAdapter } from "./runtime/echarts/adapter.js";

const scriptUrl = new URL(import.meta.url);
const vendorBaseUrl = new URL("./vendor/", scriptUrl);

const runtime = createFencedBlockRuntime([
  createEchartsAdapter({
    vendorBaseUrl,
  }),
]);

function boot() {
  bootBrandReplacer();
  runtime.boot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

import { createFencedBlockRuntime } from "./runtime/framework/fenced-block-runtime.js";
import { createEchartsAdapter } from "./runtime/echarts/adapter.js";

const scriptUrl = new URL(import.meta.url);
const vendorBaseUrl = new URL("./vendor/", scriptUrl);

const runtime = createFencedBlockRuntime([
  createEchartsAdapter({
    vendorBaseUrl,
  }),
]);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => runtime.boot(), { once: true });
} else {
  runtime.boot();
}

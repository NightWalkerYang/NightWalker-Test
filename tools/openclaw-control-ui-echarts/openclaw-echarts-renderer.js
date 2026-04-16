import { bootChatAmbientBackground } from "./runtime/background/chat-ambient.js";
import { bootBrandReplacer } from "./runtime/branding/brand-replacer.js";
import { bootEchartsViewSurface } from "./runtime/echarts-view/surface.js";
import { createEchartsAdapter } from "./runtime/echarts/adapter.js";
import { createFileAdapter } from "./runtime/file/adapter.js";
import { createFencedBlockRuntime } from "./runtime/framework/fenced-block-runtime.js";
import { bootToolRunCluster } from "./runtime/framework/tool-run-cluster.js";
import { bootVoiceInputBridge } from "./runtime/framework/voice-input.js";
import { bootKnowledgeGraphEntry } from "./runtime/knowledge-graph/entry.js";
import { bootLufengSurface } from "./runtime/lufeng/surface.js";
import { bootTenantAuthSurface } from "./runtime/tenant/auth-surface.js";
import { bootTenantEntry } from "./runtime/tenant/entry.js";
import { bootMemberChatSurface } from "./runtime/tenant/member-chat-surface.js";
import { bootMemberSurface } from "./runtime/tenant/member-surface.js";
import { bootPlatformAccessGuard } from "./runtime/tenant/platform-access-guard.js";
import { bootPlatformSurface } from "./runtime/tenant/platform-surface.js";
import { bootTenantSurface } from "./runtime/tenant/tenant-surface.js";

const scriptUrl = new URL(import.meta.url);
const vendorBaseUrl = new URL("./vendor/", scriptUrl);
const controlUiRootUrl = new URL("../", scriptUrl);

// Expose globally for components that need to side-load libraries
window.__ocVendorBaseUrl = vendorBaseUrl;

const runtime = createFencedBlockRuntime([
  createEchartsAdapter({
    vendorBaseUrl,
  }),
  createFileAdapter({
    vendorBaseUrl,
    controlUiRootUrl,
  }),
]);

function boot() {
  bootBrandReplacer();
  bootChatAmbientBackground();
  bootToolRunCluster();
  bootVoiceInputBridge();
  bootKnowledgeGraphEntry();
  bootTenantAuthSurface();
  bootPlatformAccessGuard();
  bootPlatformSurface();
  bootTenantSurface();
  bootMemberSurface();
  bootMemberChatSurface();
  bootEchartsViewSurface();
  bootTenantEntry();
  bootLufengSurface();
  runtime.boot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

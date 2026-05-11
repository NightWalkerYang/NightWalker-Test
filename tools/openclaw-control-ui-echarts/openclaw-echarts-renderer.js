import { bootChatAmbientBackground } from "./runtime/background/chat-ambient.js";
import { bootBrandPanel } from "./runtime/branding/brand-panel.js";
import { bootBrandReplacer } from "./runtime/branding/brand-replacer.js";
import { isEchartsViewPublicPath } from "./runtime/echarts-view/context.js";
import { bootEchartsViewSurface } from "./runtime/echarts-view/surface.js";
import { createEchartsAdapter } from "./runtime/echarts/adapter.js";
import { createFileAdapter } from "./runtime/file/adapter.js";
import { observeFrameworkDomMarkers } from "./runtime/framework/dom-compat.js";
import { createFencedBlockRuntime } from "./runtime/framework/fenced-block-runtime.js";
import { bootToolRunCluster } from "./runtime/framework/tool-run-cluster.js";
import { bootVoiceInputBridge } from "./runtime/framework/voice-input.js";
import { createImageUploadAdapter } from "./runtime/image-upload/adapter.js";
import { bootKnowledgeGraphEntry } from "./runtime/knowledge-graph/entry.js";
import { bootLufengSurface } from "./runtime/lufeng/surface.js";
import { isSandboxViewPublicPath } from "./runtime/sandbox-view/context.js";
import { bootSandboxViewSurface } from "./runtime/sandbox-view/surface.js";
import { createSelectAdapter } from "./runtime/select/adapter.js";
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
  createImageUploadAdapter({
    vendorBaseUrl,
  }),
  createSelectAdapter({
    vendorBaseUrl,
  }),
]);

function boot() {
  if (isEchartsViewPublicPath(window.location.pathname)) {
    bootEchartsViewSurface();
    return;
  }
  if (isSandboxViewPublicPath(window.location.pathname)) {
    bootSandboxViewSurface();
    return;
  }
  observeFrameworkDomMarkers(document);
  bootBrandReplacer();
  bootBrandPanel();
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
  bootSandboxViewSurface();
  bootTenantEntry();
  bootLufengSurface();
  runtime.boot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

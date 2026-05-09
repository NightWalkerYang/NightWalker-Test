import { applySandboxViewPublicBootstrap } from "./bootstrap.js";
import { bootSandboxViewSurface } from "./surface.js";

applySandboxViewPublicBootstrap();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootSandboxViewSurface(), { once: true });
} else {
  bootSandboxViewSurface();
}

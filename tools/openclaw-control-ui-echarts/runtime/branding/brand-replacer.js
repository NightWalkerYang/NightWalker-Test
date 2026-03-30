import { getBrandFaviconDataUrl } from "./favicon.js";

const TARGET_BRAND = "苏博泰克";
const TARGET_LOGO_TEXT = "SPTC";
const SOURCE_BRAND_PATTERN = /openclaw/gi;
const BRAND_TEXT_SELECTOR = [
  ".sidebar-brand__title",
  ".login-gate__title",
  ".dashboard-header__breadcrumb-link",
].join(", ");
const LOGO_SELECTOR = [
  ".sidebar-brand__logo",
  ".login-gate__logo",
  ".agent-chat__avatar--logo",
  ".chat-avatar--logo",
  ".agent-chat__badge img",
].join(", ");
const FAVICON_LINKS = [
  { rel: "icon", type: "image/svg+xml" },
  { rel: "shortcut icon", type: "image/svg+xml" },
  { rel: "apple-touch-icon", type: "image/svg+xml" },
];

function replaceBrandText(text) {
  return String(text ?? "").replace(SOURCE_BRAND_PATTERN, TARGET_BRAND);
}

function processBrandTextElement(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const current = element.textContent ?? "";
  const next = replaceBrandText(current);
  if (next !== current) {
    element.textContent = next;
  }
}

function createTextLogo(variant) {
  const chip = document.createElement("span");
  chip.className = `oc-text-logo oc-text-logo--${variant}`;
  chip.textContent = TARGET_LOGO_TEXT;
  chip.setAttribute("aria-label", TARGET_LOGO_TEXT);
  return chip;
}

function replaceNode(target, replacement) {
  if (!target?.parentNode) {
    return;
  }
  target.parentNode.replaceChild(replacement, target);
}

function replaceLogoElement(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (element.matches(".agent-chat__badge img")) {
    if (element.parentElement?.querySelector(".oc-text-logo--badge")) {
      element.remove();
      return;
    }

    replaceNode(element, createTextLogo("badge"));
    return;
  }

  if (element.matches(".agent-chat__avatar--logo")) {
    if (element.querySelector(".oc-text-logo--hero")) {
      return;
    }

    element.replaceChildren(createTextLogo("hero"));
    return;
  }

  if (element.matches(".sidebar-brand__logo")) {
    replaceNode(element, createTextLogo("sidebar"));
    return;
  }

  if (element.matches(".login-gate__logo")) {
    replaceNode(element, createTextLogo("login"));
    return;
  }

  if (element.matches(".chat-avatar--logo")) {
    replaceNode(element, createTextLogo("avatar"));
  }
}

function processLogoSubtree(root) {
  if (!(root instanceof Element)) {
    return;
  }

  if (root.matches(LOGO_SELECTOR)) {
    replaceLogoElement(root);
  }

  for (const element of root.querySelectorAll(LOGO_SELECTOR)) {
    replaceLogoElement(element);
  }
}

function processBrandTextSubtree(root) {
  if (!(root instanceof Element)) {
    return;
  }

  if (root.matches(BRAND_TEXT_SELECTOR)) {
    processBrandTextElement(root);
  }

  for (const element of root.querySelectorAll(BRAND_TEXT_SELECTOR)) {
    processBrandTextElement(element);
  }
}

function processSubtree(root) {
  if (!(root instanceof Element)) {
    return;
  }

  processLogoSubtree(root);
  processBrandTextSubtree(root);
}

function processDocumentTitle() {
  const currentTitle = document.title || "";
  const nextTitle = replaceBrandText(currentTitle);
  if (nextTitle !== currentTitle) {
    document.title = nextTitle;
  }
}

function processFavicons() {
  const href = getBrandFaviconDataUrl();
  const seenRels = new Set();

  for (const link of document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')) {
    if (!(link instanceof HTMLLinkElement)) {
      continue;
    }

    const rel = link.getAttribute("rel")?.trim().toLowerCase() || "icon";
    seenRels.add(rel);
    link.setAttribute("href", href);
    link.setAttribute("type", "image/svg+xml");
  }

  for (const definition of FAVICON_LINKS) {
    if (seenRels.has(definition.rel)) {
      continue;
    }

    const link = document.createElement("link");
    link.setAttribute("rel", definition.rel);
    link.setAttribute("href", href);
    link.setAttribute("type", definition.type);
    document.head.append(link);
  }
}

export function bootBrandReplacer() {
  if (window.__openclawBrandReplacerBooted) {
    return;
  }
  window.__openclawBrandReplacerBooted = true;

  const run = () => {
    processDocumentTitle();
    processFavicons();
    processSubtree(document.body);
  };

  run();

  const observer = new MutationObserver((mutations) => {
    processDocumentTitle();
    processFavicons();
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        if (!(parent instanceof HTMLElement)) {
          return;
        }

        const brandTarget = parent.closest(BRAND_TEXT_SELECTOR);
        if (brandTarget instanceof HTMLElement) {
          processBrandTextElement(brandTarget);
        }
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          processSubtree(node);
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

import { getBrandFaviconAsset } from "./favicon.js";
import {
  bootBrandStateSync,
  getCurrentBrandState,
  loadBrandState,
  subscribeBrandState,
} from "./brand-state.js";

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
const INJECTED_TEXT_LOGO_SELECTOR = ".oc-text-logo";
const INJECTED_IMAGE_LOGO_SELECTOR = ".oc-image-logo";
const FAVICON_LINKS = [
  { rel: "icon" },
  { rel: "shortcut icon" },
  { rel: "apple-touch-icon" },
];

function getResolvedBrandState() {
  return getCurrentBrandState();
}

function getResolvedBrandName() {
  return getResolvedBrandState().brandName;
}

function getResolvedPageTitle() {
  return getResolvedBrandState().pageTitle || getResolvedBrandName();
}

function getResolvedLogoText() {
  return getResolvedBrandState().logoText;
}

function getResolvedLogoImageSrc() {
  return getResolvedBrandState().logoImage?.src || "";
}

function isImageLogoMode() {
  return getResolvedBrandState().logoMode === "image" && Boolean(getResolvedLogoImageSrc());
}

function processBrandTextElement(element, brandName) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if ((element.textContent ?? "") !== brandName) {
    element.textContent = brandName;
  }
}

function createTextLogo(variant, logoText) {
  const chip = document.createElement("span");
  chip.className = `oc-text-logo oc-text-logo--${variant}`;
  chip.textContent = logoText;
  chip.setAttribute("aria-label", logoText);
  return chip;
}

function createImageLogo(variant, imageSrc) {
  const wrap = document.createElement("span");
  wrap.className = `oc-image-logo oc-image-logo--${variant}`;
  const image = document.createElement("img");
  image.src = imageSrc;
  image.alt = getResolvedBrandName();
  wrap.append(image);
  return wrap;
}

function replaceNode(target, replacement) {
  if (!target?.parentNode) {
    return;
  }
  target.parentNode.replaceChild(replacement, target);
}

function resolveInjectedLogoVariant(element) {
  if (!(element instanceof HTMLElement)) {
    return "";
  }
  for (const className of element.classList) {
    if (className.startsWith("oc-text-logo--")) {
      return className.slice("oc-text-logo--".length);
    }
    if (className.startsWith("oc-image-logo--")) {
      return className.slice("oc-image-logo--".length);
    }
  }
  return "";
}

function replaceLogoElement(element, logoText, imageSrc) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  const imageMode = isImageLogoMode();

  if (element.matches(".agent-chat__badge img")) {
    if (element.parentElement?.querySelector(imageMode ? ".oc-image-logo--badge" : ".oc-text-logo--badge")) {
      element.remove();
      return;
    }

    replaceNode(element, imageMode ? createImageLogo("badge", imageSrc) : createTextLogo("badge", logoText));
    return;
  }

  if (element.matches(".agent-chat__avatar--logo")) {
    if (imageMode) {
      const existingImageLogo = element.querySelector(".oc-image-logo--hero img");
      if (existingImageLogo instanceof HTMLImageElement) {
        if (existingImageLogo.getAttribute("src") !== imageSrc) {
          existingImageLogo.setAttribute("src", imageSrc);
        }
        return;
      }
      element.replaceChildren(createImageLogo("hero", imageSrc));
      return;
    }

    if (element.querySelector(".oc-text-logo--hero")) {
      const logo = element.querySelector(".oc-text-logo--hero");
      if (logo instanceof HTMLElement && logo.textContent !== logoText) {
        logo.textContent = logoText;
      }
      return;
    }

    element.replaceChildren(createTextLogo("hero", logoText));
    return;
  }

  if (element.matches(".sidebar-brand__logo")) {
    replaceNode(element, imageMode ? createImageLogo("sidebar", imageSrc) : createTextLogo("sidebar", logoText));
    return;
  }

  if (element.matches(".login-gate__logo")) {
    replaceNode(element, imageMode ? createImageLogo("login", imageSrc) : createTextLogo("login", logoText));
    return;
  }

  if (element.matches(".chat-avatar--logo")) {
    replaceNode(element, imageMode ? createImageLogo("avatar", imageSrc) : createTextLogo("avatar", logoText));
  }
}

function processLogoSubtree(root, logoText) {
  if (!(root instanceof Element)) {
    return;
  }

  const imageSrc = getResolvedLogoImageSrc();

  if (root.matches(LOGO_SELECTOR)) {
    replaceLogoElement(root, logoText, imageSrc);
  }

  for (const element of root.querySelectorAll(LOGO_SELECTOR)) {
    replaceLogoElement(element, logoText, imageSrc);
  }

  const injectedSelector = [INJECTED_TEXT_LOGO_SELECTOR, INJECTED_IMAGE_LOGO_SELECTOR].join(", ");
  if (root.matches(injectedSelector)) {
    const variant = resolveInjectedLogoVariant(root);
    if (variant) {
      if (isImageLogoMode()) {
        if (root.matches(INJECTED_IMAGE_LOGO_SELECTOR)) {
          const image = root.querySelector("img");
          if (image instanceof HTMLImageElement && image.getAttribute("src") !== imageSrc) {
            image.setAttribute("src", imageSrc);
          }
        } else {
          replaceNode(root, createImageLogo(variant, imageSrc));
        }
      } else if (root.matches(INJECTED_TEXT_LOGO_SELECTOR)) {
        if (root.textContent !== logoText) {
          root.textContent = logoText;
        }
      } else {
        replaceNode(root, createTextLogo(variant, logoText));
      }
    }
  }

  for (const element of root.querySelectorAll(injectedSelector)) {
    const variant = resolveInjectedLogoVariant(element);
    if (!variant) {
      continue;
    }
    if (isImageLogoMode()) {
      if (element.matches(INJECTED_IMAGE_LOGO_SELECTOR)) {
        const image = element.querySelector("img");
        if (image instanceof HTMLImageElement && image.getAttribute("src") !== imageSrc) {
          image.setAttribute("src", imageSrc);
        }
        continue;
      }
      replaceNode(element, createImageLogo(variant, imageSrc));
      continue;
    }
    if (element.matches(INJECTED_TEXT_LOGO_SELECTOR)) {
      if (element.textContent !== logoText) {
        element.textContent = logoText;
      }
      continue;
    }
    replaceNode(element, createTextLogo(variant, logoText));
  }
}

function processBrandTextSubtree(root, brandName) {
  if (!(root instanceof Element)) {
    return;
  }

  if (root.matches(BRAND_TEXT_SELECTOR)) {
    processBrandTextElement(root, brandName);
  }

  for (const element of root.querySelectorAll(BRAND_TEXT_SELECTOR)) {
    processBrandTextElement(element, brandName);
  }
}

function processSubtree(root) {
  if (!(root instanceof Element)) {
    return;
  }

  processLogoSubtree(root, getResolvedLogoText());
  processBrandTextSubtree(root, getResolvedBrandName());
}

function processDocumentTitle() {
  const nextTitle = getResolvedPageTitle();
  if ((document.title || "") !== nextTitle) {
    document.title = nextTitle;
  }
}

function processFavicons() {
  const favicon = getBrandFaviconAsset();
  const seenRels = new Set();

  for (const link of document.head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')) {
    if (!(link instanceof HTMLLinkElement)) {
      continue;
    }

    const rel = link.getAttribute("rel")?.trim().toLowerCase() || "icon";
    seenRels.add(rel);
    link.setAttribute("href", favicon.href);
    if (favicon.type) {
      link.setAttribute("type", favicon.type);
    } else {
      link.removeAttribute("type");
    }
  }

  for (const definition of FAVICON_LINKS) {
    if (seenRels.has(definition.rel)) {
      continue;
    }

    const link = document.createElement("link");
    link.setAttribute("rel", definition.rel);
    link.setAttribute("href", favicon.href);
    if (favicon.type) {
      link.setAttribute("type", favicon.type);
    }
    document.head.append(link);
  }
}

export function bootBrandReplacer() {
  if (window.__openclawBrandReplacerBooted) {
    return;
  }
  window.__openclawBrandReplacerBooted = true;
  bootBrandStateSync();

  const run = () => {
    processDocumentTitle();
    processFavicons();
    processSubtree(document.body);
  };

  run();
  subscribeBrandState(() => {
    run();
  });
  void loadBrandState().then(() => {
    run();
  });

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
          processBrandTextElement(brandTarget, getResolvedBrandName());
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

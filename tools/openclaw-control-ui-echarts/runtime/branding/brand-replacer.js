const TARGET_BRAND = "苏博泰克";
const SOURCE_BRAND_PATTERN = /openclaw/gi;
const SKIP_SELECTOR =
  "code, pre, samp, kbd, textarea, input, script, style, noscript, [contenteditable='true']";

function replaceBrandText(text) {
  return String(text ?? "").replace(SOURCE_BRAND_PATTERN, TARGET_BRAND);
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!(parent instanceof HTMLElement)) {
    return true;
  }
  return Boolean(parent.closest(SKIP_SELECTOR));
}

function processTextNode(node) {
  if (!(node instanceof Text) || shouldSkipTextNode(node)) {
    return;
  }

  const current = node.nodeValue ?? "";
  const next = replaceBrandText(current);
  if (next !== current) {
    node.nodeValue = next;
  }
}

function processSubtree(root) {
  if (!root) {
    return;
  }

  if (root instanceof Text) {
    processTextNode(root);
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    processTextNode(current);
    current = walker.nextNode();
  }
}

function processDocumentTitle() {
  const currentTitle = document.title || "";
  const nextTitle = replaceBrandText(currentTitle);
  if (nextTitle !== currentTitle) {
    document.title = nextTitle;
  }
}

export function bootBrandReplacer() {
  if (window.__openclawBrandReplacerBooted) {
    return;
  }
  window.__openclawBrandReplacerBooted = true;

  const run = () => {
    processDocumentTitle();
    processSubtree(document.body);
  };

  run();

  const observer = new MutationObserver((mutations) => {
    processDocumentTitle();
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        processTextNode(mutation.target);
        return;
      }

      mutation.addedNodes.forEach((node) => {
        processSubtree(node);
      });
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

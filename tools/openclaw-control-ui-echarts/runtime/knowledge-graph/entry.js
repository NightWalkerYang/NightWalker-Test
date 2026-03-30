const LINK_SELECTOR = ".oc-knowledge-graph-link";
const SIDEBAR_UTILITY_SELECTOR = ".sidebar-utility-group";
const GRAPH_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 7.5a2.5 2.5 0 1 1 2.08 2.47v4.06a2.5 2.5 0 1 1-1.16.01V9.97A2.5 2.5 0 0 1 6 7.5Z"></path>
    <path d="M15.5 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"></path>
    <path d="M17.5 14a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"></path>
    <path d="M8.96 8.36 13.1 7.7M8.8 15.76l6.4 1.5M14.38 9.56l2.16 4.88"></path>
  </svg>
`;

function resolveKnowledgeGraphHref() {
  return new URL("./knowledge-graph.html", document.baseURI).href;
}

function createKnowledgeGraphLink() {
  const link = document.createElement("a");
  link.className = "nav-item sidebar-utility-link oc-knowledge-graph-link";
  link.href = resolveKnowledgeGraphHref();
  link.title = "知识图谱";
  link.innerHTML = `
    <span class="nav-item__icon" aria-hidden="true">${GRAPH_ICON}</span>
    <span class="nav-item__text">知识图谱</span>
  `;
  return link;
}

function ensureKnowledgeGraphLink(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.querySelector(LINK_SELECTOR)) {
    return;
  }
  container.append(createKnowledgeGraphLink());
}

export function bootKnowledgeGraphEntry() {
  if (window.__openclawKnowledgeGraphEntryBooted) {
    return;
  }
  window.__openclawKnowledgeGraphEntryBooted = true;

  const scan = (root = document) => {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    if (scope instanceof Element && scope.matches(SIDEBAR_UTILITY_SELECTOR)) {
      ensureKnowledgeGraphLink(scope);
    }
    for (const container of scope.querySelectorAll(SIDEBAR_UTILITY_SELECTOR)) {
      ensureKnowledgeGraphLink(container);
    }
  };

  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          scan(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
}

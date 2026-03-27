const GROUP_SELECTOR = ".chat-group";
const RUN_ATTR = "data-oc-tool-run";
const RUN_EXPANDED_ATTR = "data-oc-tool-run-expanded";
const RUN_HIDDEN_ATTR = "data-oc-tool-run-hidden";
const CLUSTER_SELECTOR = ".oc-tool-run-cluster";
const CLUSTER_OPEN_ATTR = "data-oc-tool-run-open";
const TOGGLE_SELECTOR = ".oc-tool-run-cluster__toggle";
const STACK_ATTR = "data-oc-tool-run-stack";
const STACK_ENTRY_ATTR = "data-oc-tool-run-entry";
const STACK_ENTRY_HIDDEN_ATTR = "data-oc-tool-run-entry-hidden";
const TOOL_ENTRY_SELECTOR = ".chat-bubble, .chat-tools-collapse, .chat-tool-msg-collapse";

function isElement(node) {
  return node && node.nodeType === Node.ELEMENT_NODE;
}

function isToolCallOnlyAssistantGroup(group) {
  if (!group?.matches?.(".chat-group.assistant")) {
    return false;
  }

  if (!group.querySelector(".chat-tools-collapse")) {
    return false;
  }

  return !group.querySelector(
    ".chat-text, .chat-thinking, .chat-json-collapse, .chat-message-images, .oc-block-renderer",
  );
}

function isToolSequenceGroup(group) {
  return group?.matches?.(".chat-group.tool") || isToolCallOnlyAssistantGroup(group);
}

function clearToolRunMarkers() {
  for (const group of document.querySelectorAll(`${GROUP_SELECTOR}[${RUN_ATTR}]`)) {
    group.removeAttribute(RUN_ATTR);
  }
}

function clearToolStackMarkers() {
  for (const group of document.querySelectorAll(`${GROUP_SELECTOR}[${STACK_ATTR}]`)) {
    group.removeAttribute(STACK_ATTR);
  }

  for (const entry of document.querySelectorAll(`[${STACK_ENTRY_ATTR}]`)) {
    entry.removeAttribute(STACK_ENTRY_ATTR);
    entry.removeAttribute(STACK_ENTRY_HIDDEN_ATTR);
    entry.hidden = false;
  }
}

function unwrapExistingClusters() {
  for (const wrapper of document.querySelectorAll(CLUSTER_SELECTOR)) {
    const parent = wrapper.parentNode;
    if (!parent) {
      continue;
    }

    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }
    wrapper.remove();
  }
}

function collectSiblingGroups(parent) {
  return Array.from(parent.children).filter(
    (child) => isElement(child) && child.matches?.(GROUP_SELECTOR),
  );
}

function collectRunRanges(groups) {
  const ranges = [];
  let index = 0;

  while (index < groups.length) {
    if (!isToolSequenceGroup(groups[index])) {
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < groups.length && isToolSequenceGroup(groups[end])) {
      end += 1;
    }

    const runLength = end - index;
    if (runLength > 1) {
      ranges.push([index, end]);
    }

    index = end;
  }

  return ranges;
}

function collectWrapperGroups(wrapper) {
  return Array.from(wrapper.children).filter(
    (child) => isElement(child) && child.matches?.(GROUP_SELECTOR),
  );
}

function collectToolEntries(group) {
  const container = group?.querySelector?.(".chat-group-messages");
  if (!container) {
    return [];
  }

  return Array.from(container.children).filter(
    (child) => isElement(child) && child.matches?.(TOOL_ENTRY_SELECTOR),
  );
}

function syncClusterToggleState(wrapper) {
  const expanded = wrapper.getAttribute(CLUSTER_OPEN_ATTR) === "true";
  const button = wrapper.querySelector(TOGGLE_SELECTOR);

  if (button) {
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    button.setAttribute("aria-label", expanded ? "收起工具过程" : "展开工具过程");
    button.setAttribute("title", expanded ? "收起工具过程" : "展开工具过程");
  }

  for (const group of collectWrapperGroups(wrapper)) {
    if (expanded) {
      group.setAttribute(RUN_EXPANDED_ATTR, "true");
      group.removeAttribute(RUN_HIDDEN_ATTR);
    } else {
      group.removeAttribute(RUN_EXPANDED_ATTR);
      if (group.getAttribute(RUN_ATTR) === "end") {
        group.removeAttribute(RUN_HIDDEN_ATTR);
      } else {
        group.setAttribute(RUN_HIDDEN_ATTR, "true");
      }
    }
    group.hidden = !expanded && group.getAttribute(RUN_ATTR) !== "end";
  }
}

function setClusterExpanded(wrapper, expanded) {
  if (expanded) {
    wrapper.setAttribute(CLUSTER_OPEN_ATTR, "true");
  } else {
    wrapper.removeAttribute(CLUSTER_OPEN_ATTR);
  }
  syncClusterToggleState(wrapper);
}

function createToggleButton(host, getExpanded, setExpanded) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "oc-tool-run-cluster__toggle";
  button.innerHTML = `
    <svg class="oc-tool-run-cluster__toggle-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2.25 4.25 6 8l3.75-3.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>
    </svg>
  `;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded(host, !getExpanded(host));
  });
  return button;
}

function clearRunToggles(groups) {
  for (const group of groups) {
    for (const button of group.querySelectorAll(TOGGLE_SELECTOR)) {
      button.remove();
    }
  }
}

function mountToggle(wrapper, lastGroup) {
  const target =
    lastGroup.querySelector(".chat-bubble") ||
    lastGroup.querySelector(".chat-tools-summary, .chat-tool-msg-summary");
  if (!target) {
    return;
  }

  target.append(
    createToggleButton(
      wrapper,
      (node) => node.getAttribute(CLUSTER_OPEN_ATTR) === "true",
      setClusterExpanded,
    ),
  );
}

function wrapRun(parent, groups) {
  const wrapper = document.createElement("div");
  wrapper.className = "oc-tool-run-cluster";
  wrapper.setAttribute("data-oc-tool-run-size", String(groups.length));

  const expanded = groups.some((group) => group.getAttribute(RUN_EXPANDED_ATTR) === "true");
  parent.insertBefore(wrapper, groups[0] || null);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (index === 0) {
      group.setAttribute(RUN_ATTR, "start");
    } else if (index === groups.length - 1) {
      group.setAttribute(RUN_ATTR, "end");
    } else {
      group.setAttribute(RUN_ATTR, "mid");
    }
    wrapper.append(group);
  }

  clearRunToggles(groups);
  mountToggle(wrapper, groups[groups.length - 1]);
  setClusterExpanded(wrapper, expanded);
}

function clearInactiveExpandedMarkers() {
  for (const group of document.querySelectorAll(`${GROUP_SELECTOR}[${RUN_EXPANDED_ATTR}]`)) {
    if (!group.hasAttribute(RUN_ATTR)) {
      group.removeAttribute(RUN_EXPANDED_ATTR);
    }
  }
}

function syncStackToggleState(group) {
  const expanded = group.getAttribute(CLUSTER_OPEN_ATTR) === "true";
  const button = group.querySelector(TOGGLE_SELECTOR);

  if (button) {
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    button.setAttribute("aria-label", expanded ? "收起工具过程" : "展开工具过程");
    button.setAttribute("title", expanded ? "收起工具过程" : "展开工具过程");
  }

  const entries = collectToolEntries(group);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    entry.setAttribute(STACK_ENTRY_ATTR, index === entries.length - 1 ? "end" : "mid");
    if (expanded || index === entries.length - 1) {
      entry.removeAttribute(STACK_ENTRY_HIDDEN_ATTR);
      entry.hidden = false;
    } else {
      entry.setAttribute(STACK_ENTRY_HIDDEN_ATTR, "true");
      entry.hidden = true;
    }
  }
}

function setStackExpanded(group, expanded) {
  if (expanded) {
    group.setAttribute(CLUSTER_OPEN_ATTR, "true");
  } else {
    group.removeAttribute(CLUSTER_OPEN_ATTR);
  }
  syncStackToggleState(group);
}

function mountStackToggle(group, lastEntry) {
  const target =
    lastEntry.matches?.(".chat-bubble")
      ? lastEntry
      : lastEntry.querySelector(".chat-tools-summary, .chat-tool-msg-summary");
  if (!target) {
    return;
  }

  target.append(
    createToggleButton(
      group,
      (node) => node.getAttribute(CLUSTER_OPEN_ATTR) === "true",
      setStackExpanded,
    ),
  );
}

function syncGroupedToolStacks() {
  for (const group of document.querySelectorAll(`${GROUP_SELECTOR}.tool`)) {
    if (group.hasAttribute(RUN_ATTR)) {
      continue;
    }

    const entries = collectToolEntries(group);
    if (entries.length <= 1) {
      continue;
    }

    group.setAttribute(STACK_ATTR, "true");
    clearRunToggles([group]);
    mountStackToggle(group, entries[entries.length - 1]);
    syncStackToggleState(group);
  }
}

function syncToolRuns() {
  unwrapExistingClusters();
  clearToolRunMarkers();
  clearToolStackMarkers();

  const parents = new Set();
  for (const group of document.querySelectorAll(GROUP_SELECTOR)) {
    if (group.parentElement) {
      parents.add(group.parentElement);
    }
  }

  for (const parent of parents) {
    const groups = collectSiblingGroups(parent);
    for (const [start, end] of collectRunRanges(groups)) {
      wrapRun(parent, groups.slice(start, end));
    }
  }

  clearInactiveExpandedMarkers();
  syncGroupedToolStacks();
}

export function bootToolRunCluster() {
  let frame = 0;
  let syncing = false;
  let observing = false;

  const observer = new MutationObserver(() => {
    if (syncing) {
      return;
    }
    schedule();
  });

  const observe = () => {
    if (observing) {
      return;
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    observing = true;
  };

  const suspendObserver = () => {
    if (!observing) {
      return;
    }
    observer.disconnect();
    observing = false;
  };

  const runSync = () => {
    if (syncing) {
      return;
    }

    syncing = true;
    suspendObserver();
    try {
      syncToolRuns();
    } finally {
      syncing = false;
      observe();
    }
  };

  const schedule = () => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      runSync();
    });
  };

  runSync();

  window.addEventListener("pageshow", schedule);
}

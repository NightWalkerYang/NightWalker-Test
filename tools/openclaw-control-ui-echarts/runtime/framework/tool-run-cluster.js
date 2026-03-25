const GROUP_SELECTOR = ".chat-group";
const RUN_ATTR = "data-oc-tool-run";

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

function collectSiblingGroups(parent) {
  return Array.from(parent.children).filter(
    (child) => isElement(child) && child.matches?.(GROUP_SELECTOR),
  );
}

function markToolRuns(groups) {
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
      for (let offset = 0; offset < runLength; offset += 1) {
        const group = groups[index + offset];
        if (offset === 0) {
          group.setAttribute(RUN_ATTR, "start");
        } else if (offset === runLength - 1) {
          group.setAttribute(RUN_ATTR, "end");
        } else {
          group.setAttribute(RUN_ATTR, "mid");
        }
      }
    }

    index = end;
  }
}

function syncToolRuns() {
  clearToolRunMarkers();

  const parents = new Set();
  for (const group of document.querySelectorAll(GROUP_SELECTOR)) {
    if (group.parentElement) {
      parents.add(group.parentElement);
    }
  }

  for (const parent of parents) {
    markToolRuns(collectSiblingGroups(parent));
  }
}

export function bootToolRunCluster() {
  let frame = 0;

  const schedule = () => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncToolRuns();
    });
  };

  syncToolRuns();

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener("pageshow", schedule);
}

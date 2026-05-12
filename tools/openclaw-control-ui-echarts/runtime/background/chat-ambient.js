import { findChatSurface } from "../framework/dom-compat.js";

const HOST_CLASS = "oc-chat-ambient";
const MEMBER_CHAT_ROUTE_ATTR = "data-oc-member-chat-route";
const CHAT_OBSERVER_RELEVANT_SELECTOR = [
  ".content--chat",
  ".agent-chat__input",
  "textarea",
  ".chat-group",
  ".chat-bubble",
  ".chat-message",
  ".chat-group-messages",
  ".chat-group-footer",
  ".chat-tools-collapse",
  ".chat-tool-msg-collapse",
  "[data-oc-chat-surface]",
  "[data-oc-chat-composer]",
  "[data-oc-chat-group]",
  "[data-oc-chat-bubble]",
  `html[${MEMBER_CHAT_ROUTE_ATTR}="true"]`,
  `body[${MEMBER_CHAT_ROUTE_ATTR}="true"]`,
].join(", ");

let ambientIdCounter = 0;

function createAmbientSvgMarkup(id) {
  return `
    <svg class="oc-chat-ambient__svg" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${id}-band-a" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--oc-chat-band-a-start)"></stop>
          <stop offset="55%" stop-color="var(--oc-chat-band-a-mid)"></stop>
          <stop offset="100%" stop-color="var(--oc-chat-band-a-end)"></stop>
        </linearGradient>
        <linearGradient id="${id}-band-b" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--oc-chat-band-b-start)"></stop>
          <stop offset="50%" stop-color="var(--oc-chat-band-b-mid)"></stop>
          <stop offset="100%" stop-color="var(--oc-chat-band-b-end)"></stop>
        </linearGradient>
        <linearGradient id="${id}-band-c" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--oc-chat-band-c-start)"></stop>
          <stop offset="100%" stop-color="var(--oc-chat-band-c-end)"></stop>
        </linearGradient>
        <linearGradient id="${id}-trace" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--oc-chat-trace-soft)"></stop>
          <stop offset="55%" stop-color="var(--oc-chat-trace-bright)"></stop>
          <stop offset="100%" stop-color="var(--oc-chat-trace-soft)"></stop>
        </linearGradient>
        <linearGradient id="${id}-trace-warm" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--oc-chat-trace-warm-start)"></stop>
          <stop offset="100%" stop-color="var(--oc-chat-trace-warm-end)"></stop>
        </linearGradient>
        <filter id="${id}-glow-wide" x="-35%" y="-50%" width="170%" height="200%">
          <feGaussianBlur stdDeviation="34"></feGaussianBlur>
        </filter>
        <filter id="${id}-glow-soft" x="-28%" y="-42%" width="156%" height="184%">
          <feGaussianBlur stdDeviation="18"></feGaussianBlur>
        </filter>
        <filter id="${id}-glow-trace" x="-24%" y="-36%" width="148%" height="172%">
          <feGaussianBlur stdDeviation="7.5"></feGaussianBlur>
        </filter>
        <filter id="${id}-glow-orbit" x="-24%" y="-36%" width="148%" height="172%">
          <feGaussianBlur stdDeviation="5.5"></feGaussianBlur>
        </filter>
      </defs>

      <g class="oc-chat-ambient__wash">
        <ellipse cx="1180" cy="510" rx="330" ry="188" fill="var(--oc-chat-haze-a)"></ellipse>
        <ellipse cx="360" cy="738" rx="270" ry="154" fill="var(--oc-chat-haze-b)"></ellipse>
      </g>

      <g class="oc-chat-ambient__bands oc-chat-ambient__bands--back">
        <path
          class="oc-chat-ambient__band oc-chat-ambient__band--primary"
          d="M-140 742C112 578 322 540 548 602C768 662 896 786 1086 744C1278 700 1398 506 1598 474C1720 454 1826 490 1928 560"
          stroke="url(#${id}-band-a)"
          stroke-width="84"
          filter="url(#${id}-glow-wide)"
        ></path>
        <path
          class="oc-chat-ambient__band oc-chat-ambient__band--secondary"
          d="M-170 828C64 646 282 622 492 684C684 740 840 838 1028 772C1218 704 1350 522 1528 534C1678 544 1804 646 1914 728"
          stroke="url(#${id}-band-b)"
          stroke-width="58"
          filter="url(#${id}-glow-wide)"
        ></path>
        <path
          class="oc-chat-ambient__band oc-chat-ambient__band--accent"
          d="M92 690C256 602 430 590 586 636C730 676 882 684 1044 606C1208 526 1380 494 1560 520"
          stroke="url(#${id}-band-c)"
          stroke-width="30"
          filter="url(#${id}-glow-soft)"
        ></path>
      </g>

      <g class="oc-chat-ambient__bands oc-chat-ambient__bands--front">
        <path
          class="oc-chat-ambient__thread oc-chat-ambient__thread--cool"
          d="M-102 754C132 568 352 520 556 584C754 646 896 766 1088 726C1288 684 1406 478 1602 456C1730 444 1826 480 1920 552"
          stroke="url(#${id}-trace)"
          filter="url(#${id}-glow-trace)"
        ></path>
        <path
          class="oc-chat-ambient__thread oc-chat-ambient__thread--warm"
          d="M-114 816C122 640 336 614 530 674C720 736 858 832 1038 768C1220 704 1352 534 1544 548C1686 560 1800 642 1904 710"
          stroke="url(#${id}-trace-warm)"
          filter="url(#${id}-glow-trace)"
        ></path>
        <path
          class="oc-chat-ambient__thread oc-chat-ambient__thread--dash"
          d="M164 708C334 612 500 602 652 644C788 682 940 688 1094 624C1248 560 1404 518 1560 544"
          stroke="url(#${id}-trace)"
          filter="url(#${id}-glow-trace)"
        ></path>
      </g>

      <g class="oc-chat-ambient__orbits">
        <path
          class="oc-chat-ambient__orbit"
          d="M-60 626C178 500 388 490 592 548C784 600 954 562 1136 420C1292 300 1450 252 1632 300"
          filter="url(#${id}-glow-orbit)"
        ></path>

        <path
          class="oc-chat-ambient__orbit oc-chat-ambient__orbit--low"
          d="M44 760C224 664 402 656 556 688C710 720 856 748 1036 706C1204 666 1344 568 1490 580"
          filter="url(#${id}-glow-orbit)"
        ></path>
      </g>
    </svg>
  `;
}

function createAmbientHost() {
  const host = document.createElement("div");
  host.className = HOST_CLASS;
  host.setAttribute("aria-hidden", "true");

  const id = `oc-chat-ambient-${(ambientIdCounter += 1)}`;
  host.innerHTML = createAmbientSvgMarkup(id);
  return host;
}

function findDirectAmbientHost(surface) {
  return (
    Array.from(surface.children).find((child) => child.classList?.contains(HOST_CLASS)) || null
  );
}

function isChatObserverRelevantElement(element) {
  return element instanceof Element && element.matches(CHAT_OBSERVER_RELEVANT_SELECTOR);
}

function subtreeContainsChatObserverRelevantElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  return Boolean(element.querySelector(CHAT_OBSERVER_RELEVANT_SELECTOR));
}

function mutationTouchesChatStructure(mutations) {
  for (const mutation of mutations) {
    const target = mutation.target instanceof Element ? mutation.target : null;
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === MEMBER_CHAT_ROUTE_ATTR &&
      target instanceof HTMLElement
    ) {
      return true;
    }
    if (
      isChatObserverRelevantElement(target) ||
      isChatObserverRelevantElement(target?.parentElement)
    ) {
      return true;
    }
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (
        isChatObserverRelevantElement(node) ||
        subtreeContainsChatObserverRelevantElement(node) ||
        isChatObserverRelevantElement(node.parentElement)
      ) {
        return true;
      }
    }
    for (const node of mutation.removedNodes) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (isChatObserverRelevantElement(node) || subtreeContainsChatObserverRelevantElement(node)) {
        return true;
      }
    }
  }
  return false;
}

function isMemberChatRouteActive() {
  return (
    document.documentElement?.getAttribute(MEMBER_CHAT_ROUTE_ATTR) === "true" ||
    document.body?.getAttribute(MEMBER_CHAT_ROUTE_ATTR) === "true"
  );
}

function surfaceHasChatSignals(surface) {
  if (!(surface instanceof HTMLElement)) {
    return false;
  }
  if (surface.matches(".content--chat, [data-oc-chat-surface]")) {
    return true;
  }
  return Boolean(
    surface.querySelector(
      "textarea, .chat-group, .chat-bubble, .chat-message, [data-oc-chat-group], [data-oc-chat-bubble]",
    ),
  );
}

function surfaceAllowsAmbient(surface) {
  return surfaceHasChatSignals(surface) && !isMemberChatRouteActive();
}

function ensureAmbientHost(surface) {
  if (!surface || !surface.isConnected) {
    return;
  }
  if (!surfaceAllowsAmbient(surface)) {
    return;
  }
  if (findDirectAmbientHost(surface)) {
    return;
  }

  surface.insertBefore(createAmbientHost(), surface.firstChild);
}

function pruneOrphanHosts() {
  for (const host of document.querySelectorAll(`.${HOST_CLASS}`)) {
    if (
      !surfaceAllowsAmbient(host.parentElement) ||
      findChatSurface(host.parentElement || undefined) !== host.parentElement
    ) {
      host.remove();
    }
  }
}

function enqueueSyncRoot(pendingRoots, root) {
  if (root instanceof Document) {
    pendingRoots.clear();
    pendingRoots.add(document);
    return;
  }

  if (!(root instanceof Element)) {
    pendingRoots.add(document);
    return;
  }

  if (pendingRoots.has(document)) {
    return;
  }

  for (const existing of pendingRoots) {
    if (!(existing instanceof Element)) {
      continue;
    }
    if (existing.contains(root)) {
      return;
    }
    if (root.contains(existing)) {
      pendingRoots.delete(existing);
    }
  }

  pendingRoots.add(root);
}

export function bootChatAmbientBackground() {
  let frame = 0;
  const pendingRoots = new Set([document]);

  const sync = () => {
    frame = 0;
    pruneOrphanHosts();

    const surfaces = new Set();
    const rootSurface = findChatSurface(document);
    if (surfaceAllowsAmbient(rootSurface)) {
      surfaces.add(rootSurface);
    }

    for (const root of pendingRoots) {
      const surface = findChatSurface(root);
      if (surfaceAllowsAmbient(surface)) {
        surfaces.add(surface);
      }
    }
    pendingRoots.clear();

    for (const surface of surfaces) {
      ensureAmbientHost(surface);
    }
  };

  const schedule = (root = document) => {
    enqueueSyncRoot(pendingRoots, root);
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(sync);
  };

  sync();

  const observer = new MutationObserver((mutations) => {
    if (!mutationTouchesChatStructure(mutations)) {
      return;
    }
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        schedule(mutation.target);
      }
      if (mutation.target instanceof Element) {
        schedule(mutation.target);
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          schedule(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [MEMBER_CHAT_ROUTE_ATTR],
  });

  window.addEventListener("pageshow", () => schedule(document));
}

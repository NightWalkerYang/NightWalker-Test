const CHAT_ROOT_SELECTOR = ".content--chat";
const HOST_CLASS = "oc-chat-ambient";

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
        <circle class="oc-chat-ambient__node oc-chat-ambient__node--lg" cx="478" cy="546" r="4.6"></circle>
        <circle class="oc-chat-ambient__node" cx="794" cy="516" r="3.6"></circle>
        <circle class="oc-chat-ambient__node" cx="1116" cy="422" r="4"></circle>
        <circle class="oc-chat-ambient__node" cx="1450" cy="252" r="4.2"></circle>

        <path
          class="oc-chat-ambient__orbit oc-chat-ambient__orbit--low"
          d="M44 760C224 664 402 656 556 688C710 720 856 748 1036 706C1204 666 1344 568 1490 580"
          filter="url(#${id}-glow-orbit)"
        ></path>
        <circle class="oc-chat-ambient__node oc-chat-ambient__node--soft" cx="356" cy="668" r="3.8"></circle>
        <circle class="oc-chat-ambient__node oc-chat-ambient__node--soft" cx="906" cy="730" r="4.4"></circle>
        <circle class="oc-chat-ambient__node oc-chat-ambient__node--soft" cx="1322" cy="582" r="4.2"></circle>
      </g>

      <g class="oc-chat-ambient__trendline">
        <polyline
          class="oc-chat-ambient__trend"
          points="662,726 704,690 736,692 764,650 790,656 816,624 846,630 872,586 900,596 928,560 954,570 980,534 1010,548 1038,506 1068,522 1094,488 1128,504 1160,470 1192,478 1224,450 1260,458 1292,426 1328,438 1362,402 1394,414 1426,392 1458,406 1490,374 1520,388"
          filter="url(#${id}-glow-orbit)"
        ></polyline>
        <circle class="oc-chat-ambient__spark oc-chat-ambient__spark--bright" cx="790" cy="656" r="1.8"></circle>
        <circle class="oc-chat-ambient__spark oc-chat-ambient__spark--bright" cx="980" cy="534" r="2"></circle>
        <circle class="oc-chat-ambient__spark oc-chat-ambient__spark--bright" cx="1224" cy="450" r="1.8"></circle>
        <circle class="oc-chat-ambient__spark oc-chat-ambient__spark--bright" cx="1490" cy="374" r="2.2"></circle>
      </g>

      <g class="oc-chat-ambient__particles">
        <circle class="oc-chat-ambient__spark" cx="108" cy="370" r="2.2"></circle>
        <circle class="oc-chat-ambient__spark" cx="202" cy="622" r="2.8"></circle>
        <circle class="oc-chat-ambient__spark" cx="322" cy="340" r="1.8"></circle>
        <circle class="oc-chat-ambient__spark" cx="530" cy="792" r="2"></circle>
        <circle class="oc-chat-ambient__spark" cx="726" cy="494" r="1.7"></circle>
        <circle class="oc-chat-ambient__spark" cx="958" cy="332" r="2"></circle>
        <circle class="oc-chat-ambient__spark" cx="1178" cy="704" r="2.2"></circle>
        <circle class="oc-chat-ambient__spark" cx="1414" cy="324" r="1.8"></circle>
        <circle class="oc-chat-ambient__spark" cx="1548" cy="514" r="1.6"></circle>
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
  return Array.from(surface.children).find((child) => child.classList?.contains(HOST_CLASS)) || null;
}

function ensureAmbientHost(surface) {
  if (!surface || !surface.isConnected) {
    return;
  }
  if (findDirectAmbientHost(surface)) {
    return;
  }

  surface.insertBefore(createAmbientHost(), surface.firstChild);
}

function pruneOrphanHosts() {
  for (const host of document.querySelectorAll(`.${HOST_CLASS}`)) {
    if (!host.parentElement?.matches?.(CHAT_ROOT_SELECTOR)) {
      host.remove();
    }
  }
}

export function bootChatAmbientBackground() {
  let frame = 0;

  const sync = () => {
    frame = 0;
    pruneOrphanHosts();

    for (const surface of document.querySelectorAll(CHAT_ROOT_SELECTOR)) {
      ensureAmbientHost(surface);
    }
  };

  const schedule = () => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(sync);
  };

  sync();

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("pageshow", schedule);
}

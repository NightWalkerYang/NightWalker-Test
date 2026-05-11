const COMPOSER_TOKENS = ["composer", "input", "message", "chat", "prompt", "输入", "消息", "会话"];

const SEND_TOKENS = ["send", "发送", "提交", "ask", "提问"];
const STOP_TOKENS = ["stop", "停止", "abort", "cancel", "中止", "终止", "recording"];
const NEW_SESSION_TOKENS = [
  "new session",
  "new chat",
  "new conversation",
  "start over",
  "新建会话",
  "新会话",
  "新建聊天",
  "新对话",
];
const VOICE_TOKENS = [
  "voice",
  "microphone",
  "mic",
  "record",
  "dictation",
  "语音",
  "麦克风",
  "听写",
];
const BREADCRUMB_TOKENS = ["breadcrumb", "面包屑", "路径"];
const SIDEBAR_TOKENS = ["sidebar", "sidenav", "navigation", "导航"];
const TOOLBAR_TOKENS = ["toolbar", "工具栏", "actions", "操作栏"];
const CHAT_SURFACE_TOKENS = ["chat", "conversation", "消息", "聊天", "会话"];
const APP_TOKENS = ["openclaw", "gateway", "control ui"];
const TOPBAR_SEARCH_TOKENS = ["search", "搜索", "find", "查找"];
const UTILITY_TOKENS = ["utility", "快捷", "帮助", "docs", "文档", "version", "版本"];
const CONTENT_TOKENS = ["content", "workspace", "surface", "main", "内容", "页面"];
const SESSION_TOKENS = ["session", "conversation", "thread", "会话", "聊天"];
const MODEL_TOKENS = ["model", "provider", "模型", "引擎"];
const FOOTER_TOKENS = ["footer", "docs", "version", "底部", "文档", "版本"];

const BUTTON_LIKE_SELECTOR =
  "button, [role='button'], a, summary, [type='button'], [type='submit']";
const TEXTAREA_SELECTOR = "textarea";
const OPENCLAW_APP_SELECTOR = "openclaw-app";

const COMPOSER_ROOT_HINT_SELECTORS = [
  ".agent-chat__input",
  "[data-testid*='composer' i]",
  "[data-testid*='chat-input' i]",
  "[class*='composer']",
  "[class*='chat-input']",
  "[class*='chat__input']",
  "form",
];

const TOOLBAR_HINT_SELECTORS = [
  ".agent-chat__toolbar",
  "[role='toolbar']",
  "[class*='toolbar']",
  "[class*='actions']",
];

const SIDEBAR_HINT_SELECTORS = [
  ".sidebar-nav",
  ".sidebar-shell",
  "aside",
  "nav[role='navigation']",
  "nav",
];

const BREADCRUMB_HINT_SELECTORS = [
  ".dashboard-header__breadcrumb",
  "nav[aria-label*='breadcrumb' i]",
  "[class*='breadcrumb']",
];

const CHAT_SURFACE_HINT_SELECTORS = [
  ".content--chat",
  "[data-testid*='chat-content' i]",
  "[data-testid*='conversation' i]",
  "[class*='content--chat']",
  "[class*='chat-content']",
  "[class*='conversation']",
  "main",
];

const APP_HINT_SELECTORS = [
  OPENCLAW_APP_SELECTOR,
  "[data-openclaw-app]",
  "[data-testid*='openclaw-app' i]",
  "[class*='openclaw-app']",
];

const TOPBAR_SEARCH_HINT_SELECTORS = [
  ".topbar-search",
  "[role='search']",
  "[class*='topbar-search']",
  "[class*='header-search']",
];

const TOPBAR_SEARCH_SIGNAL_SELECTORS = [
  "input[type='search']",
  "[aria-label*='search' i]",
  "[aria-label*='搜索' i]",
  "[title*='search' i]",
  "[title*='搜索' i]",
  "[placeholder*='search' i]",
  "[placeholder*='搜索' i]",
  "[data-testid*='search' i]",
  "[class*='search']",
];

const SIDEBAR_UTILITY_HINT_SELECTORS = [
  ".sidebar-utility-group",
  ".sidebar-shell__footer",
  "[class*='utility-group']",
  "[class*='sidebar-utility']",
];

const CONTENT_MOUNT_HINT_SELECTORS = [
  ".content",
  "main.content",
  "main[class*='content']",
  "main[class*='workspace']",
  "[data-testid*='content' i]",
  "[class*='workspace-content']",
  "[class*='content']",
  "main",
];

const CHAT_SESSION_PICKER_HINT_SELECTORS = [
  ".chat-controls__session:not(.chat-controls__model)",
  ".chat-mobile-controls-wrapper .chat-controls__session",
  "[data-testid*='session' i]",
  "[class*='chat-controls__session']",
  "label",
  "section",
  "div",
];

const CHAT_MODEL_PICKER_HINT_SELECTORS = [
  "select[data-chat-model-select='true']",
  "select[name*='model' i]",
  "select[aria-label*='model' i]",
  "select[title*='model' i]",
  "select",
];

const SIDEBAR_FOOTER_HINT_SELECTORS = [
  ".sidebar-shell__footer",
  "footer",
  "[class*='sidebar-shell__footer']",
  "[class*='footer']",
  "[class*='utility-group']",
];

const BRAND_TITLE_HINT_SELECTORS = [
  ".sidebar-brand__title",
  ".login-gate__title",
  ".dashboard-header__breadcrumb-link",
  "[class*='brand__title']",
  "[class*='login-gate__title']",
  "[data-testid*='brand-title' i]",
];

const BRAND_LOGO_HINT_SELECTORS = [
  ".sidebar-brand__logo",
  ".login-gate__logo",
  ".agent-chat__avatar--logo",
  ".chat-avatar--logo",
  ".agent-chat__badge img",
  "[class*='brand__logo']",
  "[class*='avatar--logo']",
  "[data-testid*='brand-logo' i]",
];

const DOM_COMPAT_MARKER_ATTR = "data-oc-dom-compat-marker";
const CHAT_SURFACE_MARKER_ATTR = "data-oc-chat-surface";
const CHAT_COMPOSER_MARKER_ATTR = "data-oc-chat-composer";
const CHAT_TEXTAREA_MARKER_ATTR = "data-oc-chat-textarea";
const CHAT_TOOLBAR_MARKER_ATTR = "data-oc-chat-toolbar";
const CHAT_ACTION_BUTTON_MARKER_ATTR = "data-oc-chat-action-button";
const CHAT_SEND_BUTTON_MARKER_ATTR = "data-oc-chat-send-button";
const CHAT_STOP_BUTTON_MARKER_ATTR = "data-oc-chat-stop-button";
const CHAT_NEW_SESSION_BUTTON_MARKER_ATTR = "data-oc-chat-new-session-button";
const CHAT_VOICE_BUTTON_MARKER_ATTR = "data-oc-chat-voice-button";
const SIDEBAR_MARKER_ATTR = "data-oc-sidebar";
const NAV_SECTION_MARKER_ATTR = "data-oc-nav-section";
const BREADCRUMB_MARKER_ATTR = "data-oc-breadcrumb";
const TOPBAR_SEARCH_MARKER_ATTR = "data-oc-topbar-search";
const SIDEBAR_UTILITY_MARKER_ATTR = "data-oc-sidebar-utility";
const SIDEBAR_FOOTER_MARKER_ATTR = "data-oc-sidebar-footer";
const CONTENT_ROOT_MARKER_ATTR = "data-oc-content-mount-root";
const APP_ROOT_MARKER_ATTR = "data-oc-openclaw-app";
const SESSION_PICKER_MARKER_ATTR = "data-oc-chat-session-picker";
const MODEL_PICKER_MARKER_ATTR = "data-oc-chat-model-picker";
const BRAND_TITLE_MARKER_ATTR = "data-oc-brand-title-slot";
const BRAND_LOGO_MARKER_ATTR = "data-oc-brand-logo-slot";
const CHAT_GROUP_MARKER_ATTR = "data-oc-chat-group";
const CHAT_GROUP_ROLE_MARKER_ATTR = "data-oc-chat-group-role";
const CHAT_BUBBLE_MARKER_ATTR = "data-oc-chat-bubble";
const CHAT_AVATAR_MARKER_ATTR = "data-oc-chat-avatar";
const CHAT_AVATAR_ROLE_MARKER_ATTR = "data-oc-chat-avatar-role";
const CHAT_GROUP_MESSAGES_MARKER_ATTR = "data-oc-chat-group-messages";
const CHAT_GROUP_FOOTER_MARKER_ATTR = "data-oc-chat-group-footer";
const CHAT_TEXT_MARKER_ATTR = "data-oc-chat-text";
const CHAT_TOOLS_SUMMARY_MARKER_ATTR = "data-oc-chat-tools-summary";
const CHAT_TOOL_MESSAGE_SUMMARY_MARKER_ATTR = "data-oc-chat-tool-msg-summary";
const CHAT_WELCOME_MARKER_ATTR = "data-oc-chat-welcome";
const CHAT_WELCOME_AVATAR_MARKER_ATTR = "data-oc-chat-welcome-avatar";
const FRAMEWORK_DOM_MARKER_ATTRS = [
  DOM_COMPAT_MARKER_ATTR,
  CHAT_SURFACE_MARKER_ATTR,
  CHAT_COMPOSER_MARKER_ATTR,
  CHAT_TEXTAREA_MARKER_ATTR,
  CHAT_TOOLBAR_MARKER_ATTR,
  CHAT_ACTION_BUTTON_MARKER_ATTR,
  CHAT_SEND_BUTTON_MARKER_ATTR,
  CHAT_STOP_BUTTON_MARKER_ATTR,
  CHAT_NEW_SESSION_BUTTON_MARKER_ATTR,
  CHAT_VOICE_BUTTON_MARKER_ATTR,
  SIDEBAR_MARKER_ATTR,
  NAV_SECTION_MARKER_ATTR,
  BREADCRUMB_MARKER_ATTR,
  TOPBAR_SEARCH_MARKER_ATTR,
  SIDEBAR_UTILITY_MARKER_ATTR,
  SIDEBAR_FOOTER_MARKER_ATTR,
  CONTENT_ROOT_MARKER_ATTR,
  APP_ROOT_MARKER_ATTR,
  SESSION_PICKER_MARKER_ATTR,
  MODEL_PICKER_MARKER_ATTR,
  BRAND_TITLE_MARKER_ATTR,
  BRAND_LOGO_MARKER_ATTR,
  CHAT_GROUP_MARKER_ATTR,
  CHAT_GROUP_ROLE_MARKER_ATTR,
  CHAT_BUBBLE_MARKER_ATTR,
  CHAT_AVATAR_MARKER_ATTR,
  CHAT_AVATAR_ROLE_MARKER_ATTR,
  CHAT_GROUP_MESSAGES_MARKER_ATTR,
  CHAT_GROUP_FOOTER_MARKER_ATTR,
  CHAT_TEXT_MARKER_ATTR,
  CHAT_TOOLS_SUMMARY_MARKER_ATTR,
  CHAT_TOOL_MESSAGE_SUMMARY_MARKER_ATTR,
  CHAT_WELCOME_MARKER_ATTR,
  CHAT_WELCOME_AVATAR_MARKER_ATTR,
];

function asElement(value) {
  return value instanceof Element ? value : null;
}

function normalizeSignalText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function classNameText(element) {
  if (!element) {
    return "";
  }
  if (typeof element.className === "string") {
    return element.className;
  }
  if (element.classList?.length) {
    return Array.from(element.classList).join(" ");
  }
  return "";
}

function elementSignalText(element) {
  if (!(element instanceof Element)) {
    return "";
  }

  const fields = [
    element.getAttribute("title"),
    element.getAttribute("aria-label"),
    element.getAttribute("aria-labelledby"),
    element.getAttribute("data-testid"),
    element.getAttribute("data-test"),
    element.getAttribute("data-action"),
    element.getAttribute("data-oc-action"),
    element.getAttribute("name"),
    element.getAttribute("id"),
    classNameText(element),
    element.textContent,
  ];

  return normalizeSignalText(fields.filter(Boolean).join(" "));
}

function hasAnyToken(text, tokens) {
  if (!text) {
    return false;
  }
  return tokens.some((token) => text.includes(token));
}

function scoreByTokens(text, tokens, weight) {
  if (!text) {
    return 0;
  }
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) {
      score += weight;
    }
  }
  return score;
}

function isHidden(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.hidden) {
    return true;
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return true;
  }
  const inlineDisplay = normalizeSignalText(element.style?.display);
  const inlineVisibility = normalizeSignalText(element.style?.visibility);
  return inlineDisplay === "none" || inlineVisibility === "hidden";
}

function toSearchRoot(root) {
  if (root instanceof Document || root instanceof Element) {
    return root;
  }
  return document;
}

function queryAll(root, selector) {
  const base = toSearchRoot(root);
  const results = [];
  if (base instanceof Element && base.matches(selector)) {
    results.push(base);
  }
  results.push(...base.querySelectorAll(selector));
  return results;
}

function queryAllBySelectors(root, selectors) {
  const dedup = new Set();
  for (const selector of selectors) {
    for (const element of queryAll(root, selector)) {
      dedup.add(element);
    }
  }
  return Array.from(dedup);
}

function matchesAnySelector(element, selectors) {
  if (!(element instanceof Element)) {
    return false;
  }
  return selectors.some((selector) => element.matches(selector));
}

function collectButtonLikes(scope) {
  if (!(scope instanceof Element || scope instanceof Document)) {
    return [];
  }
  return Array.from(scope.querySelectorAll(BUTTON_LIKE_SELECTOR)).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
}

function scoreComposerRoot(candidate) {
  if (!(candidate instanceof HTMLElement) || isHidden(candidate)) {
    return -1000;
  }
  const textareas = candidate.querySelectorAll(TEXTAREA_SELECTOR);
  if (textareas.length === 0) {
    return -1000;
  }

  const signal = elementSignalText(candidate);
  const buttons = collectButtonLikes(candidate);

  let score = 120;
  score += Math.min(3, textareas.length) * 30;
  score += Math.min(6, buttons.length) * 10;
  score += scoreByTokens(signal, COMPOSER_TOKENS, 24);
  score += scoreByTokens(signal, TOOLBAR_TOKENS, 10);

  if (candidate.matches(".agent-chat__input")) {
    score += 260;
  }
  if (candidate.matches("form")) {
    score += 24;
  }

  if (buttons.some((button) => isSendButtonElement(button))) {
    score += 48;
  }
  if (buttons.some((button) => isVoiceButtonElement(button))) {
    score += 30;
  }
  if (buttons.some((button) => isNewSessionButtonElement(button))) {
    score += 24;
  }

  return score;
}

function collectComposerRootCandidates(root) {
  const searchRoot = toSearchRoot(root);
  const candidates = new Set();

  for (const textarea of queryAll(searchRoot, TEXTAREA_SELECTOR)) {
    let current = textarea.parentElement;
    let depth = 0;
    while (current && depth < 7) {
      candidates.add(current);
      current = current.parentElement;
      depth += 1;
    }
  }

  for (const hinted of queryAllBySelectors(searchRoot, COMPOSER_ROOT_HINT_SELECTORS)) {
    if (hinted instanceof HTMLElement) {
      candidates.add(hinted);
    }
  }

  return Array.from(candidates);
}

function pickBest(candidates, scorer) {
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scorer(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore > Number.NEGATIVE_INFINITY ? best : null;
}

function ancestorMatch(target, predicate) {
  let current = asElement(target);
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function scoreTextarea(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement) || isHidden(textarea)) {
    return -1000;
  }

  const signal = normalizeSignalText(
    [
      textarea.getAttribute("aria-label"),
      textarea.getAttribute("placeholder"),
      textarea.getAttribute("name"),
    ]
      .filter(Boolean)
      .join(" "),
  );

  let score = 100;
  score += scoreByTokens(signal, COMPOSER_TOKENS, 26);
  if (textarea.closest(".agent-chat__input")) {
    score += 220;
  }

  const container = textarea.closest("form, section, article, div");
  if (container instanceof Element) {
    const containerSignal = elementSignalText(container);
    score += scoreByTokens(containerSignal, COMPOSER_TOKENS, 14);

    const nearbyButtons = collectButtonLikes(container);
    if (nearbyButtons.some((button) => isSendButtonElement(button))) {
      score += 45;
    }
    if (nearbyButtons.some((button) => isVoiceButtonElement(button))) {
      score += 20;
    }
  }

  return score;
}

function scoreToolbar(toolbar) {
  if (!(toolbar instanceof HTMLElement) || isHidden(toolbar)) {
    return -1000;
  }

  const signal = elementSignalText(toolbar);
  const buttons = collectButtonLikes(toolbar);
  if (buttons.length === 0) {
    return -1000;
  }

  let score = 80 + Math.min(10, buttons.length) * 8;
  score += scoreByTokens(signal, TOOLBAR_TOKENS, 24);
  if (toolbar.matches(".agent-chat__toolbar")) {
    score += 220;
  }
  if (buttons.some((button) => isSendButtonElement(button))) {
    score += 36;
  }
  if (buttons.some((button) => isVoiceButtonElement(button))) {
    score += 24;
  }
  if (buttons.some((button) => isNewSessionButtonElement(button))) {
    score += 24;
  }
  return score;
}

function scoreSidebar(sidebar) {
  if (!(sidebar instanceof HTMLElement) || isHidden(sidebar)) {
    return -1000;
  }
  const signal = elementSignalText(sidebar);
  const items = sidebar.querySelectorAll(".nav-item, [role='link'], [role='menuitem'], a, button");
  let score = Math.min(12, items.length) * 12;
  score += scoreByTokens(signal, SIDEBAR_TOKENS, 28);
  if (sidebar.matches(".sidebar-nav, .sidebar-shell, aside")) {
    score += 80;
  }
  if (items.length === 0) {
    score -= 60;
  }
  return score;
}

function scoreBreadcrumb(breadcrumb) {
  if (!(breadcrumb instanceof HTMLElement) || isHidden(breadcrumb)) {
    return -1000;
  }
  const signal = elementSignalText(breadcrumb);
  const links = breadcrumb.querySelectorAll("a, button, [role='link']");
  let score = 40 + Math.min(6, links.length) * 10;
  score += scoreByTokens(signal, BREADCRUMB_TOKENS, 34);
  if (breadcrumb.matches(".dashboard-header__breadcrumb")) {
    score += 100;
  }
  if (breadcrumb.matches("nav")) {
    score += 24;
  }
  return score;
}

function scoreChatSurface(surface) {
  if (!(surface instanceof HTMLElement) || isHidden(surface)) {
    return -1000;
  }

  const signal = elementSignalText(surface);
  const composer = surface.querySelector(TEXTAREA_SELECTOR);
  const chatGroups = surface.querySelectorAll(".chat-group, .chat-bubble, .chat-message");

  let score = 30;
  score += scoreByTokens(signal, CHAT_SURFACE_TOKENS, 20);
  score += Math.min(6, chatGroups.length) * 12;
  if (composer) {
    score += 80;
  }
  if (surface.matches(".content--chat")) {
    score += 220;
  }
  return score;
}

function scoreAppRoot(candidate) {
  if (!(candidate instanceof HTMLElement) || isHidden(candidate)) {
    return -1000;
  }

  const signal = elementSignalText(candidate);
  let score = 0;
  if (candidate.matches(OPENCLAW_APP_SELECTOR)) {
    score += 320;
  }
  score += scoreByTokens(signal, APP_TOKENS, 18);
  if ("client" in candidate) {
    score += 36;
  }
  if ("sessionKey" in candidate) {
    score += 24;
  }
  return score;
}

function scoreTopbarSearch(candidate) {
  if (!(candidate instanceof HTMLElement) || isHidden(candidate)) {
    return -1000;
  }
  const signal = elementSignalText(candidate);
  const sidebarAncestor = ancestorMatch(
    candidate.parentElement,
    (node) =>
      matchesAnySelector(node, SIDEBAR_HINT_SELECTORS) ||
      matchesAnySelector(node, SIDEBAR_UTILITY_HINT_SELECTORS),
  );
  let score = 20;
  score += scoreByTokens(signal, TOPBAR_SEARCH_TOKENS, 26);
  if (candidate.matches("button, [role='button'], input, [type='search']")) {
    score += 12;
  }
  if (candidate.matches("input[type='search'], [type='search']")) {
    score += 80;
  }
  if (candidate.matches(".topbar-search, [role='search']")) {
    score += 220;
  }
  if (candidate.matches("[class*='header-search'], [class*='topbar-search']")) {
    score += 90;
  }
  if (candidate.closest("header, [class*='topbar'], [class*='header']")) {
    score += 24;
  }
  if (
    candidate.closest(
      ".sidebar-nav, .sidebar-shell, .sidebar-utility-group, .sidebar-shell__footer",
    )
  ) {
    score -= 180;
  }
  if (sidebarAncestor) {
    score -= 220;
  }
  return score;
}

function collectTopbarSearchCandidates(root) {
  const searchRoot = toSearchRoot(root);
  const candidates = new Set();

  for (const hinted of queryAllBySelectors(searchRoot, TOPBAR_SEARCH_HINT_SELECTORS)) {
    if (hinted instanceof HTMLElement) {
      candidates.add(hinted);
    }
  }

  for (const hinted of queryAllBySelectors(searchRoot, TOPBAR_SEARCH_SIGNAL_SELECTORS)) {
    if (hinted instanceof HTMLElement) {
      candidates.add(hinted);
    }
  }

  return Array.from(candidates);
}

function scoreSidebarUtility(candidate) {
  if (!(candidate instanceof HTMLElement) || isHidden(candidate)) {
    return -1000;
  }
  const signal = elementSignalText(candidate);
  const items = candidate.querySelectorAll("a, button, [role='link'], [role='menuitem']");
  let score = Math.min(10, items.length) * 10;
  score += scoreByTokens(signal, UTILITY_TOKENS, 18);
  if (candidate.matches(".sidebar-utility-group, .sidebar-shell__footer")) {
    score += 140;
  }
  return score;
}

function scoreContentMountRoot(candidate) {
  if (!(candidate instanceof HTMLElement) || isHidden(candidate)) {
    return -1000;
  }
  if (candidate.closest("aside, nav, footer, dialog")) {
    return -1000;
  }
  const signal = elementSignalText(candidate);
  let score = 0;
  if (candidate.matches(".content")) {
    score += 280;
  }
  if (candidate.tagName.toLowerCase() === "main") {
    score += 100;
  }
  score += scoreByTokens(signal, CONTENT_TOKENS, 24);
  if (candidate.querySelector(".chat-thread, textarea, [data-tenant-section-body]")) {
    score += 24;
  }
  if (candidate.querySelector("[data-platform-section-body], [data-member-open-chat]")) {
    score += 24;
  }
  if (candidate.querySelector(".nav-section, .nav-item")) {
    score -= 120;
  }
  return score;
}

function normalizeControlContainer(candidate) {
  if (!(candidate instanceof HTMLElement)) {
    return null;
  }
  const container =
    candidate.closest(".chat-controls__session, label, section, div") ?? candidate.parentElement;
  return container instanceof HTMLElement ? container : candidate;
}

function scoreChatSessionPicker(candidate) {
  const container = normalizeControlContainer(candidate);
  if (!(container instanceof HTMLElement) || isHidden(container)) {
    return -1000;
  }
  const signal = elementSignalText(container);
  const select = container.querySelector("select");
  let score = select instanceof HTMLSelectElement ? 60 : 0;
  score += scoreByTokens(signal, SESSION_TOKENS, 42);
  score -= scoreByTokens(signal, MODEL_TOKENS, 96);
  if (container.matches(".chat-controls__session")) {
    score += 220;
  }
  if (container.matches(".chat-controls__model") || container.className.includes("model")) {
    score -= 260;
  }
  if (container.querySelector("select[data-chat-model-select='true']")) {
    score -= 320;
  }
  return score;
}

function scoreChatModelPicker(candidate) {
  if (!(candidate instanceof HTMLSelectElement) || isHidden(candidate)) {
    return -1000;
  }
  const signal = `${elementSignalText(candidate)} ${elementSignalText(candidate.parentElement)}`;
  let score = 40;
  score += scoreByTokens(signal, MODEL_TOKENS, 48);
  score -= scoreByTokens(signal, SESSION_TOKENS, 22);
  if (candidate.matches("select[data-chat-model-select='true']")) {
    score += 240;
  }
  if (candidate.parentElement?.matches(".chat-controls__model")) {
    score += 160;
  }
  return score;
}

function scoreSidebarFooter(candidate) {
  if (!(candidate instanceof HTMLElement) || isHidden(candidate)) {
    return -1000;
  }
  const signal = elementSignalText(candidate);
  let score = scoreByTokens(signal, FOOTER_TOKENS, 24);
  score += scoreByTokens(signal, UTILITY_TOKENS, 18);
  if (candidate.matches(".sidebar-shell__footer")) {
    score += 220;
  }
  if (candidate.tagName.toLowerCase() === "footer") {
    score += 60;
  }
  if (findSidebar(candidate.parentElement ?? document)) {
    score += 12;
  }
  return score;
}

function scoreSendButton(button, context = {}) {
  if (!(button instanceof HTMLElement) || isHidden(button)) {
    return -1000;
  }

  const signal = elementSignalText(button);
  let score = 0;
  if (button.matches(".chat-send-btn")) {
    score += 220;
  }
  score += scoreByTokens(signal, SEND_TOKENS, 64);
  score -= scoreByTokens(signal, STOP_TOKENS, 120);
  score -= scoreByTokens(signal, VOICE_TOKENS, 40);
  score -= scoreByTokens(signal, NEW_SESSION_TOKENS, 50);

  if (normalizeSignalText(button.getAttribute("type")) === "submit") {
    score += 36;
  }
  if (button.classList.contains("chat-send-btn--stop")) {
    score -= 320;
  }

  const parentSignal = button.parentElement ? elementSignalText(button.parentElement) : "";
  score += scoreByTokens(parentSignal, TOOLBAR_TOKENS, 10);

  if (context.toolbar instanceof Element && context.toolbar.contains(button)) {
    score += 18;
  }
  if (context.composer instanceof Element && context.composer.contains(button)) {
    score += 18;
  }
  return score;
}

function scoreStopButton(button) {
  if (!(button instanceof HTMLElement) || isHidden(button)) {
    return -1000;
  }

  const signal = elementSignalText(button);
  let score = scoreByTokens(signal, STOP_TOKENS, 84);
  score -= scoreByTokens(signal, SEND_TOKENS, 36);
  score -= scoreByTokens(signal, VOICE_TOKENS, 24);
  if (button.classList.contains("chat-send-btn--stop")) {
    score += 220;
  }
  return score;
}

function scoreNewSessionButton(button, context = {}) {
  if (!(button instanceof HTMLElement) || isHidden(button)) {
    return -1000;
  }

  const signal = elementSignalText(button);
  let score = scoreByTokens(signal, NEW_SESSION_TOKENS, 84);
  score += scoreByTokens(signal, ["new"], 8);
  score -= scoreByTokens(signal, SEND_TOKENS, 54);
  score -= scoreByTokens(signal, VOICE_TOKENS, 42);
  if (context.toolbar instanceof Element && context.toolbar.contains(button)) {
    score += 18;
  }
  if (context.composer instanceof Element && context.composer.contains(button)) {
    score += 14;
  }
  return score;
}

function scoreVoiceButton(button, context = {}) {
  if (!(button instanceof HTMLElement) || isHidden(button)) {
    return -1000;
  }

  const signal = elementSignalText(button);
  let score = scoreByTokens(signal, VOICE_TOKENS, 72);
  score += scoreByTokens(signal, ["stop recording", "停止录音", "结束录音"], 54);
  score -= scoreByTokens(signal, NEW_SESSION_TOKENS, 40);
  score -= scoreByTokens(signal, SEND_TOKENS, 20);

  if (button.matches(".agent-chat__input-btn")) {
    score += 42;
  }
  if (context.toolbar instanceof Element && context.toolbar.contains(button)) {
    score += 18;
  }
  if (context.composer instanceof Element && context.composer.contains(button)) {
    score += 18;
  }
  return score;
}

function bestButtonMatch(scope, scorer, context = {}) {
  const buttons = collectButtonLikes(scope);
  return pickBest(buttons, (button) => scorer(button, context));
}

function buttonLikeAncestor(target) {
  let current = asElement(target);
  while (current) {
    if (current.matches(BUTTON_LIKE_SELECTOR)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function dedupeElements(elements) {
  return Array.from(new Set(elements.filter((element) => element instanceof HTMLElement)));
}

function clearFrameworkMarkers(root = document) {
  const searchRoot = toSearchRoot(root);
  for (const attr of FRAMEWORK_DOM_MARKER_ATTRS) {
    for (const element of queryAll(searchRoot, `[${attr}]`)) {
      if (element instanceof HTMLElement) {
        element.removeAttribute(attr);
      }
    }
  }
}

function markElement(element, attr, value = "true") {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  element.setAttribute(attr, value);
  element.setAttribute(DOM_COMPAT_MARKER_ATTR, "true");
}

function markChatStructure(root) {
  const searchRoot = toSearchRoot(root);

  const composer = findChatComposer(searchRoot);
  const app = findOpenClawApp(searchRoot);
  const textarea = findChatComposerTextarea(searchRoot);
  const toolbar = findChatToolbar(searchRoot, { composer });
  const chatSurface = findChatSurface(searchRoot);
  const sendButton = findChatSendButton(searchRoot, { composer, toolbar });
  const stopButton = findChatStopButton(searchRoot, { composer, toolbar });
  const newSessionButton = findChatNewSessionButton(searchRoot, { composer, toolbar });
  const voiceButton = findChatVoiceButton(searchRoot, { composer, toolbar });
  const sidebar = findSidebar(searchRoot);
  const breadcrumb = findBreadcrumb(searchRoot);
  const topbarSearch = findTopbarSearch(searchRoot);
  const sidebarUtility = findSidebarUtilityGroup(searchRoot);
  const sidebarFooter = findSidebarFooter(searchRoot);
  const contentMountRoot = findContentMountRoot(searchRoot);
  const sessionPicker = findChatSessionPicker(searchRoot);
  const modelPicker = findChatModelPicker(searchRoot);

  markElement(chatSurface, CHAT_SURFACE_MARKER_ATTR);
  markElement(composer, CHAT_COMPOSER_MARKER_ATTR);
  markElement(textarea, CHAT_TEXTAREA_MARKER_ATTR);
  markElement(toolbar, CHAT_TOOLBAR_MARKER_ATTR);
  markElement(sendButton, CHAT_SEND_BUTTON_MARKER_ATTR);
  markElement(stopButton, CHAT_STOP_BUTTON_MARKER_ATTR);
  markElement(newSessionButton, CHAT_NEW_SESSION_BUTTON_MARKER_ATTR);
  markElement(voiceButton, CHAT_VOICE_BUTTON_MARKER_ATTR);
  markElement(sidebar, SIDEBAR_MARKER_ATTR);
  markElement(breadcrumb, BREADCRUMB_MARKER_ATTR);
  markElement(topbarSearch, TOPBAR_SEARCH_MARKER_ATTR);
  markElement(sidebarUtility, SIDEBAR_UTILITY_MARKER_ATTR);
  markElement(sidebarFooter, SIDEBAR_FOOTER_MARKER_ATTR);
  markElement(contentMountRoot, CONTENT_ROOT_MARKER_ATTR);
  markElement(app, APP_ROOT_MARKER_ATTR);
  markElement(sessionPicker, SESSION_PICKER_MARKER_ATTR);
  markElement(modelPicker, MODEL_PICKER_MARKER_ATTR);

  for (const element of [sendButton, stopButton, newSessionButton, voiceButton]) {
    markElement(element, CHAT_ACTION_BUTTON_MARKER_ATTR);
  }

  if (sidebar instanceof HTMLElement) {
    for (const section of sidebar.querySelectorAll(":scope > .nav-section")) {
      markElement(section, NAV_SECTION_MARKER_ATTR);
    }
  }

  for (const titleSlot of findBrandTitleSlots(searchRoot)) {
    markElement(titleSlot, BRAND_TITLE_MARKER_ATTR);
  }
  for (const logoSlot of findBrandLogoSlots(searchRoot)) {
    markElement(logoSlot, BRAND_LOGO_MARKER_ATTR, describeBrandLogoSlot(logoSlot) || "true");
  }

  if (chatSurface instanceof HTMLElement) {
    for (const group of chatSurface.querySelectorAll(".chat-group")) {
      markElement(group, CHAT_GROUP_MARKER_ATTR);
      if (group.classList.contains("assistant")) {
        markElement(group, CHAT_GROUP_ROLE_MARKER_ATTR, "assistant");
      } else if (group.classList.contains("user")) {
        markElement(group, CHAT_GROUP_ROLE_MARKER_ATTR, "user");
      } else if (group.classList.contains("tool")) {
        markElement(group, CHAT_GROUP_ROLE_MARKER_ATTR, "tool");
      }
    }
    for (const bubble of chatSurface.querySelectorAll(".chat-bubble")) {
      markElement(bubble, CHAT_BUBBLE_MARKER_ATTR);
    }
    for (const avatar of chatSurface.querySelectorAll(".chat-avatar")) {
      markElement(avatar, CHAT_AVATAR_MARKER_ATTR);
      if (
        avatar.classList.contains("assistant") ||
        avatar.classList.contains("chat-avatar--logo")
      ) {
        markElement(avatar, CHAT_AVATAR_ROLE_MARKER_ATTR, "assistant");
      } else if (avatar.classList.contains("user")) {
        markElement(avatar, CHAT_AVATAR_ROLE_MARKER_ATTR, "user");
      }
    }
    for (const element of chatSurface.querySelectorAll(".chat-group-messages")) {
      markElement(element, CHAT_GROUP_MESSAGES_MARKER_ATTR);
    }
    for (const element of chatSurface.querySelectorAll(".chat-group-footer")) {
      markElement(element, CHAT_GROUP_FOOTER_MARKER_ATTR);
    }
    for (const element of chatSurface.querySelectorAll(".chat-text")) {
      markElement(element, CHAT_TEXT_MARKER_ATTR);
    }
    for (const element of chatSurface.querySelectorAll(".chat-tools-summary")) {
      markElement(element, CHAT_TOOLS_SUMMARY_MARKER_ATTR);
    }
    for (const element of chatSurface.querySelectorAll(".chat-tool-msg-summary")) {
      markElement(element, CHAT_TOOL_MESSAGE_SUMMARY_MARKER_ATTR);
    }
    for (const element of chatSurface.querySelectorAll(".agent-chat__welcome")) {
      markElement(element, CHAT_WELCOME_MARKER_ATTR);
      for (const avatar of element.querySelectorAll(
        "img, .agent-chat__avatar, .agent-chat__avatar--logo",
      )) {
        markElement(avatar, CHAT_WELCOME_AVATAR_MARKER_ATTR);
      }
    }
  }
}

export function syncFrameworkDomMarkers(root = document) {
  clearFrameworkMarkers(root);
  markChatStructure(root);
}

export function observeFrameworkDomMarkers(root = document) {
  const searchRoot = toSearchRoot(root);
  syncFrameworkDomMarkers(searchRoot);
  if (searchRoot instanceof Document) {
    if (searchRoot.defaultView?.__ocFrameworkDomMarkerObserverBooted) {
      return null;
    }
    if (searchRoot.defaultView) {
      searchRoot.defaultView.__ocFrameworkDomMarkerObserverBooted = true;
    }
  }
  const observer = new MutationObserver(() => {
    syncFrameworkDomMarkers(searchRoot);
  });
  observer.observe(searchRoot instanceof Document ? searchRoot.documentElement : searchRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "aria-label", "title", "data-testid", "hidden"],
  });
  return observer;
}

function collectBrandTitleSlots(root) {
  const searchRoot = toSearchRoot(root);
  const slots = queryAllBySelectors(searchRoot, BRAND_TITLE_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  const breadcrumb = findBreadcrumb(searchRoot);
  if (breadcrumb instanceof HTMLElement) {
    const breadcrumbLink =
      breadcrumb.querySelector(".dashboard-header__breadcrumb-link") ||
      breadcrumb.querySelector("a, button, [role='link']");
    if (breadcrumbLink instanceof HTMLElement) {
      slots.push(breadcrumbLink);
    }
  }
  return dedupeElements(slots);
}

function collectBrandLogoSlots(root) {
  const searchRoot = toSearchRoot(root);
  const slots = queryAllBySelectors(searchRoot, BRAND_LOGO_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  return dedupeElements(slots);
}

export const DOM_COMPAT_CONTRACT_VERSION = "dom-compat-v2";

export function supportsSpeechRecognition() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function findChatComposer(root = document) {
  return (
    pickBest(collectComposerRootCandidates(root), (candidate) => scoreComposerRoot(candidate)) ??
    null
  );
}

export function findChatComposerTextarea(root = document) {
  const searchRoot = toSearchRoot(root);
  return (
    pickBest(queryAll(searchRoot, TEXTAREA_SELECTOR), (candidate) => scoreTextarea(candidate)) ??
    null
  );
}

export function findClosestComposerTextarea(target) {
  const textarea = ancestorMatch(target, (candidate) => candidate.matches(TEXTAREA_SELECTOR));
  return textarea && scoreTextarea(textarea) >= 40 ? textarea : null;
}

export function isComposerTextareaElement(element) {
  return scoreTextarea(element) >= 40;
}

export function findChatToolbar(root = document, options = {}) {
  const searchRoot = toSearchRoot(root);
  const composer = options.composer ?? findChatComposer(searchRoot);

  const candidates = new Set();
  if (composer instanceof Element) {
    for (const hinted of queryAllBySelectors(composer, TOOLBAR_HINT_SELECTORS)) {
      candidates.add(hinted);
    }
    let current = composer.parentElement;
    let depth = 0;
    while (current && depth < 4) {
      for (const hinted of queryAllBySelectors(current, TOOLBAR_HINT_SELECTORS)) {
        candidates.add(hinted);
      }
      current = current.parentElement;
      depth += 1;
    }
  }

  for (const hinted of queryAllBySelectors(searchRoot, TOOLBAR_HINT_SELECTORS)) {
    candidates.add(hinted);
  }

  return pickBest(Array.from(candidates), (candidate) => scoreToolbar(candidate)) ?? null;
}

export function findChatSendButton(root = document, options = {}) {
  const searchRoot = toSearchRoot(root);
  const composer = options.composer ?? findChatComposer(searchRoot);
  const toolbar = options.toolbar ?? findChatToolbar(searchRoot, { composer });
  const context = { composer, toolbar };

  const scoped =
    (composer instanceof Element && bestButtonMatch(composer, scoreSendButton, context)) ||
    (toolbar instanceof Element && bestButtonMatch(toolbar, scoreSendButton, context));

  if (scoped && scoreSendButton(scoped, context) >= 40) {
    return scoped;
  }

  const global = bestButtonMatch(searchRoot, scoreSendButton, context);
  return global && scoreSendButton(global, context) >= 40 ? global : null;
}

export function findChatNewSessionButton(root = document, options = {}) {
  const searchRoot = toSearchRoot(root);
  const composer = options.composer ?? findChatComposer(searchRoot);
  const toolbar = options.toolbar ?? findChatToolbar(searchRoot, { composer });
  const context = { composer, toolbar };

  const scoped =
    (toolbar instanceof Element && bestButtonMatch(toolbar, scoreNewSessionButton, context)) ||
    (composer instanceof Element && bestButtonMatch(composer, scoreNewSessionButton, context));

  if (scoped && scoreNewSessionButton(scoped, context) >= 36) {
    return scoped;
  }

  const global = bestButtonMatch(searchRoot, scoreNewSessionButton, context);
  return global && scoreNewSessionButton(global, context) >= 36 ? global : null;
}

export function findChatVoiceButton(root = document, options = {}) {
  const searchRoot = toSearchRoot(root);
  const composer = options.composer ?? findChatComposer(searchRoot);
  const toolbar = options.toolbar ?? findChatToolbar(searchRoot, { composer });
  const context = { composer, toolbar };

  const scoped =
    (composer instanceof Element && bestButtonMatch(composer, scoreVoiceButton, context)) ||
    (toolbar instanceof Element && bestButtonMatch(toolbar, scoreVoiceButton, context));

  if (scoped && scoreVoiceButton(scoped, context) >= 40) {
    return scoped;
  }

  const global = bestButtonMatch(searchRoot, scoreVoiceButton, context);
  return global && scoreVoiceButton(global, context) >= 40 ? global : null;
}

export function findChatStopButton(root = document, options = {}) {
  const searchRoot = toSearchRoot(root);
  const composer = options.composer ?? findChatComposer(searchRoot);
  const toolbar = options.toolbar ?? findChatToolbar(searchRoot, { composer });
  const context = { composer, toolbar };

  const scoped =
    (toolbar instanceof Element && bestButtonMatch(toolbar, scoreStopButton, context)) ||
    (composer instanceof Element && bestButtonMatch(composer, scoreStopButton, context));
  if (scoped && scoreStopButton(scoped) >= 60) {
    return scoped;
  }

  const global = bestButtonMatch(searchRoot, scoreStopButton, context);
  return global && scoreStopButton(global) >= 60 ? global : null;
}

export function findClosestSendButton(target) {
  const candidate = buttonLikeAncestor(target);
  return candidate && scoreSendButton(candidate) >= 40 ? candidate : null;
}

export function findClosestNewSessionButton(target) {
  const candidate = buttonLikeAncestor(target);
  return candidate && scoreNewSessionButton(candidate) >= 36 ? candidate : null;
}

export function findClosestVoiceButton(target) {
  const candidate = buttonLikeAncestor(target);
  return candidate && scoreVoiceButton(candidate) >= 40 ? candidate : null;
}

export function isSendButtonElement(element) {
  return scoreSendButton(element) >= 40;
}

export function isStopButtonElement(element) {
  return scoreStopButton(element) >= 60;
}

export function isNewSessionButtonElement(element) {
  return scoreNewSessionButton(element) >= 36;
}

export function isVoiceButtonElement(element) {
  return scoreVoiceButton(element) >= 40;
}

export function findSidebar(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, SIDEBAR_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  return pickBest(candidates, (candidate) => scoreSidebar(candidate)) ?? null;
}

export function findClosestSidebar(target) {
  const candidate = ancestorMatch(target, (node) => scoreSidebar(node) >= 20);
  return candidate && scoreSidebar(candidate) >= 20 ? candidate : null;
}

export function findBreadcrumb(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, BREADCRUMB_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  return pickBest(candidates, (candidate) => scoreBreadcrumb(candidate)) ?? null;
}

export function findClosestBreadcrumb(target) {
  const candidate = ancestorMatch(target, (node) => scoreBreadcrumb(node) >= 20);
  return candidate && scoreBreadcrumb(candidate) >= 20 ? candidate : null;
}

export function findChatSurface(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = new Set();

  const composer = findChatComposer(searchRoot);
  if (composer instanceof Element) {
    let current = composer.parentElement;
    let depth = 0;
    while (current && depth < 6) {
      candidates.add(current);
      current = current.parentElement;
      depth += 1;
    }
  }

  for (const hinted of queryAllBySelectors(searchRoot, CHAT_SURFACE_HINT_SELECTORS)) {
    if (hinted instanceof HTMLElement) {
      candidates.add(hinted);
    }
  }

  for (const group of queryAll(searchRoot, ".chat-group, .chat-bubble, .chat-message")) {
    let current = group.parentElement;
    let depth = 0;
    while (current && depth < 4) {
      candidates.add(current);
      current = current.parentElement;
      depth += 1;
    }
  }

  return pickBest(Array.from(candidates), (candidate) => scoreChatSurface(candidate)) ?? null;
}

export function findClosestChatSurface(target) {
  const candidate = ancestorMatch(target, (node) => scoreChatSurface(node) >= 40);
  return candidate && scoreChatSurface(candidate) >= 40 ? candidate : null;
}

export function findOpenClawApp(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, APP_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  return pickBest(candidates, (candidate) => scoreAppRoot(candidate)) ?? null;
}

export function findClosestOpenClawApp(target) {
  const candidate = ancestorMatch(target, (node) => scoreAppRoot(node) >= 40);
  return candidate && scoreAppRoot(candidate) >= 40 ? candidate : null;
}

export function findTopbarSearch(root = document) {
  const candidates = collectTopbarSearchCandidates(root);
  const match = pickBest(candidates, (candidate) => scoreTopbarSearch(candidate));
  return match && scoreTopbarSearch(match) >= 40 ? match : null;
}

export function findSidebarUtilityGroup(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, SIDEBAR_UTILITY_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  return pickBest(candidates, (candidate) => scoreSidebarUtility(candidate)) ?? null;
}

export function findContentMountRoot(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, CONTENT_MOUNT_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  const match = pickBest(candidates, (candidate) => scoreContentMountRoot(candidate));
  return match && scoreContentMountRoot(match) >= 40 ? match : null;
}

export function findChatSessionPicker(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, CHAT_SESSION_PICKER_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  const match = pickBest(candidates, (candidate) => scoreChatSessionPicker(candidate));
  const normalized = normalizeControlContainer(match);
  return normalized && scoreChatSessionPicker(normalized) >= 40 ? normalized : null;
}

export function findChatModelPicker(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, CHAT_MODEL_PICKER_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLSelectElement,
  );
  const match = pickBest(candidates, (candidate) => scoreChatModelPicker(candidate));
  return match && scoreChatModelPicker(match) >= 40 ? match : null;
}

export function findSidebarFooter(root = document) {
  const searchRoot = toSearchRoot(root);
  const candidates = queryAllBySelectors(searchRoot, SIDEBAR_FOOTER_HINT_SELECTORS).filter(
    (candidate) => candidate instanceof HTMLElement,
  );
  const match = pickBest(candidates, (candidate) => scoreSidebarFooter(candidate));
  return match && scoreSidebarFooter(match) >= 40 ? match : null;
}

export function findBrandTitleSlots(root = document) {
  return collectBrandTitleSlots(root);
}

export function findBrandLogoSlots(root = document) {
  return collectBrandLogoSlots(root);
}

export function describeBrandLogoSlot(element) {
  if (!(element instanceof HTMLElement)) {
    return "";
  }
  if (element.matches(".agent-chat__badge img")) {
    return "badge";
  }
  if (element.matches(".agent-chat__avatar--logo")) {
    return "hero";
  }
  if (element.matches(".sidebar-brand__logo")) {
    return "sidebar";
  }
  if (element.matches(".login-gate__logo")) {
    return "login";
  }
  if (element.matches(".chat-avatar--logo")) {
    return "avatar";
  }
  return "";
}

export function describeCompatCapabilities(root = document) {
  const composer = findChatComposer(root);
  const toolbar = findChatToolbar(root, { composer });
  const textarea = findChatComposerTextarea(root);
  const chatSurface = findChatSurface(root);
  const sendButton = findChatSendButton(root, { composer, toolbar });
  const stopButton = findChatStopButton(root, { composer, toolbar });
  const newSessionButton = findChatNewSessionButton(root, { composer, toolbar });
  const voiceButton = findChatVoiceButton(root, { composer, toolbar });
  const contentMountRoot = findContentMountRoot(root);
  const sessionPicker = findChatSessionPicker(root);
  const modelPicker = findChatModelPicker(root);
  const sidebar = findSidebar(root);
  const breadcrumb = findBreadcrumb(root);
  const topbarSearch = findTopbarSearch(root);
  const sidebarUtility = findSidebarUtilityGroup(root);
  const sidebarFooter = findSidebarFooter(root);
  return {
    hasComposer: Boolean(composer && textarea),
    hasSendButton: Boolean(sendButton),
    hasStopButton: Boolean(stopButton),
    hasNewSessionButton: Boolean(newSessionButton),
    hasVoiceButton: Boolean(voiceButton),
    hasSidebar: Boolean(sidebar),
    hasBreadcrumb: Boolean(breadcrumb),
    hasChatSurface: Boolean(chatSurface),
    hasTopbarSearch: Boolean(topbarSearch),
    hasSidebarUtility: Boolean(sidebarUtility),
    hasSidebarFooter: Boolean(sidebarFooter),
    hasSessionPicker: Boolean(sessionPicker),
    hasModelPicker: Boolean(modelPicker),
    hasBrandTitleSlots: findBrandTitleSlots(root).length > 0,
    hasBrandLogoSlots: findBrandLogoSlots(root).length > 0,
    canMountNativeContent: Boolean(contentMountRoot),
    supportsSpeechRecognition: supportsSpeechRecognition(),
    supportsAbortBinding: Boolean(stopButton || sendButton),
    supportsPinnedSessionRouting: Boolean(sessionPicker || modelPicker),
  };
}

export function getFrameworkDomCompat(root = document) {
  const app = findOpenClawApp(root);
  const composer = findChatComposer(root);
  const textarea = findChatComposerTextarea(root);
  const toolbar = findChatToolbar(root, { composer });
  const chatSurface = findChatSurface(root);
  const topbarSearch = findTopbarSearch(root);
  const sidebarUtility = findSidebarUtilityGroup(root);
  const contentMountRoot = findContentMountRoot(root);
  const sidebarFooter = findSidebarFooter(root);
  const sessionPicker = findChatSessionPicker(root);
  const modelPicker = findChatModelPicker(root);
  const brandTitleSlots = findBrandTitleSlots(root);
  const brandLogoSlots = findBrandLogoSlots(root);
  return {
    contractVersion: DOM_COMPAT_CONTRACT_VERSION,
    app,
    chatSurface,
    composer,
    contentMountRoot,
    textarea,
    toolbar,
    topbarSearch,
    sidebarUtility,
    sidebarFooter,
    sessionPicker,
    modelPicker,
    brandTitleSlots,
    brandLogoSlots,
    sendButton: findChatSendButton(root, { composer, toolbar }),
    stopButton: findChatStopButton(root, { composer, toolbar }),
    newSessionButton: findChatNewSessionButton(root, { composer, toolbar }),
    voiceButton: findChatVoiceButton(root, { composer, toolbar }),
    sidebar: findSidebar(root),
    breadcrumb: findBreadcrumb(root),
    capabilities: describeCompatCapabilities(root),
  };
}

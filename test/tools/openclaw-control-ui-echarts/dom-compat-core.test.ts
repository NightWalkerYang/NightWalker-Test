/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  describeCompatCapabilities,
  findBrandLogoSlots,
  findBrandTitleSlots,
  findBreadcrumb,
  findChatComposer,
  findChatModelPicker,
  findChatComposerTextarea,
  findChatNewSessionButton,
  findChatSendButton,
  findChatSessionPicker,
  findChatStopButton,
  findChatSurface,
  findChatToolbar,
  findChatVoiceButton,
  findContentMountRoot,
  findClosestComposerTextarea,
  findClosestNewSessionButton,
  findClosestOpenClawApp,
  findClosestSendButton,
  findClosestVoiceButton,
  findOpenClawApp,
  findSidebar,
  findSidebarFooter,
  findSidebarUtilityGroup,
  findTopbarSearch,
  getFrameworkDomCompat,
  isComposerTextareaElement,
  isNewSessionButtonElement,
  isSendButtonElement,
  isStopButtonElement,
  isVoiceButtonElement,
  syncFrameworkDomMarkers,
  supportsSpeechRecognition,
} from "../../../tools/openclaw-control-ui-echarts/runtime/framework/dom-compat.js";

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe("framework dom compatibility contract", () => {
  it("resolves composer, toolbar, and send button via capability probing", () => {
    document.body.innerHTML = `
      <section class="chat-page">
        <form data-testid="Chat-Composer">
          <div class="composer-frame">
            <label>消息</label>
            <textarea placeholder="Type your message"></textarea>
          </div>
          <div role="toolbar" aria-label="chat actions">
            <button type="button" aria-label="Stop generating">Stop</button>
            <button type="submit" aria-label="发送消息">发送</button>
          </div>
        </form>
      </section>
    `;

    const composer = findChatComposer();
    const textarea = findChatComposerTextarea();
    const toolbar = findChatToolbar();
    const sendButton = findChatSendButton();

    expect(composer).toBeInstanceOf(HTMLFormElement);
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(toolbar).toBeInstanceOf(HTMLElement);
    expect(sendButton).toBeInstanceOf(HTMLElement);
    expect(isSendButtonElement(sendButton)).toBe(true);
    expect((sendButton as HTMLElement).getAttribute("aria-label")).toContain("发送");

    const stopButton = toolbar?.querySelector("button");
    expect(stopButton).toBeInstanceOf(HTMLButtonElement);
    expect(isSendButtonElement(stopButton as Element)).toBe(false);

    const icon = document.createElement("span");
    sendButton?.append(icon);
    expect(findClosestSendButton(icon)).toBe(sendButton);
  });

  it("finds new-session and voice buttons without fixed class hierarchy", () => {
    document.body.innerHTML = `
      <div class="shell-chat">
        <div class="message-box">
          <textarea aria-label="chat composer"></textarea>
          <div class="action-row" data-testid="chat-actions-toolbar">
            <button type="button" title="New session">+</button>
            <button type="button" aria-label="Voice input">mic</button>
          </div>
        </div>
      </div>
    `;

    const newSessionButton = findChatNewSessionButton();
    const voiceButton = findChatVoiceButton();

    expect(newSessionButton).toBeInstanceOf(HTMLElement);
    expect(voiceButton).toBeInstanceOf(HTMLElement);
    expect(isNewSessionButtonElement(newSessionButton)).toBe(true);
    expect(isVoiceButtonElement(voiceButton)).toBe(true);

    const newSessionInner = document.createElement("strong");
    newSessionButton?.append(newSessionInner);
    const voiceInner = document.createElement("span");
    voiceButton?.append(voiceInner);

    expect(findClosestNewSessionButton(newSessionInner)).toBe(newSessionButton);
    expect(findClosestVoiceButton(voiceInner)).toBe(voiceButton);
  });

  it("detects sidebar and breadcrumb containers through semantic hints", () => {
    document.body.innerHTML = `
      <div class="dashboard-shell">
        <aside class="custom-sidenav" aria-label="navigation sidebar">
          <a class="nav-item" href="/chat">Chat</a>
        </aside>
        <header>
          <nav aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <a href="/chat">Chat</a>
          </nav>
        </header>
      </div>
    `;

    const sidebar = findSidebar();
    const breadcrumb = findBreadcrumb();

    expect(sidebar).toBeInstanceOf(HTMLElement);
    expect(breadcrumb).toBeInstanceOf(HTMLElement);
  });

  it("prefers the native sidebar nav inside wrapped shell structures", () => {
    document.body.innerHTML = `
      <aside class="sidebar" aria-label="primary navigation sidebar">
        <div class="sidebar-shell">
          <div class="sidebar-shell__header">
            <button type="button">toggle</button>
          </div>
          <div class="sidebar-shell__body">
            <nav class="sidebar-nav">
              <section class="nav-section">
                <a class="nav-item" href="/chat">Chat</a>
              </section>
            </nav>
          </div>
          <div class="sidebar-shell__footer">
            <div class="sidebar-utility-group">
              <a class="sidebar-utility-link" href="/docs">文档</a>
            </div>
          </div>
        </div>
      </aside>
    `;

    const sidebar = findSidebar();

    expect(sidebar).toBe(document.querySelector(".sidebar-nav"));
  });

  it("does not treat the update-log dialog sidebar as the native sidebar", () => {
    document.body.innerHTML = `
      <div data-oc-update-log-root="true">
        <dialog class="oc-update-log-dialog" data-oc-update-log-history-dialog open>
          <div class="oc-update-log-dialog__panel oc-update-log-dialog__panel--wide">
            <div class="oc-update-log-dialog__body oc-update-log-dialog__body--split">
              <aside class="oc-update-log-dialog__sidebar">
                <label class="oc-update-log-dialog__search">
                  <span>搜索历史</span>
                  <input type="search" placeholder="搜索版本、标题或内容" />
                </label>
                <div class="oc-update-log-dialog__list">
                  <button type="button">v2026.4.23</button>
                </div>
              </aside>
              <section class="oc-update-log-dialog__detail">detail</section>
            </div>
          </div>
        </dialog>
      </div>
    `;

    const updateLogRoot = document.querySelector("[data-oc-update-log-root]");

    expect(findSidebar(updateLogRoot)).toBeNull();
    expect(findSidebar()).toBeNull();
  });

  it("does not fall back to the update-log dialog when the native sidebar is temporarily hidden", () => {
    document.body.innerHTML = `
      <nav class="sidebar-nav" hidden>
        <section class="nav-section">
          <a class="nav-item" href="/chat">Chat</a>
        </section>
      </nav>
      <div data-oc-update-log-root="true">
        <dialog class="oc-update-log-dialog" data-oc-update-log-history-dialog open>
          <div class="oc-update-log-dialog__panel oc-update-log-dialog__panel--wide">
            <div class="oc-update-log-dialog__body oc-update-log-dialog__body--split">
              <aside class="oc-update-log-dialog__sidebar">
                <label class="oc-update-log-dialog__search">
                  <span>搜索历史</span>
                  <input type="search" placeholder="搜索版本、标题或内容" />
                </label>
                <div class="oc-update-log-dialog__list">
                  <button type="button">v2026.4.23</button>
                </div>
              </aside>
              <section class="oc-update-log-dialog__detail">detail</section>
            </div>
          </div>
        </dialog>
      </div>
    `;

    expect(findSidebar(document)).toBeNull();
  });

  it("reports consolidated compat capabilities for tenant/chat callers", () => {
    document.body.innerHTML = `
      <openclaw-app></openclaw-app>
      <div class="sidebar-nav">
        <a class="nav-item" href="/chat">Chat</a>
      </div>
      <nav class="dashboard-header__breadcrumb">
        <a href="/">Root</a>
      </nav>
      <button class="topbar-search">搜索</button>
      <div class="sidebar-utility-group"><a href="/docs">文档</a></div>
      <main class="content--chat">
      <section class="agent-chat__input">
        <textarea></textarea>
        <div class="agent-chat__toolbar">
          <button class="chat-send-btn chat-send-btn--stop" type="button">stop</button>
          <button class="chat-send-btn" type="button">send</button>
          <button class="agent-chat__input-btn" type="button" aria-label="Voice input">mic</button>
          <button class="btn btn--ghost" type="button" title="New session">new</button>
        </div>
      </section>
      </main>
    `;

    const compat = getFrameworkDomCompat();
    expect(compat.contractVersion).toBe("dom-compat-v2");
    expect(compat.app?.tagName.toLowerCase()).toBe("openclaw-app");
    expect(compat.chatSurface).toBeInstanceOf(HTMLElement);
    expect(compat.contentMountRoot).toBeInstanceOf(HTMLElement);
    expect(compat.stopButton).toBeInstanceOf(HTMLElement);
    expect(compat.capabilities.hasComposer).toBe(true);
    expect(compat.capabilities.hasSendButton).toBe(true);
    expect(compat.capabilities.hasStopButton).toBe(true);
    expect(compat.capabilities.hasNewSessionButton).toBe(true);
    expect(compat.capabilities.hasVoiceButton).toBe(true);
    expect(compat.capabilities.hasSidebar).toBe(true);
    expect(compat.capabilities.hasBreadcrumb).toBe(true);
    expect(compat.capabilities.hasChatSurface).toBe(true);
    expect(compat.capabilities.hasTopbarSearch).toBe(true);
    expect(compat.capabilities.hasSidebarUtility).toBe(true);
    expect(compat.capabilities.hasSidebarFooter).toBe(true);
    expect(compat.capabilities.canMountNativeContent).toBe(true);
    expect(isStopButtonElement(document.querySelector(".chat-send-btn--stop"))).toBe(true);
  });

  it("applies stable data-oc markers for style/runtime consumers", () => {
    document.body.innerHTML = `
      <openclaw-app></openclaw-app>
      <aside class="sidebar-nav">
        <section class="nav-section"><a class="nav-item" href="/chat">Chat</a></section>
      </aside>
      <header><button class="topbar-search">搜索</button></header>
      <div class="sidebar-utility-group"><a href="/docs">文档</a></div>
      <footer class="sidebar-shell__footer"><a href="/version">版本</a></footer>
      <main class="conversation-stage">
        <section class="chat-shell">
          <div class="chat-group assistant">
            <span class="chat-avatar assistant"></span>
            <div class="chat-group-messages">
              <div class="chat-bubble"><div class="chat-text">hello</div></div>
            </div>
            <div class="chat-group-footer"></div>
          </div>
          <form data-testid="chat-composer">
            <textarea aria-label="输入消息"></textarea>
            <div role="toolbar" aria-label="chat actions">
              <button type="button" aria-label="Stop generating">stop</button>
              <button type="button" aria-label="Voice input">mic</button>
              <button type="button" title="New session">new</button>
              <button type="submit" aria-label="发送消息">send</button>
            </div>
          </form>
        </section>
      </main>
    `;

    syncFrameworkDomMarkers(document);

    expect(document.querySelector('[data-oc-openclaw-app="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-surface="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-composer="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-toolbar="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-send-button="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-stop-button="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-voice-button="true"]')).toBeInstanceOf(
      HTMLElement,
    );
    expect(document.querySelector('[data-oc-chat-new-session-button="true"]')).toBeInstanceOf(
      HTMLElement,
    );
    expect(document.querySelector('[data-oc-sidebar="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-nav-section="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-topbar-search="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-sidebar-utility="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-sidebar-footer="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-content-mount-root="true"]')).toBeInstanceOf(
      HTMLElement,
    );
    expect(document.querySelector('[data-oc-chat-group="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-group-role="assistant"]')).toBeInstanceOf(
      HTMLElement,
    );
    expect(document.querySelector('[data-oc-chat-avatar="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-bubble="true"]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelector('[data-oc-chat-text="true"]')).toBeInstanceOf(HTMLElement);
  });

  it("finds app, surface, topbar, utility, and textarea ancestors without fixed wrappers", () => {
    document.body.innerHTML = `
      <div class="shell">
        <openclaw-app data-openclaw-app></openclaw-app>
        <header>
          <button class="header-search-trigger" aria-label="搜索控制台">搜索</button>
        </header>
        <main class="conversation-stage">
          <section class="message-pane">
            <div class="composer-shell">
              <textarea aria-label="消息输入"></textarea>
            </div>
          </section>
        </main>
        <footer class="sidebar-shell__footer">
          <a href="/docs">文档</a>
          <a href="/version">版本</a>
        </footer>
      </div>
    `;

    const textarea = document.querySelector("textarea");
    const appInner = document.createElement("span");
    document.querySelector("openclaw-app")?.append(appInner);

    expect(findOpenClawApp()).toBeInstanceOf(HTMLElement);
    expect(findClosestOpenClawApp(appInner)).toBe(document.querySelector("openclaw-app"));
    expect(findChatSurface()).toBeInstanceOf(HTMLElement);
    expect(findTopbarSearch()).toBeInstanceOf(HTMLElement);
    expect(findSidebarUtilityGroup()).toBeInstanceOf(HTMLElement);
    expect(findSidebarFooter()).toBeInstanceOf(HTMLElement);
    expect(findContentMountRoot()).toBeInstanceOf(HTMLElement);
    expect(findClosestComposerTextarea(textarea)).toBe(textarea);
    expect(isComposerTextareaElement(textarea)).toBe(true);
  });

  it("detects session/model pickers and brand slots after wrapper drift", () => {
    document.body.innerHTML = `
      <div class="shell">
        <div class="sidebar-brand">
          <div class="brand-shell"><span class="sidebar-brand__title">OpenClaw</span></div>
          <div class="logo-shell"><img class="sidebar-brand__logo" src="/logo.svg" alt="OpenClaw" /></div>
        </div>
        <nav aria-label="breadcrumb">
          <a href="/">OpenClaw</a>
          <span>/</span>
          <a href="/chat">聊天</a>
        </nav>
        <div class="chat-controls__session-row">
          <label class="field chat-controls__session">
            <span>会话</span>
            <select><option value="a">A</option></select>
          </label>
          <label class="field chat-controls__session chat-controls__model">
            <span>模型</span>
            <select data-chat-model-select="true"><option value="openai/gpt-5.4">GPT-5.4</option></select>
          </label>
        </div>
      </div>
    `;

    expect(findChatSessionPicker()).toBeInstanceOf(HTMLElement);
    expect(findChatModelPicker()).toBeInstanceOf(HTMLSelectElement);
    expect(findBrandTitleSlots()).toHaveLength(2);
    expect(findBrandLogoSlots()).toHaveLength(1);
  });

  it("summarizes compat capabilities with non-silent mount degradation", () => {
    document.body.innerHTML = `
      <aside aria-label="navigation sidebar">
        <div class="sidebar-shell__footer"><a href="/docs">文档</a></div>
      </aside>
    `;

    const capabilities = describeCompatCapabilities();

    expect(capabilities.hasComposer).toBe(false);
    expect(capabilities.canMountNativeContent).toBe(false);
    expect(capabilities.hasSidebar).toBe(true);
    expect(capabilities.hasSidebarFooter).toBe(true);
  });

  it("prefers a header-mounted topbar search over sidebar search-like utilities", () => {
    document.body.innerHTML = `
      <div class="shell">
        <header class="workspace-header">
          <button aria-label="搜索控制台">搜索</button>
        </header>
        <aside aria-label="navigation sidebar">
          <button class="sidebar-search-link" aria-label="搜索帮助文档">搜索文档</button>
        </aside>
      </div>
    `;

    const search = findTopbarSearch();

    expect(search).toBe(document.querySelector("header button"));
    expect(search).not.toBe(document.querySelector("aside button"));
  });

  it("reflects speech-recognition capability from runtime APIs", () => {
    expect(supportsSpeechRecognition()).toBe(false);

    class FakeSpeechRecognition {}
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSpeechRecognition;

    expect(supportsSpeechRecognition()).toBe(true);
  });
});

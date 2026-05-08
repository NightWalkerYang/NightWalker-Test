/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootChatAmbientBackground } from "../../../tools/openclaw-control-ui-echarts/runtime/background/chat-ambient.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("zero-intrusive chat ambient background", () => {
  it("injects a single ambient host into the chat content root", async () => {
    document.body.innerHTML = `<main class="content content--chat"><section class="chat"></section></main>`;

    bootChatAmbientBackground();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const hosts = document.querySelectorAll(".content--chat > .oc-chat-ambient");
    expect(hosts).toHaveLength(1);
    expect(hosts[0]?.querySelector(".oc-chat-ambient__svg")).toBeTruthy();
  });

  it("still finds the chat surface when the upstream chat root class drifts", async () => {
    document.body.innerHTML = `
      <main class="conversation-stage">
        <section class="message-pane">
          <div class="composer-shell">
            <textarea aria-label="发送消息"></textarea>
          </div>
          <article class="chat-group"></article>
        </section>
      </main>
    `;

    bootChatAmbientBackground();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const hosts = document.querySelectorAll(".conversation-stage > .oc-chat-ambient");
    expect(hosts).toHaveLength(1);
  });
});

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { bootToolRunCluster } from "../../../tools/openclaw-control-ui-echarts/runtime/framework/tool-run-cluster.js";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

function renderGroup(role: string, body: string) {
  return `
    <div class="chat-group ${role}">
      <div class="chat-group-messages">
        <div class="chat-bubble">${body}</div>
        <div class="chat-group-footer"></div>
      </div>
    </div>
  `;
}

describe("zero-intrusive tool run cluster", () => {
  it("clusters only contiguous tool-only groups within the same turn", async () => {
    document.body.innerHTML = `
      <main class="content content--chat">
        <section class="chat-thread">
          ${renderGroup("user", `<div class="chat-text">first ask</div>`)}
          ${renderGroup("assistant", `<details class="chat-tools-collapse"></details>`)}
          ${renderGroup("tool", `<details class="chat-tool-msg-collapse"></details>`)}
          ${renderGroup("assistant", `<details class="chat-tools-collapse"></details>`)}
          ${renderGroup("tool", `<details class="chat-tool-msg-collapse"></details>`)}
          ${renderGroup("assistant", `<div class="chat-text">done</div>`)}
          ${renderGroup("user", `<div class="chat-text">second ask</div>`)}
          ${renderGroup("assistant", `<details class="chat-tools-collapse"></details>`)}
          ${renderGroup("tool", `<details class="chat-tool-msg-collapse"></details>`)}
        </section>
      </main>
    `;

    bootToolRunCluster();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const clusters = Array.from(document.querySelectorAll(".chat-thread > .oc-tool-run-cluster"));
    expect(clusters).toHaveLength(2);

    const firstClusterGroups = Array.from(clusters[0]?.querySelectorAll(":scope > .chat-group") || []);
    expect(firstClusterGroups).toHaveLength(4);
    expect(firstClusterGroups[0]?.getAttribute("data-oc-tool-run")).toBe("start");
    expect(firstClusterGroups[1]?.getAttribute("data-oc-tool-run")).toBe("mid");
    expect(firstClusterGroups[2]?.getAttribute("data-oc-tool-run")).toBe("mid");
    expect(firstClusterGroups[3]?.getAttribute("data-oc-tool-run")).toBe("end");
    expect(firstClusterGroups[0]?.getAttribute("data-oc-tool-run-hidden")).toBe("true");
    expect(firstClusterGroups[1]?.getAttribute("data-oc-tool-run-hidden")).toBe("true");
    expect(firstClusterGroups[2]?.getAttribute("data-oc-tool-run-hidden")).toBe("true");
    expect(firstClusterGroups[3]?.hasAttribute("data-oc-tool-run-hidden")).toBe(false);
    expect(firstClusterGroups[0]?.hidden).toBe(true);
    expect(firstClusterGroups[1]?.hidden).toBe(true);
    expect(firstClusterGroups[2]?.hidden).toBe(true);
    expect(firstClusterGroups[3]?.hidden).toBe(false);

    const secondClusterGroups = Array.from(clusters[1]?.querySelectorAll(":scope > .chat-group") || []);
    expect(secondClusterGroups).toHaveLength(2);
    expect(secondClusterGroups[0]?.getAttribute("data-oc-tool-run")).toBe("start");
    expect(secondClusterGroups[1]?.getAttribute("data-oc-tool-run")).toBe("end");

    const toggle = clusters[0]?.querySelector<HTMLButtonElement>(".oc-tool-run-cluster__toggle");
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    toggle?.click();

    expect(clusters[0]?.getAttribute("data-oc-tool-run-open")).toBe("true");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(firstClusterGroups[0]?.hasAttribute("data-oc-tool-run-hidden")).toBe(false);
    expect(firstClusterGroups[1]?.hasAttribute("data-oc-tool-run-hidden")).toBe(false);
    expect(firstClusterGroups[2]?.hasAttribute("data-oc-tool-run-hidden")).toBe(false);
    expect(firstClusterGroups[0]?.hidden).toBe(false);
    expect(firstClusterGroups[1]?.hidden).toBe(false);
    expect(firstClusterGroups[2]?.hidden).toBe(false);
    expect(firstClusterGroups[3]?.hidden).toBe(false);
  });

  it("keeps rebuilt runs collapsed onto the newest tool entry", async () => {
    document.body.innerHTML = `
      <main class="content content--chat">
        <section class="chat-thread">
          ${renderGroup("user", `<div class="chat-text">ask</div>`)}
          ${renderGroup("assistant", `<details class="chat-tools-collapse"></details>`)}
          ${renderGroup("tool", `<details class="chat-tool-msg-collapse"></details>`)}
        </section>
      </main>
    `;

    bootToolRunCluster();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const thread = document.querySelector(".chat-thread");
    thread?.insertAdjacentHTML(
      "beforeend",
      renderGroup("assistant", `<details class="chat-tools-collapse"></details>`),
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const cluster = document.querySelector(".chat-thread > .oc-tool-run-cluster");
    const groups = Array.from(cluster?.querySelectorAll(":scope > .chat-group") || []);
    expect(groups).toHaveLength(3);
    expect(groups[0]?.getAttribute("data-oc-tool-run-hidden")).toBe("true");
    expect(groups[1]?.getAttribute("data-oc-tool-run-hidden")).toBe("true");
    expect(groups[2]?.hasAttribute("data-oc-tool-run-hidden")).toBe(false);
    expect(groups[0]?.hidden).toBe(true);
    expect(groups[1]?.hidden).toBe(true);
    expect(groups[2]?.hidden).toBe(false);
    expect(groups[2]?.querySelector(".oc-tool-run-cluster__toggle")).toBeTruthy();
  });

  it("does not reschedule endlessly from its own regrouping mutations", async () => {
    document.body.innerHTML = `
      <main class="content content--chat">
        <section class="chat-thread">
          ${renderGroup("user", `<div class="chat-text">ask</div>`)}
          ${renderGroup("assistant", `<details class="chat-tools-collapse"></details>`)}
          ${renderGroup("tool", `<details class="chat-tool-msg-collapse"></details>`)}
        </section>
      </main>
    `;

    bootToolRunCluster();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const originalRaf = globalThis.requestAnimationFrame;
    const callbacks: FrameRequestCallback[] = [];

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }) as typeof globalThis.requestAnimationFrame;

    try {
      const thread = document.querySelector(".chat-thread");
      thread?.insertAdjacentHTML(
        "beforeend",
        renderGroup("assistant", `<details class="chat-tools-collapse"></details>`),
      );

      await Promise.resolve();
      expect(callbacks).toHaveLength(1);

      const first = callbacks.shift();
      first?.(0);

      await Promise.resolve();
      expect(callbacks).toHaveLength(0);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });
});

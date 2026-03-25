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

    const groups = Array.from(document.querySelectorAll(".chat-thread > .chat-group"));
    expect(groups[1]?.getAttribute("data-oc-tool-run")).toBe("start");
    expect(groups[2]?.getAttribute("data-oc-tool-run")).toBe("mid");
    expect(groups[3]?.getAttribute("data-oc-tool-run")).toBe("mid");
    expect(groups[4]?.getAttribute("data-oc-tool-run")).toBe("end");
    expect(groups[5]?.hasAttribute("data-oc-tool-run")).toBe(false);
    expect(groups[7]?.getAttribute("data-oc-tool-run")).toBe("start");
    expect(groups[8]?.getAttribute("data-oc-tool-run")).toBe("end");
  });
});

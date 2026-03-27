/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootVoiceInputBridge } from "../../../tools/openclaw-control-ui-echarts/runtime/framework/voice-input.js";

class FakeSpeechRecognition extends EventTarget {
  static instances: FakeSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";
  started = false;
  stopped = false;

  constructor() {
    super();
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.started = true;
    this.dispatchEvent(new Event("start"));
  }

  stop() {
    this.stopped = true;
    this.dispatchEvent(new Event("end"));
  }
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function renderComposer() {
  document.body.innerHTML = `
    <div class="agent-chat__input">
      <textarea></textarea>
      <button class="agent-chat__input-btn" type="button" title="Voice input" aria-label="Voice input"></button>
    </div>
  `;
}

beforeEach(() => {
  FakeSpeechRecognition.instances = [];
  (window as unknown as Record<string, unknown>).__openclawVoiceInputBridgeBooted = false;
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSpeechRecognition;
});

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  delete (window as unknown as Record<string, unknown>).__openclawVoiceInputBridgeBooted;
  vi.restoreAllMocks();
});

describe("zero-intrusive voice input bridge", () => {
  it("requests microphone access and appends final transcripts into the composer", async () => {
    renderComposer();

    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop }],
        })),
      },
    });

    bootVoiceInputBridge();
    document.querySelector("button")?.click();
    await flushMicrotasks();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(FakeSpeechRecognition.instances).toHaveLength(1);
    expect(FakeSpeechRecognition.instances[0]?.started).toBe(true);
    expect(stop).toHaveBeenCalled();
    expect(document.querySelector(".agent-chat__input")?.getAttribute("data-oc-voice-recording")).toBe("true");
    expect(document.querySelector(".agent-chat__input")?.getAttribute("data-oc-voice-state")).toBe("recording");
    expect(document.querySelector(".oc-voice-status")?.textContent).toContain("正在听写");
    expect(document.querySelector("button")?.classList.contains("agent-chat__input-btn--recording")).toBe(true);

    const resultEvent = new Event("result");
    Object.assign(resultEvent, {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: {
            transcript: "测试语音",
          },
        },
      ],
    });
    FakeSpeechRecognition.instances[0]?.dispatchEvent(resultEvent);

    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("测试语音");

    FakeSpeechRecognition.instances[0]?.stop();
    expect(document.querySelector(".agent-chat__input")?.hasAttribute("data-oc-voice-recording")).toBe(false);
    expect(document.querySelector(".agent-chat__input")?.hasAttribute("data-oc-voice-state")).toBe(false);
  });

  it("shows a visible error when microphone permission is denied", async () => {
    renderComposer();

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        }),
      },
    });

    bootVoiceInputBridge();
    document.querySelector("button")?.click();
    await flushMicrotasks();

    const status = document.querySelector(".oc-voice-status");
    expect(status?.textContent).toContain("麦克风权限");
    expect(FakeSpeechRecognition.instances).toHaveLength(0);
  });
});

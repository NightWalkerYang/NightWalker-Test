import {
  findChatComposer,
  findChatComposerTextarea,
  findChatVoiceButton,
  findClosestVoiceButton,
  isVoiceButtonElement,
  supportsSpeechRecognition,
} from "./dom-compat.js";

const STATUS_SELECTOR = ".oc-voice-status";
const RECORDING_ATTR = "data-oc-voice-recording";
const VOICE_STATE_ATTR = "data-oc-voice-state";
const BUTTON_STATE_ATTR = "data-oc-chat-button-state";

function getSpeechRecognitionCtor() {
  if (!supportsSpeechRecognition()) {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getVoiceButton() {
  return findChatVoiceButton(document);
}

function getComposer() {
  return findChatComposer(document);
}

function getTextarea() {
  return findChatComposerTextarea(document);
}

function clearStatus() {
  document.querySelector(STATUS_SELECTOR)?.remove();
}

function showStatus(message, tone = "info", sticky = false) {
  const composer = getComposer();
  if (!composer) {
    return;
  }

  clearStatus();

  const status = document.createElement("div");
  status.className = `oc-voice-status oc-voice-status--${tone}`;
  status.textContent = message;
  composer.append(status);

  if (sticky) {
    return;
  }

  window.setTimeout(() => {
    if (status.isConnected) {
      status.remove();
    }
  }, 4200);
}

function applyButtonState(mode) {
  const composer = getComposer();
  if (composer) {
    if (mode !== "idle") {
      composer.setAttribute(RECORDING_ATTR, "true");
      composer.setAttribute(VOICE_STATE_ATTR, mode);
    } else {
      composer.removeAttribute(RECORDING_ATTR);
      composer.removeAttribute(VOICE_STATE_ATTR);
    }
  }

  const button = getVoiceButton();
  if (!isVoiceButtonElement(button)) {
    return;
  }

  const active = mode === "starting" || mode === "recording";
  button.classList.toggle("agent-chat__input-btn--recording", active);
  button.classList.toggle("agent-chat__input-btn--pending", mode === "starting");
  if (mode === "starting") {
    button.setAttribute(BUTTON_STATE_ATTR, "pending");
  } else if (mode === "recording") {
    button.setAttribute(BUTTON_STATE_ATTR, "recording");
  } else {
    button.removeAttribute(BUTTON_STATE_ATTR);
  }
  button.setAttribute("title", active ? "Stop recording" : "Voice input");
  button.setAttribute("aria-label", active ? "Stop recording" : "Voice input");
}

function appendTranscript(text) {
  const textarea = getTextarea();
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const current = textarea.value;
  const sep = current && !current.endsWith(" ") ? " " : "";
  const next = `${current}${sep}${text}`;
  textarea.value = next;
  textarea.dispatchEvent(
    new Event("input", {
      bubbles: true,
      cancelable: false,
    }),
  );
  textarea.focus();
}

function normalizePermissionError(error) {
  if (!error) {
    return "无法访问麦克风";
  }

  const value =
    typeof error === "string"
      ? error
      : typeof error?.name === "string"
        ? error.name
        : typeof error?.message === "string"
          ? error.message
          : String(error);
  const lower = value.toLowerCase();

  if (lower.includes("notallowed") || lower.includes("permission") || lower.includes("denied")) {
    return "浏览器拒绝了麦克风权限，请在地址栏站点权限里允许麦克风";
  }

  if (lower.includes("notfound") || lower.includes("device")) {
    return "没有找到可用的麦克风设备";
  }

  return "麦克风初始化失败";
}

function normalizeRecognitionError(error) {
  const lower = String(error || "").toLowerCase();
  if (lower === "not-allowed" || lower === "service-not-allowed") {
    return "浏览器拒绝了语音识别权限，请检查站点麦克风授权";
  }
  if (lower === "audio-capture") {
    return "浏览器无法捕获麦克风音频";
  }
  if (lower === "network") {
    return "浏览器语音识别服务不可用，请稍后再试";
  }
  if (lower === "language-not-supported") {
    return "当前浏览器不支持所选语音识别语言";
  }
  return `语音识别失败：${error || "unknown error"}`;
}

async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return true;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  } catch {
    // Ignore cleanup failures.
  }
  return true;
}

function syncUiFromState(state) {
  const mode = getModeFromState(state);
  applyButtonState(mode);

  if (mode === "starting") {
    showStatus("正在启动语音输入...", "info", true);
    return;
  }

  if (mode === "recording") {
    showStatus("正在听写，点击麦克风可结束", "active", true);
    return;
  }

  clearStatus();
}

function getModeFromState(state) {
  return state.starting ? "starting" : state.recognition ? "recording" : "idle";
}

function createSpeechController() {
  const state = {
    recognition: null,
    starting: false,
    requestId: 0,
  };

  const stop = () => {
    state.requestId += 1;
    state.starting = false;
    const recognition = state.recognition;
    state.recognition = null;
    syncUiFromState(state);
    clearStatus();
    if (!recognition) {
      return;
    }
    try {
      recognition.stop();
    } catch {
      // Ignore already-stopped instances.
    }
  };

  const start = async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showStatus("当前浏览器不支持语音输入", "error");
      return;
    }

    if (state.recognition || state.starting) {
      stop();
      return;
    }

    state.starting = true;
    const requestId = state.requestId + 1;
    state.requestId = requestId;
    syncUiFromState(state);
    clearStatus();

    try {
      await requestMicrophonePermission();
    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }
      state.starting = false;
      syncUiFromState(state);
      showStatus(normalizePermissionError(error), "error");
      return;
    }

    if (requestId !== state.requestId) {
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "zh-CN";

    recognition.addEventListener("start", () => {
      state.starting = false;
      state.recognition = recognition;
      syncUiFromState(state);
    });

    recognition.addEventListener("result", (event) => {
      let finalTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.[0]) {
          continue;
        }
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        appendTranscript(finalTranscript.trim());
      }
    });

    recognition.addEventListener("error", (event) => {
      const error = event?.error || "unknown";
      if (error !== "aborted" && error !== "no-speech") {
        showStatus(normalizeRecognitionError(error), "error");
      }
      state.starting = false;
      if (state.recognition === recognition) {
        state.recognition = null;
      }
      syncUiFromState(state);
    });

    recognition.addEventListener("end", () => {
      state.starting = false;
      if (state.recognition === recognition) {
        state.recognition = null;
      }
      syncUiFromState(state);
    });

    try {
      recognition.start();
    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }
      state.starting = false;
      state.recognition = null;
      syncUiFromState(state);
      showStatus(normalizeRecognitionError(error?.message || error), "error");
    }
  };

  return { state, start, stop };
}

export function bootVoiceInputBridge() {
  if (window.__openclawVoiceInputBridgeBooted) {
    return;
  }
  window.__openclawVoiceInputBridgeBooted = true;

  const controller = createSpeechController();

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target instanceof Element ? findClosestVoiceButton(event.target) : null;
      if (!isVoiceButtonElement(button)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (controller.state.recognition || controller.state.starting) {
        controller.stop();
      } else {
        void controller.start();
      }
    },
    true,
  );

  const observer = new MutationObserver(() => {
    applyButtonState(getModeFromState(controller.state));
  });
  observer.observe(document.body, { childList: true, subtree: true });

  syncUiFromState(controller.state);
}

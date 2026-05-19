import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const DEFAULT_CLOUD_ENDPOINT = "https://hailstone.cn:18789/";

const modeSelectorEl = document.querySelector("#mode-selector");
const bootStatusEl = document.querySelector("#boot-status");
const bootTitle = document.querySelector("#boot-title");
const statusText = document.querySelector("#desktop-shell-status");
const openButton = document.querySelector("#desktop-shell-open");
const btnConnected = document.querySelector("#btn-connected-mode");
const btnStandalone = document.querySelector("#btn-standalone-mode");
const btnSwitchMode = document.querySelector("#btn-switch-mode");
const endpointSection = document.querySelector("#cloud-endpoint-input");
const inputEndpoint = document.querySelector("#input-endpoint");
const btnConfirmEndpoint = document.querySelector("#btn-confirm-endpoint");

function showSection(section) {
  modeSelectorEl.hidden = section !== "selector";
  bootStatusEl.hidden = section !== "boot";
}

function setStatus(title, message) {
  if (bootTitle) bootTitle.textContent = title;
  if (statusText) statusText.textContent = message;
}

async function getConfig() {
  try {
    return await invoke("get_desktop_config");
  } catch {
    return { mode: null, cloudEndpoint: null };
  }
}

async function saveConfig(mode, cloudEndpoint) {
  await invoke("set_desktop_config", {
    config: { mode, cloudEndpoint: cloudEndpoint || null },
  });
}

function openControlUi(url) {
  window.location.replace(url);
}

async function bootRuntime(mode, cloudEndpoint) {
  showSection("boot");
  const isConnected = mode === "connected";

  if (isConnected) {
    const url = (cloudEndpoint || DEFAULT_CLOUD_ENDPOINT).replace(/\/$/, "");
    setStatus("连接云端", "正在连接到 " + url);
    openButton.hidden = false;
    openButton.addEventListener("click", () => openControlUi(url));
    openControlUi(url);
    return;
  }

  setStatus("正在启动本地服务", "正在配置运行环境。");
  try {
    await invoke("write_runtime_env_mode", { cloudEndpoint: null });
    setStatus("正在启动本地服务", "正在启动 Gateway 和租户服务。");
    const result = await invoke("start_openclaw_runtime");
    const url = result?.controlUiUrl || "http://127.0.0.1:18789";
    setStatus("服务已就绪", "正在打开控制台。");
    openButton.hidden = false;
    openButton.addEventListener("click", () => openControlUi(url));
    openControlUi(url);
  } catch (error) {
    setStatus("启动失败", error instanceof Error ? error.message : String(error));
  }
}

function showModeSelector() {
  showSection("selector");
  endpointSection.hidden = true;
}

async function selectConnected() {
  endpointSection.hidden = false;
}

async function confirmEndpoint() {
  const endpoint = inputEndpoint.value.trim() || DEFAULT_CLOUD_ENDPOINT;
  await saveConfig("connected", endpoint);
  await bootRuntime("connected", endpoint);
}

async function selectStandalone() {
  await saveConfig("standalone", null);
  await bootRuntime("standalone", null);
}

async function main() {
  btnConnected.addEventListener("click", selectConnected);
  btnStandalone.addEventListener("click", selectStandalone);
  btnConfirmEndpoint.addEventListener("click", confirmEndpoint);
  btnSwitchMode.addEventListener("click", showModeSelector);

  const config = await getConfig();
  if (config.mode === "connected") {
    await bootRuntime("connected", config.cloudEndpoint);
  } else if (config.mode === "standalone") {
    await bootRuntime("standalone", null);
  } else {
    showModeSelector();
  }
}

void main();
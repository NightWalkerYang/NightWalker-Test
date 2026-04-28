import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const QRCode = require("qrcode-terminal/vendor/QRCode");
const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");

const DEFAULT_ALLINPAY_ORDER_URL = "https://vsp.allinpay.com/apiweb/h5unionpay/unionorder";
const DEFAULT_ALLINPAY_QUERY_URL = "https://vsp.allinpay.com/apiweb/h5unionpay/query";
const DEFAULT_ALLINPAY_VERSION = "12";
const DEFAULT_ALLINPAY_SIGN_TYPE = "RSA";
const DEFAULT_ALLINPAY_VALID_MINUTES = 30;

const ALLINPAY_CHANNELS = {
  allinpay_h5_auto: {
    id: "allinpay_h5_auto",
    label: "通联收银台",
    paytype: "",
  },
  allinpay_h5_wechat: {
    id: "allinpay_h5_wechat",
    label: "微信支付",
    paytype: "W01",
  },
  allinpay_h5_alipay: {
    id: "allinpay_h5_alipay",
    label: "支付宝支付",
    paytype: "A01",
  },
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUrl(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

function readSecretFilePath(pathValue) {
  const normalized = normalizeText(pathValue);
  if (!normalized) {
    return "";
  }
  try {
    if (!fs.existsSync(normalized)) {
      return "";
    }
    return fs.readFileSync(normalized, "utf8");
  } catch {
    return "";
  }
}

function wrapPem(rawValue, label) {
  const normalized = normalizeText(rawValue).replace(/\s+/g, "");
  if (!normalized) {
    return "";
  }
  if (normalized.includes("-----BEGIN")) {
    return rawValue;
  }
  const chunks = normalized.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${chunks.join("\n")}\n-----END ${label}-----\n`;
}

function normalizePrivateKeyPem(rawValue) {
  const normalized = normalizeText(rawValue);
  if (!normalized) {
    return "";
  }
  if (normalized.includes("-----BEGIN")) {
    return normalized;
  }
  return wrapPem(normalized, "PRIVATE KEY");
}

function normalizePublicKeyPem(rawValue) {
  const normalized = normalizeText(rawValue);
  if (!normalized) {
    return "";
  }
  if (normalized.includes("-----BEGIN")) {
    return normalized;
  }
  return wrapPem(normalized, "PUBLIC KEY");
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeAmountCny(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * 100) / 100;
}

function amountCnyToFen(value) {
  return String(Math.round(normalizeAmountCny(value) * 100));
}

function buildAllinpaySignPayload(fields) {
  return Object.entries(fields || {})
    .filter(([key, value]) => key !== "sign" && normalizeText(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${normalizeText(value)}`)
    .join("&");
}

function buildRandomString() {
  return crypto.randomUUID().replace(/-/g, "");
}

function mapChannel(channelId) {
  const normalized = normalizeText(channelId);
  return ALLINPAY_CHANNELS[normalized] || ALLINPAY_CHANNELS.allinpay_h5_auto;
}

function mapProviderStatus(trxstatus) {
  const normalized = normalizeText(trxstatus);
  if (!normalized) {
    return "pending_payment";
  }
  if (normalized === "0000") {
    return "paid";
  }
  if (normalized === "3045") {
    return "closed";
  }
  if (normalized.startsWith("2")) {
    return "processing";
  }
  return "failed";
}

function parsePayloadText(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return {};
  }
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}
  const params = new URLSearchParams(normalized);
  if ([...params.keys()].length) {
    return Object.fromEntries(
      [...params.entries()].map(([key, value]) =>
        key === "sign" ? [key, String(value || "").replace(/ /g, "+")] : [key, value],
      ),
    );
  }
  return {};
}

export function getAllinpayChannelCatalog() {
  return Object.values(ALLINPAY_CHANNELS).map((entry) => ({ ...entry }));
}

export function resolveAllinpaySidecarConfig(env = process.env, platformConfig = {}) {
  const privateKey =
    normalizePrivateKeyPem(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_PRIVATE_KEY) ||
    normalizePrivateKeyPem(
      readSecretFilePath(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_PRIVATE_KEY_PATH),
    );
  const publicKey =
    normalizePublicKeyPem(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_PUBLIC_KEY) ||
    normalizePublicKeyPem(readSecretFilePath(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_PUBLIC_KEY_PATH));
  const appId = normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_APP_ID);
  const merchantId = normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_MERCHANT_ID);
  const publicBaseUrl = normalizeUrl(
    platformConfig.publicBaseUrl || env.OPENCLAW_TENANT_PLATFORM_PUBLIC_BASE_URL,
  );
  const apiBasePath = normalizeText(platformConfig.apiBasePath || "/tenant-platform-api/v1");
  const notifyPath =
    normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_NOTIFY_PATH) ||
    `${apiBasePath}/public/payment/allinpay/notify`;
  const returnPath =
    normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_RETURN_PATH) ||
    "/?ocTenantView=tenant-wallet";
  const validMinutes = normalizePositiveInteger(
    env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_VALID_MINUTES,
    DEFAULT_ALLINPAY_VALID_MINUTES,
  );
  const enabled = Boolean(appId && merchantId && privateKey && publicKey && publicBaseUrl);

  return {
    enabled,
    providerId: "allinpay",
    providerName: "通联支付",
    appId,
    merchantId,
    privateKey,
    publicKey,
    publicBaseUrl,
    apiBasePath,
    notifyPath,
    notifyUrl: publicBaseUrl ? `${publicBaseUrl}${notifyPath}` : "",
    returnPath,
    returnUrl:
      publicBaseUrl && publicBaseUrl.startsWith("https://")
        ? `${publicBaseUrl}${returnPath}`
        : "",
    orderUrl: normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_ORDER_URL) || DEFAULT_ALLINPAY_ORDER_URL,
    queryUrl: normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_QUERY_URL) || DEFAULT_ALLINPAY_QUERY_URL,
    version:
      normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_VERSION) || DEFAULT_ALLINPAY_VERSION,
    signType:
      normalizeText(env.OPENCLAW_TENANT_PAYMENT_ALLINPAY_SIGN_TYPE) || DEFAULT_ALLINPAY_SIGN_TYPE,
    validMinutes,
    launchPath: `${apiBasePath}/tenant/admin/payment-orders/launch`,
    channels: getAllinpayChannelCatalog(),
  };
}

export function signAllinpayFields(fields, config) {
  const payload = buildAllinpaySignPayload(fields);
  return crypto.createSign("RSA-SHA1").update(payload, "utf8").sign(config.privateKey, "base64");
}

export function verifyAllinpayFields(fields, config) {
  const sign = normalizeText(fields?.sign);
  if (!sign) {
    return false;
  }
  const payload = buildAllinpaySignPayload(fields);
  try {
    return crypto
      .createVerify("RSA-SHA1")
      .update(payload, "utf8")
      .verify(config.publicKey, sign, "base64");
  } catch {
    return false;
  }
}

export function buildAllinpayLaunchDescriptor(order, config) {
  if (!config?.enabled) {
    throw new Error("payment_provider_unavailable");
  }
  const channel = mapChannel(order?.providerPayload?.channel || order?.channel);
  const fields = {
    version: config.version,
    cusid: config.merchantId,
    appid: config.appId,
    trxamt: amountCnyToFen(order?.amountCny),
    reqsn: normalizeText(order?.id),
    randomstr: buildRandomString(),
    body: normalizeText(order?.body) || "OpenClaw租户充值",
    remark: normalizeText(order?.id),
    notify_url: config.notifyUrl,
    sign_type: config.signType,
    validtime: String(config.validMinutes),
  };
  if (channel.paytype) {
    fields.paytype = channel.paytype;
  }
  if (config.returnUrl) {
    fields.returl = config.returnUrl;
  }
  fields.sign = signAllinpayFields(fields, config);
  return {
    actionUrl: config.orderUrl,
    channel,
    fields,
  };
}

export function buildAllinpayLaunchHtml(order, config) {
  const descriptor = buildAllinpayLaunchDescriptor(order, config);
  const hiddenInputs = Object.entries(descriptor.fields)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value || ""))}" />`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>通联支付跳转中</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      .card {
        width: min(92vw, 420px);
        padding: 24px;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 20px;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: #475569;
      }
      .actions {
        margin-top: 18px;
      }
      button {
        min-width: 120px;
        padding: 10px 14px;
        border: none;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>正在跳转通联收银台</h1>
      <p>若浏览器未自动跳转，请点击下方按钮继续支付。支付完成后回到租户钱包页刷新订单状态。</p>
      <form id="allinpay-launch-form" method="post" action="${escapeHtml(descriptor.actionUrl)}">
        ${hiddenInputs}
        <div class="actions">
          <button type="submit">继续支付</button>
        </div>
      </form>
    </div>
    <script>
      window.setTimeout(function () {
        var form = document.getElementById("allinpay-launch-form");
        if (form) {
          form.submit();
        }
      }, 80);
    </script>
  </body>
</html>`;
}

export async function queryAllinpayOrder(order, config, fetchImpl = globalThis.fetch) {
  if (!config?.enabled) {
    throw new Error("payment_provider_unavailable");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch_unavailable");
  }
  const fields = {
    version: config.version,
    cusid: config.merchantId,
    appid: config.appId,
    reqsn: normalizeText(order?.id),
    randomstr: buildRandomString(),
    sign_type: config.signType,
  };
  if (normalizeText(order?.providerOrderId)) {
    fields.trxid = normalizeText(order.providerOrderId);
  }
  fields.sign = signAllinpayFields(fields, config);
  const response = await fetchImpl(config.queryUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await response.text();
  const payload = parsePayloadText(text);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payment_query_invalid_response");
  }
  if (normalizeText(payload.sign) && !verifyAllinpayFields(payload, config)) {
    throw new Error("payment_query_invalid_signature");
  }
  return payload;
}

export function normalizeAllinpayNotificationPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      const normalizedValue = value == null ? "" : String(value);
      if (String(key || "").trim() === "sign") {
        return [key, normalizedValue.replace(/ /g, "+")];
      }
      return [key, normalizedValue];
    }),
  );
}

export function getAllinpayOrderReference(payload) {
  return normalizeText(payload?.reqsn || payload?.cusorderid || payload?.order_no);
}

export function getAllinpayProviderOrderId(payload) {
  return normalizeText(payload?.trxid || payload?.provider_order_id);
}

export function mapAllinpayResult(payload) {
  const trxstatus = normalizeText(payload?.trxstatus);
  return {
    providerOrderId: getAllinpayProviderOrderId(payload),
    providerStatus: trxstatus,
    orderStatus: mapProviderStatus(trxstatus),
    retcode: normalizeText(payload?.retcode),
    retmsg: normalizeText(payload?.retmsg || payload?.errmsg),
    paid: trxstatus === "0000",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildQrSvgMarkup(value, options = {}) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error("qr_value_required");
  }
  const margin = Math.max(
    0,
    Number.parseInt(String(options.margin ?? "4"), 10) || 4,
  );
  const dark = normalizeText(options.dark || "#111827") || "#111827";
  const light = normalizeText(options.light || "#ffffff") || "#ffffff";
  const errorLevel =
    QRErrorCorrectLevel[String(options.errorLevel || "M").trim().toUpperCase()] ??
    QRErrorCorrectLevel.M;
  const qrcode = new QRCode(-1, errorLevel);
  qrcode.addData(text);
  qrcode.make();

  const moduleCount = qrcode.getModuleCount();
  const dimension = moduleCount + margin * 2;
  const commands = [];
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qrcode.isDark(row, col)) {
        continue;
      }
      commands.push(`M${col + margin},${row + margin}h1v1h-1z`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges" role="img" aria-label="支付二维码"><rect width="100%" height="100%" fill="${escapeHtml(light)}"/><path d="${commands.join("")}" fill="${escapeHtml(dark)}"/></svg>`;
}

export function buildQrSvgDataUrl(value, options = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildQrSvgMarkup(value, options))}`;
}

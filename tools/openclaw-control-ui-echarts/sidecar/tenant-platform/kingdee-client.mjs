import crypto from "node:crypto";

const TOKEN_CACHE = new Map();
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes

function cacheKey(config) {
  return `${config.serverUrl}::${config.appId}::${config.accountId}`;
}

function encryptSecret(secret, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(encrypted, key) {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedBuf = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
  return Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString("utf8");
}

export function encryptKingdeeSecret(secret, encryptionKey) {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error("encryption_key_too_short");
  }
  const keyHex = crypto.createHash("sha256").update(encryptionKey).digest("hex");
  return encryptSecret(secret, keyHex);
}

export function decryptKingdeeSecret(encrypted, encryptionKey) {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error("encryption_key_too_short");
  }
  const keyHex = crypto.createHash("sha256").update(encryptionKey).digest("hex");
  return decryptSecret(encrypted, keyHex);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`kingdee_invalid_json: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    const msg = data?.Message || data?.message || `HTTP ${response.status}`;
    throw new Error(`kingdee_http_error: ${msg}`);
  }
  return data;
}

export async function authenticate(config) {
  const key = cacheKey(config);
  const cached = TOKEN_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // 金蝶云星空 OpenAPI — AuthService.LoginByAppSecret
  // serverUrl 已包含 /k3cloud 前缀，直接拼接服务路径
  const loginUrl = `${config.serverUrl}/Kingdee.BOS.WebApi.ServicesStub.AuthService.LoginByAppSecret.common.kdsvc`;
  const body = JSON.stringify({
    parameters: [
      config.accountId,
      config.username || "",
      config.appId,
      config.appSecret,
      2052,
    ],
  });

  let token;
  try {
    const result = await fetchJson(loginUrl, { method: "POST", body });
    // LoginResultType: 1 表示成功
    if (result.LoginResultType !== 1 && result.LoginResultType !== "1") {
      throw new Error(`kingdee_auth_failed: ${result.Message || JSON.stringify(result)}`);
    }
    token = result.Context?.SessionId || result.KDSVCSessionId || result.SessionId;
    if (!token) {
      throw new Error("kingdee_auth_failed: no session id in response");
    }
  } catch (err) {
    // mock 模式：当金蝶服务不可用时返回占位 token 用于开发
    if (config.mockMode) {
      token = `mock_token_${Date.now()}`;
    } else {
      throw err;
    }
  }

  TOKEN_CACHE.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function invalidateToken(config) {
  TOKEN_CACHE.delete(cacheKey(config));
}

export async function queryBillData(config, params) {
  if (config.mockMode) {
    return buildMockData(params.FormId, params);
  }

  const token = await authenticate(config);
  const url = `${config.serverUrl}/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc`;
  const body = JSON.stringify({
    data: {
      FormId: params.FormId,
      FieldKeys: params.FieldKeys || "FID",
      FilterString: params.FilterString || "",
      OrderString: params.OrderString || "",
      TopRowCount: params.TopRowCount || 1000,
      StartRow: params.StartRow || 0,
      Limit: params.Limit || 100,
    },
  });

  try {
    return await fetchJson(url, {
      method: "POST",
      body,
      headers: { KDSVCSessionId: token },
    });
  } catch (err) {
    if (String(err.message).includes("401") || String(err.message).includes("session")) {
      invalidateToken(config);
      throw new Error("kingdee_session_expired");
    }
    throw err;
  }
}

export async function executeOperation(config, formId, operationId, dataJson) {
  if (config.mockMode) {
    return { Result: { ResponseStatus: { IsSuccess: true } } };
  }

  const token = await authenticate(config);
  const url = `${config.serverUrl}/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.${operationId}.common.kdsvc`;
  const body = JSON.stringify({ formid: formId, data: dataJson });

  return fetchJson(url, {
    method: "POST",
    body,
    headers: { KDSVCSessionId: token },
  });
}

export async function getReportData(config, reportId, params) {
  if (config.mockMode) {
    return buildMockReportData(reportId, params);
  }

  const token = await authenticate(config);
  const url = `${config.serverUrl}/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc`;

  const formIds = {
    profitLoss: "GL_RPTRPTGAINLOSS",
    balanceSheet: "GL_RPTRPTBALANCE",
    cashFlow: "GL_RPTCASHFLOWSTATEMENT",
    trialBalance: "GL_BALANCESHEET",
    accountsReceivable: "AR_AGEDANALYSIS",
    accountsPayable: "AP_AGEDANALYSIS",
  };

  const formId = formIds[reportId] || reportId;
  const body = JSON.stringify({
    data: {
      FormId: formId,
      FieldKeys: params.fieldKeys || "FID,FDATE,FAMOUNT",
      FilterString: params.filterString || "",
      TopRowCount: params.limit || 500,
    },
  });

  return fetchJson(url, {
    method: "POST",
    body,
    headers: { KDSVCSessionId: token },
  });
}

// ─── Mock 数据（开发/演示模式） ─────────────────────────────────────────────

function buildMockData(formId, params) {
  const count = Math.min(params.Limit || 10, 20);
  const rows = Array.from({ length: count }, (_, i) => ({
    FID: `ID_${i + 1}`,
    FNAME: `项目${i + 1}`,
    FAMOUNT: Math.round(Math.random() * 100000) / 100,
    FDATE: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }));
  return { Result: rows };
}

function buildMockReportData(reportId, params) {
  const mockReports = {
    profitLoss: {
      rows: [
        { item: "营业收入", amount: 1250000 },
        { item: "营业成本", amount: 820000 },
        { item: "毛利润", amount: 430000 },
        { item: "期间费用", amount: 180000 },
        { item: "营业利润", amount: 250000 },
        { item: "净利润", amount: 210000 },
      ],
    },
    balanceSheet: {
      rows: [
        { item: "货币资金", amount: 580000 },
        { item: "应收账款", amount: 320000 },
        { item: "存货", amount: 450000 },
        { item: "固定资产", amount: 1200000 },
        { item: "应付账款", amount: 280000 },
        { item: "所有者权益", amount: 1900000 },
      ],
    },
    accountsReceivable: {
      rows: [
        { customer: "客户A", amount: 85000, aging: "0-30天" },
        { customer: "客户B", amount: 42000, aging: "31-60天" },
        { customer: "客户C", amount: 28000, aging: "61-90天" },
        { customer: "客户D", amount: 15000, aging: "90天以上" },
      ],
    },
    accountsPayable: {
      rows: [
        { supplier: "供应商A", amount: 55000, aging: "0-30天" },
        { supplier: "供应商B", amount: 38000, aging: "31-60天" },
        { supplier: "供应商C", amount: 22000, aging: "61-90天" },
      ],
    },
  };

  return { Result: mockReports[reportId] || { rows: [] } };
}

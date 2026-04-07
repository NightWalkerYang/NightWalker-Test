import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  return Buffer.from(padded, "base64");
}

function normalizeSignature(signature) {
  const value = String(signature || "").trim();
  if (!value) {
    throw new Error("license_signature_missing");
  }
  try {
    return decodeBase64Url(value);
  } catch {
    return Buffer.from(value, "base64");
  }
}

function parseJsonText(text, fallbackError) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(fallbackError);
  }
}

function readPublicKey(config) {
  if (config.localLicensePublicKey) {
    return config.localLicensePublicKey;
  }
  if (config.localLicensePublicKeyPath && fs.existsSync(config.localLicensePublicKeyPath)) {
    return fs.readFileSync(config.localLicensePublicKeyPath, "utf8").trim();
  }
  return "";
}

function parseLicenseInput(input, fallbackError = "license_payload_invalid") {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error(fallbackError);
    }
    if (trimmed.startsWith("{")) {
      return parseJsonText(trimmed, fallbackError);
    }
    const decoded = decodeBase64Url(trimmed).toString("utf8").trim();
    return parseJsonText(decoded, fallbackError);
  }
  if (input && typeof input === "object") {
    return input;
  }
  throw new Error(fallbackError);
}

function readStoredLicense(config) {
  if (!config.localLicensePath || !fs.existsSync(config.localLicensePath)) {
    return null;
  }
  return parseJsonText(fs.readFileSync(config.localLicensePath, "utf8"), "license_file_invalid");
}

function validateLicenseShape(license) {
  if (!license || typeof license !== "object") {
    throw new Error("license_payload_invalid");
  }
  const licenseId = String(license.licenseId || "").trim();
  const customerName = String(license.customerName || "").trim();
  const issuedAt = String(license.issuedAt || "").trim();
  const expiresAt = String(license.expiresAt || "").trim();
  if (!licenseId || !customerName || !issuedAt || !expiresAt) {
    throw new Error("license_required_fields_missing");
  }
  const issuedTimestamp = Date.parse(issuedAt);
  const expiresTimestamp = Date.parse(expiresAt);
  if (Number.isNaN(issuedTimestamp) || Number.isNaN(expiresTimestamp)) {
    throw new Error("license_time_invalid");
  }
  if (expiresTimestamp <= issuedTimestamp) {
    throw new Error("license_expiry_invalid");
  }
  return {
    ...license,
    licenseId,
    customerName,
    issuedAt,
    expiresAt,
    deploymentMode:
      String(license.deploymentMode || "local").trim().toLowerCase() === "cloud" ? "cloud" : "local",
  };
}

function verifyLicenseSignature(license, publicKey) {
  if (!publicKey) {
    throw new Error("license_public_key_missing");
  }
  const signature = normalizeSignature(license.signature);
  const unsigned = { ...license };
  delete unsigned.signature;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(stableStringify(unsigned));
  verifier.end();
  if (!verifier.verify(publicKey, signature)) {
    throw new Error("license_signature_invalid");
  }
  return unsigned;
}

function calculateRemainingDays(expiresAt) {
  const expiresTimestamp = Date.parse(String(expiresAt || ""));
  if (Number.isNaN(expiresTimestamp)) {
    return null;
  }
  const delta = expiresTimestamp - Date.now();
  if (delta <= 0) {
    return 0;
  }
  return Math.ceil(delta / 86_400_000);
}

function summarizeLicense(config, payload) {
  if (config.edition !== "local") {
    return {
      edition: "cloud",
      status: "disabled",
      valid: false,
      readonly: false,
      customerName: null,
      licenseId: null,
      expiresAt: null,
      remainingDays: null,
      sourcePath: null,
      reason: null,
    };
  }

  const publicKey = readPublicKey(config);
  if (!payload) {
    return {
      edition: "local",
      status: "missing",
      valid: false,
      readonly: false,
      customerName: null,
      licenseId: null,
      expiresAt: null,
      remainingDays: null,
      sourcePath: config.localLicensePath,
      reason: "license_missing",
    };
  }

  try {
    const normalized = validateLicenseShape(payload);
    verifyLicenseSignature(normalized, publicKey);
    const remainingDays = calculateRemainingDays(normalized.expiresAt);
    return {
      edition: "local",
      status: remainingDays === 0 ? "expired" : "active",
      valid: true,
      readonly: remainingDays === 0,
      customerName: normalized.customerName,
      licenseId: normalized.licenseId,
      expiresAt: normalized.expiresAt,
      remainingDays,
      sourcePath: config.localLicensePath,
      reason: null,
    };
  } catch (error) {
    return {
      edition: "local",
      status: "invalid",
      valid: false,
      readonly: false,
      customerName: null,
      licenseId: null,
      expiresAt: null,
      remainingDays: null,
      sourcePath: config.localLicensePath,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function readLocalLicenseState(config) {
  return summarizeLicense(config, readStoredLicense(config));
}

export function importLocalLicense(config, input) {
  const license = validateLicenseShape(parseLicenseInput(input));
  verifyLicenseSignature(license, readPublicKey(config));
  fs.mkdirSync(path.dirname(config.localLicensePath), { recursive: true });
  fs.writeFileSync(
    config.localLicensePath,
    `${JSON.stringify(license, null, 2)}\n`,
    "utf8",
  );
  return readLocalLicenseState(config);
}

export function applyLocalRenewalCode(config, renewalCode) {
  return importLocalLicense(config, parseLicenseInput(renewalCode, "renewal_code_invalid"));
}


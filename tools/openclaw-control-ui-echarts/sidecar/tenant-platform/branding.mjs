import fs from "node:fs";
import path from "node:path";
import { ensureTenantPlatformDirs } from "./config.mjs";

const BRANDING_VERSION = 1;
const DEFAULT_BRAND_NAME = "苏博泰克";
const DEFAULT_PAGE_TITLE = "苏博泰克";
const DEFAULT_LOGO_TEXT = "SPTC";
const LOGO_EXTENSION_BY_MIME = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function defaultBrandingBase() {
  return {
    brandName: DEFAULT_BRAND_NAME,
    pageTitle: DEFAULT_PAGE_TITLE,
    logoMode: "text",
    logoText: DEFAULT_LOGO_TEXT,
    logoImage: null,
    revision: "",
    updatedAt: "",
    version: BRANDING_VERSION,
  };
}

export function resolveBrandingPaths(config) {
  const brandingDir = path.join(String(config?.stateDir || ""), "branding");
  return {
    brandingDir,
    brandingFilePath: path.join(brandingDir, "brand.json"),
    brandingAssetDir: path.join(brandingDir, "assets"),
  };
}

function ensureBrandingDir(config) {
  ensureTenantPlatformDirs(config);
  const { brandingDir } = resolveBrandingPaths(config);
  fs.mkdirSync(brandingDir, { recursive: true });
}

function readStoredBranding(config) {
  const { brandingFilePath } = resolveBrandingPaths(config);
  if (!fs.existsSync(brandingFilePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(brandingFilePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function resolveStoredImageAsset(config, stored) {
  const { brandingAssetDir } = resolveBrandingPaths(config);
  const fileName = normalizeText(stored?.logoImage?.fileName);
  const mimeType = normalizeText(stored?.logoImage?.mimeType);
  if (!fileName || !mimeType) {
    return null;
  }
  const filePath = path.join(brandingAssetDir, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return {
    fileName,
    mimeType,
    filePath,
  };
}

function buildPublicLogoSrc(config, revision) {
  return `${String(config?.apiBasePath || "/tenant-platform-api/v1").replace(/\/$/, "")}/public/branding/logo?v=${encodeURIComponent(String(revision || ""))}`;
}

function resolveImageBranding(config, stored) {
  const imageAsset = resolveStoredImageAsset(config, stored);
  if (!imageAsset) {
    return defaultBrandingBase();
  }
  return {
    brandName: normalizeText(stored.brandName, DEFAULT_BRAND_NAME),
    pageTitle: normalizeText(stored.pageTitle, DEFAULT_PAGE_TITLE),
    logoMode: "image",
    logoText: "",
    logoImage: {
      fileName: imageAsset.fileName,
      mimeType: imageAsset.mimeType,
      src: buildPublicLogoSrc(config, stored.revision),
    },
    revision: normalizeText(stored.revision),
    updatedAt: normalizeText(stored.updatedAt),
    version: BRANDING_VERSION,
  };
}

function resolveStoredTextBranding(stored) {
  if (!stored || stored.logoMode !== "text") {
    return defaultBrandingBase();
  }
  return {
    brandName: normalizeText(stored.brandName, DEFAULT_BRAND_NAME),
    pageTitle: normalizeText(stored.pageTitle, DEFAULT_PAGE_TITLE),
    logoMode: "text",
    logoText: normalizeText(stored.logoText, DEFAULT_LOGO_TEXT),
    logoImage: null,
    revision: normalizeText(stored.revision),
    updatedAt: normalizeText(stored.updatedAt),
    version: BRANDING_VERSION,
  };
}

export function readBrandingState(config) {
  const stored = readStoredBranding(config);
  if (stored?.logoMode === "image") {
    return resolveImageBranding(config, stored);
  }
  return resolveStoredTextBranding(stored);
}

function parseDataUrlLogo(value) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("branding_logo_data_invalid");
  }
  const mimeType = String(match[1] || "").toLowerCase();
  const extension = LOGO_EXTENSION_BY_MIME.get(mimeType);
  if (!extension) {
    throw new Error("branding_logo_mime_unsupported");
  }
  return {
    mimeType,
    extension,
    buffer: Buffer.from(String(match[2] || ""), "base64"),
  };
}

export function saveBrandingState(config, input) {
  const logoMode = normalizeText(input?.logoMode, "text");
  ensureBrandingDir(config);
  const { brandingAssetDir, brandingFilePath } = resolveBrandingPaths(config);
  const revision = nowIso();
  const baseState = {
    brandName: normalizeText(input?.brandName, DEFAULT_BRAND_NAME),
    pageTitle: normalizeText(input?.pageTitle, DEFAULT_PAGE_TITLE),
    revision,
    updatedAt: revision,
    version: BRANDING_VERSION,
  };
  let nextState;

  if (logoMode === "image") {
    const stored = readStoredBranding(config);
    const existingImageAsset = resolveStoredImageAsset(config, stored);
    let nextLogoImage;

    if (normalizeText(input?.logoImageDataUrl)) {
      const image = parseDataUrlLogo(input?.logoImageDataUrl);
      fs.rmSync(brandingAssetDir, { recursive: true, force: true });
      fs.mkdirSync(brandingAssetDir, { recursive: true });
      const fileName = `logo.${image.extension}`;
      fs.writeFileSync(path.join(brandingAssetDir, fileName), image.buffer);
      nextLogoImage = {
        fileName,
        mimeType: image.mimeType,
      };
    } else if (input?.keepExistingLogoImage && existingImageAsset) {
      nextLogoImage = {
        fileName: existingImageAsset.fileName,
        mimeType: existingImageAsset.mimeType,
      };
    } else {
      throw new Error("branding_logo_file_required");
    }

    nextState = {
      ...baseState,
      logoMode: "image",
      logoText: "",
      logoImage: nextLogoImage,
    };
  } else {
    fs.rmSync(brandingAssetDir, { recursive: true, force: true });
    nextState = {
      ...baseState,
      logoMode: "text",
      logoText: normalizeText(input?.logoText, DEFAULT_LOGO_TEXT),
      logoImage: null,
    };
  }

  fs.writeFileSync(brandingFilePath, JSON.stringify(nextState, null, 2), "utf8");
  return readBrandingState(config);
}

export function restoreBrandingState(config) {
  const { brandingDir } = resolveBrandingPaths(config);
  fs.rmSync(brandingDir, { recursive: true, force: true });
  return readBrandingState(config);
}

export function readBrandingLogoAsset(config) {
  const stored = readStoredBranding(config);
  if (stored?.logoMode !== "image") {
    return null;
  }
  const imageAsset = resolveStoredImageAsset(config, stored);
  if (!imageAsset) {
    return null;
  }
  return {
    mimeType: imageAsset.mimeType,
    buffer: fs.readFileSync(imageAsset.filePath),
  };
}

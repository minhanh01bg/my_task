import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type Sharp } from "sharp";

// Tat cache file cua libvips ngoai production: tranh EBUSY tren Windows va
// canh bao VipsInterpretation khi hot-reload. Production giu cache cho nhanh.
if (process.env.NODE_ENV !== "production") {
  sharp.cache(false);
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Anh chi dung lam thumbnail trong luoi va bang — 300px la du. */
export const IMAGE_SIZE = 300;

/**
 * Chan "decompression bomb": kich thuoc doc tu header, tu choi truoc khi
 * libvips giai nen. 40 MP du cho anh chup tu dien thoai.
 */
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_INPUT_DIMENSION = 8000;
export const IMAGE_TOO_LARGE_MESSAGE =
  "Ảnh quá lớn: tối đa 8000px mỗi chiều và 40 megapixel.";

/** Dinh dang doc tu noi dung file, khong tin MIME client gui (SVG, TIFF... bi loai). */
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");
const PUBLIC_PREFIX = "/uploads/";

export type SaveImageResult =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

export type OpenImageResult =
  | { ok: true; image: Sharp }
  | { ok: false; reason: "unsupported_format" | "too_large" };

/**
 * Mo anh upload voi gioi han an toan va kiem tra header truoc khi giai nen.
 * Output cua sharp khong mang metadata (EXIF, GPS...) tru khi goi
 * keepMetadata, nen chi can autoOrient de anh dien thoai khong bi xoay.
 */
export async function openUploadedImage(
  input: Buffer,
): Promise<OpenImageResult> {
  // "warning" la muc chat nhat; sharp khuyen dung cho input khong tin cay.
  const image = sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "warning",
    autoOrient: true,
  });

  let format: string | undefined;
  let compression: string | undefined;
  let width = 0;
  let height = 0;
  try {
    ({ format, compression, width = 0, height = 0 } = await image.metadata());
  } catch (error) {
    // limitInputPixels da chan ngay khi doc header, chua giai nen gi.
    const tooLarge =
      error instanceof Error && error.message.includes("pixel limit");
    return { ok: false, reason: tooLarge ? "too_large" : "unsupported_format" };
  }

  // sharp bao AVIF la "heif" + nen av1; HEIC (hevc) van bi loai.
  const isAvif = format === "heif" && compression === "av1";
  if (!isAvif && !ALLOWED_INPUT_FORMATS.has(format ?? "")) {
    return { ok: false, reason: "unsupported_format" };
  }
  if (!width || !height) {
    return { ok: false, reason: "unsupported_format" };
  }
  if (
    width > MAX_INPUT_DIMENSION ||
    height > MAX_INPUT_DIMENSION ||
    width * height > MAX_INPUT_PIXELS
  ) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true, image };
}

/**
 * Resize truoc khi ghi la co y: catalog duoc nap TOAN BO mot lan luc mo ca
 * (Spec 1 muc 4), nen anh goc tu dien thoai se lam quay cham hang chuc giay.
 */
export async function saveProductImage(file: File): Promise<SaveImageResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Ảnh phải ở định dạng JPG, PNG hoặc WEBP" };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Ảnh không được lớn hơn 5MB" };
  }

  const input = Buffer.from(await file.arrayBuffer());

  const opened = await openUploadedImage(input);
  if (!opened.ok) {
    return {
      ok: false,
      message:
        opened.reason === "too_large"
          ? IMAGE_TOO_LARGE_MESSAGE
          : "Không đọc được file ảnh",
    };
  }

  let output: Buffer;
  try {
    output = await opened.image
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return { ok: false, message: "Không đọc được file ảnh" };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const name = `${randomUUID().replaceAll("-", "")}.webp`;
  await writeFile(path.join(UPLOAD_DIR, name), output);

  return { ok: true, imageUrl: `${PUBLIC_PREFIX}${name}` };
}

/**
 * Thay anh nghia la ghi file moi — file cu phai duoc don, neu khong thu muc
 * uploads se phinh mai. Chi xoa trong dung thu muc uploads.
 */
export async function deleteProductImage(
  imageUrl: string | null | undefined,
): Promise<void> {
  if (!imageUrl || !imageUrl.startsWith(PUBLIC_PREFIX)) return;

  const target = path.resolve(UPLOAD_DIR, path.basename(imageUrl));
  if (path.dirname(target) !== UPLOAD_DIR) return;

  await rm(target, { force: true });
}

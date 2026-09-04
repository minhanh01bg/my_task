import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Anh chi dung lam thumbnail trong luoi va bang — 300px la du. */
export const IMAGE_SIZE = 300;

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");
const PUBLIC_PREFIX = "/uploads/";

export type SaveImageResult =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

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

  let output: Buffer;
  try {
    output = await sharp(input)
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

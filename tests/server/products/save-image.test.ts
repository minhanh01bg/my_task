import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import {
  IMAGE_SIZE,
  MAX_IMAGE_BYTES,
  deleteProductImage,
  saveProductImage,
} from "@/server/products/save-image";

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");
const written: string[] = [];

async function pngFile(name = "anh.png"): Promise<File> {
  const buffer = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();

  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}

afterAll(async () => {
  for (const file of written) {
    await rm(path.join(UPLOAD_DIR, path.basename(file)), { force: true });
  }
});

describe("saveProductImage", () => {
  it("tu choi kieu file khong phai anh", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "x.pdf", {
      type: "application/pdf",
    });
    const result = await saveProductImage(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("định dạng");
  });

  it("tu choi file qua co", async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    const file = new File([big], "to.png", { type: "image/png" });
    const result = await saveProductImage(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("5MB");
  });

  it("luu anh hop le thanh webp vuong dung kich thuoc", async () => {
    const result = await saveProductImage(await pngFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    written.push(result.imageUrl);
    expect(result.imageUrl).toMatch(/^\/uploads\/[a-z0-9]+\.webp$/);

    const bytes = await readFile(
      path.join(UPLOAD_DIR, path.basename(result.imageUrl)),
    );
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(IMAGE_SIZE);
    expect(meta.height).toBe(IMAGE_SIZE);
  });

  it("hai lan luu ra hai duong dan khac nhau", async () => {
    const first = await saveProductImage(await pngFile());
    const second = await saveProductImage(await pngFile());
    expect(first.ok && second.ok).toBe(true);
    if (first.ok) written.push(first.imageUrl);
    if (second.ok) written.push(second.imageUrl);
    if (first.ok && second.ok) {
      expect(first.imageUrl).not.toBe(second.imageUrl);
    }
  });
});

describe("deleteProductImage", () => {
  it("xoa duoc anh da luu", async () => {
    const saved = await saveProductImage(await pngFile());
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    await deleteProductImage(saved.imageUrl);
    await expect(
      readFile(path.join(UPLOAD_DIR, path.basename(saved.imageUrl))),
    ).rejects.toThrow();
  });

  it("bo qua duong dan rong", async () => {
    await expect(deleteProductImage(null)).resolves.toBeUndefined();
  });

  it("khong xoa file ngoai thu muc uploads", async () => {
    await expect(
      deleteProductImage("/uploads/../../package.json"),
    ).resolves.toBeUndefined();
    await expect(readFile("package.json")).resolves.toBeTruthy();
  });
});

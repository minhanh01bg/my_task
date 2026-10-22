// @vitest-environment node
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";

import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/products/images/route";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import * as originModule from "@/server/http/origin";

// 1x1 transparent PNG buffer
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/products");
const written: string[] = [];

afterAll(async () => {
  for (const url of written) {
    await rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true });
  }
});

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** PNG whose header claims a huge size but carries almost no pixel data. */
function pngHeaderOnly(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.alloc(0))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function solidImage(
  width: number,
  height: number,
  format: "png" | "avif" | "jpeg",
): Promise<Buffer> {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 200 },
    },
  });
  return format === "png"
    ? image.png().toBuffer()
    : format === "avif"
      ? image.avif().toBuffer()
      : image
          .jpeg()
          .withExif({ IFD0: { Copyright: "secret-owner", Artist: "admin" } })
          .toBuffer();
}

function uploadRequest(bytes: Buffer, headers: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set(
    "image",
    new File([new Uint8Array(bytes)], "upload.bin", { type: "image/png" }),
  );
  return new Request("http://localhost:3000/api/products/images", {
    method: "POST",
    headers,
    body: formData,
  });
}

async function storedMetadata(response: Response) {
  const body = await response.json();
  expect(body.ok).toBe(true);
  written.push(body.url);
  const bytes = await readFile(path.join(UPLOAD_DIR, path.basename(body.url)));
  return sharp(bytes).metadata();
}

describe("POST /api/products/images — kiểm tra upload ảnh an toàn", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("từ chối khi chưa đăng nhập quyền admin", async () => {
    vi.spyOn(requireAdminModule, "hasAdminSession").mockResolvedValue(false);

    const formData = new FormData();
    formData.set(
      "image",
      new File([TINY_PNG], "test.png", { type: "image/png" }),
    );

    const request = new Request("http://localhost:3000/api/products/images", {
      method: "POST",
      body: formData,
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
  });

  it("từ chối file giả mạo định dạng ảnh (nội dung text nhưng khai image/png)", async () => {
    vi.spyOn(requireAdminModule, "hasAdminSession").mockResolvedValue(true);
    vi.spyOn(originModule, "hasSafeMutationOrigin").mockReturnValue(true);

    const fakeImageFile = new File(
      [Buffer.from("This is a text file not an image")],
      "exploit.png",
      { type: "image/png" },
    );

    const formData = new FormData();
    formData.set("image", fakeImageFile);

    const request = new Request("http://localhost:3000/api/products/images", {
      method: "POST",
      body: formData,
    });

    const res = await POST(request);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/không phải là ảnh hợp lệ/i);
  });

  it("chấp nhận ảnh hợp lệ và lưu dưới định dạng webp", async () => {
    vi.spyOn(requireAdminModule, "hasAdminSession").mockResolvedValue(true);
    vi.spyOn(originModule, "hasSafeMutationOrigin").mockReturnValue(true);

    const validImageFile = new File([new Uint8Array(TINY_PNG)], "valid.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.set("image", validImageFile);

    const request = new Request("http://localhost:3000/api/products/images", {
      method: "POST",
      body: formData,
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.url).toMatch(/^\/uploads\/products\/.*\.webp$/);
    written.push(body.url);
  });

  describe("WEB-5: giới hạn kích thước và định dạng", () => {
    beforeEach(() => {
      vi.spyOn(requireAdminModule, "hasAdminSession").mockResolvedValue(true);
      vi.spyOn(originModule, "hasSafeMutationOrigin").mockReturnValue(true);
    });

    it("từ chối Content-Length quá lớn trước khi đọc body", async () => {
      const request = uploadRequest(TINY_PNG, {
        "content-length": String(9 * 1024 * 1024),
      });
      const formDataSpy = vi.spyOn(request, "formData");

      const res = await POST(request);

      expect(res.status).toBe(413);
      expect(formDataSpy).not.toHaveBeenCalled();
      expect(request.bodyUsed).toBe(false);
    });

    it("từ chối ảnh có cạnh lớn hơn 8000px", async () => {
      const res = await POST(uploadRequest(await solidImage(8001, 1, "png")));

      expect(res.status).toBe(413);
      expect((await res.json()).message).toMatch(/quá lớn/);
    });

    it("từ chối ảnh khai quá 40 megapixel mà không giải nén", async () => {
      const res = await POST(uploadRequest(pngHeaderOnly(6500, 6500)));

      expect(res.status).toBe(413);
    });

    it("từ chối SVG dù client khai image/png", async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
      );

      const res = await POST(uploadRequest(svg));

      expect(res.status).toBe(415);
    });

    it("chấp nhận AVIF", async () => {
      const res = await POST(uploadRequest(await solidImage(4, 4, "avif")));

      expect(res.status).toBe(200);
      expect((await storedMetadata(res)).format).toBe("webp");
    });

    it("thu nhỏ ảnh lớn vào khung 2000x2000, giữ tỉ lệ", async () => {
      const res = await POST(
        uploadRequest(await solidImage(2400, 1200, "png")),
      );

      expect(res.status).toBe(200);
      const meta = await storedMetadata(res);
      expect(meta.width).toBe(2000);
      expect(meta.height).toBe(1000);
    });

    it("không phóng to ảnh nhỏ và bỏ EXIF", async () => {
      const res = await POST(uploadRequest(await solidImage(40, 30, "jpeg")));

      expect(res.status).toBe(200);
      const meta = await storedMetadata(res);
      expect(meta.width).toBe(40);
      expect(meta.height).toBe(30);
      expect(meta.exif).toBeUndefined();
    });
  });
});

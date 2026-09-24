// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/products/images/route";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import * as originModule from "@/server/http/origin";

// 1x1 transparent PNG buffer
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

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
  });
});

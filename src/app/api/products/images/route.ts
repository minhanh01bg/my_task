import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { hasSafeMutationOrigin } from "@/server/http/origin";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { ok: false, message: "Yêu cầu quyền quản trị" },
      { status: 401 },
    );
  }

  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: "Nguồn gốc yêu cầu không hợp lệ" },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "Vui lòng chọn một ảnh." },
      { status: 400 },
    );
  }

  const extension = EXTENSIONS[image.type];
  if (!extension) {
    return NextResponse.json(
      { ok: false, message: "Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc GIF." },
      { status: 415 },
    );
  }

  if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { ok: false, message: "Ảnh phải nhỏ hơn 8 MB." },
      { status: 413 },
    );
  }

  const uploadDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "products",
  );
  await mkdir(uploadDirectory, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  await writeFile(
    path.join(uploadDirectory, filename),
    Buffer.from(await image.arrayBuffer()),
  );

  return NextResponse.json({
    ok: true,
    url: `/uploads/products/${filename}`,
  });
}

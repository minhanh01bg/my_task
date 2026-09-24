import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { hasSafeMutationOrigin } from "@/server/http/origin";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

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

  if (
    !image ||
    typeof image !== "object" ||
    !("arrayBuffer" in image) ||
    typeof (image as Blob).arrayBuffer !== "function"
  ) {
    return NextResponse.json(
      { ok: false, message: "Vui lòng chọn một ảnh." },
      { status: 400 },
    );
  }

  const blob = image as Blob;
  if (blob.size === 0 || blob.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { ok: false, message: "Ảnh phải nhỏ hơn 8 MB." },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  // Kiem tra noi dung anh thuc te qua sharp de tranh file gia mao
  let output: Buffer;
  try {
    const img = sharp(buffer);
    const metadata = await img.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp", "gif"].includes(metadata.format)
    ) {
      return NextResponse.json(
        { ok: false, message: "Tệp tải lên không phải là ảnh hợp lệ." },
        { status: 415 },
      );
    }
    output = await img.webp({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Tệp tải lên không phải là ảnh hợp lệ." },
      { status: 415 },
    );
  }

  const uploadDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "products",
  );
  await mkdir(uploadDirectory, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}.webp`;
  await writeFile(path.join(uploadDirectory, filename), output);

  return NextResponse.json({
    ok: true,
    url: `/uploads/products/${filename}`,
  });
}

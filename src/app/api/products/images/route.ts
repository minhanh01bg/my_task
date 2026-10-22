import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readLimitedBody } from "@/server/http/read-limited-body";
import {
  IMAGE_TOO_LARGE_MESSAGE,
  openUploadedImage,
} from "@/server/products/save-image";

// nginx client_max_body_size 10m dựa trên giới hạn này.
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
// Phần bao multipart (boundary, header của part) cộng thêm vào ảnh.
const MAX_REQUEST_BYTES = MAX_IMAGE_SIZE + 64 * 1024;
const MAX_OUTPUT_DIMENSION = 2000;

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

  // Content-Length chỉ chặn sớm; body chunked không khai độ dài bị cắt ngay
  // khi vượt giới hạn, trước khi đệm hết vào bộ nhớ.
  const body = await readLimitedBody(request, MAX_REQUEST_BYTES);
  if (!body.ok) {
    return body.reason === "payload_too_large"
      ? NextResponse.json(
          { ok: false, message: "Ảnh phải nhỏ hơn 8 MB." },
          { status: 413 },
        )
      : NextResponse.json(
          { ok: false, message: "Vui lòng chọn một ảnh." },
          { status: 400 },
        );
  }

  let formData: FormData;
  try {
    formData = await new Response(body.bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Dữ liệu tải lên không hợp lệ." },
      { status: 400 },
    );
  }
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
  const opened = await openUploadedImage(buffer);
  if (!opened.ok) {
    return opened.reason === "too_large"
      ? NextResponse.json(
          { ok: false, message: IMAGE_TOO_LARGE_MESSAGE },
          { status: 413 },
        )
      : NextResponse.json(
          { ok: false, message: "Tệp tải lên không phải là ảnh hợp lệ." },
          { status: 415 },
        );
  }

  let output: Buffer;
  try {
    output = await opened.image
      .resize(MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
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

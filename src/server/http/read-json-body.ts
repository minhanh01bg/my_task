import {
  type ReadLimitedBodyResult,
  readLimitedBody,
} from "@/server/http/read-limited-body";

export interface ReadJsonBodyOptions {
  maxBytes?: number;
  /** MIME essences accepted (lowercase, no parameters). Default: `application/json`. */
  allowedContentTypes?: readonly string[];
}

export type ReadJsonBodyResult<T = unknown> =
  | {
      ok: true;
      data: T;
      bytesRead: number;
    }
  | {
      ok: false;
      status: 400 | 413 | 415;
      error:
        | "invalid_content_type"
        | "payload_too_large"
        | "invalid_json"
        | "stream_error";
      message: string;
    };

type ReadJsonBodyFailure = Extract<ReadJsonBodyResult, { ok: false }>;

const BODY_ERRORS: Record<
  Extract<ReadLimitedBodyResult, { ok: false }>["reason"],
  Omit<ReadJsonBodyFailure, "ok">
> = {
  payload_too_large: {
    status: 413,
    error: "payload_too_large",
    message: "Dữ liệu quá lớn",
  },
  missing_body: {
    status: 400,
    error: "invalid_json",
    message: "Dữ liệu yêu cầu trống",
  },
  stream_error: {
    status: 400,
    error: "stream_error",
    message: "Lỗi đọc dữ liệu yêu cầu",
  },
};

/**
 * MIME essence of a Content-Type header: the `type/subtype` before any
 * parameters, trimmed and lowercased. Substring checks would let
 * `application/jsonx` or `text/plain;application/json` through.
 */
function mimeEssence(contentType: string): string {
  return contentType.split(";", 1)[0].trim().toLowerCase();
}

/**
 * Reads and parses JSON request stream with hard byte limit enforcement
 * (see `readLimitedBody` for the streaming-limit invariant).
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  options: ReadJsonBodyOptions = {},
): Promise<ReadJsonBodyResult<T>> {
  const maxBytes = options.maxBytes ?? 64_000;
  const allowedContentTypes = options.allowedContentTypes ?? [
    "application/json",
  ];

  // 1. Content-Type check (exact MIME essence)
  const contentType = request.headers.get("content-type");
  if (!contentType || !allowedContentTypes.includes(mimeEssence(contentType))) {
    return {
      ok: false,
      status: 415,
      error: "invalid_content_type",
      message: "Định dạng nội dung không được hỗ trợ",
    };
  }

  // 2. Declared Content-Length check, then streamed read with a hard byte cap
  const body = await readLimitedBody(request, maxBytes);
  if (!body.ok) {
    return { ok: false, ...BODY_ERRORS[body.reason] };
  }
  const bytesRead = body.bytes.byteLength;

  // 3. Decode UTF-8 once
  let text: string;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    text = decoder.decode(body.bytes);
  } catch {
    return {
      ok: false,
      status: 400,
      error: "invalid_json",
      message: "Dữ liệu không phải UTF-8 hợp lệ",
    };
  }

  // 4. Parse JSON
  try {
    const data = JSON.parse(text) as T;
    return {
      ok: true,
      data,
      bytesRead,
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "invalid_json",
      message: "JSON không hợp lệ",
    };
  }
}

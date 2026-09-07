export interface ReadJsonBodyOptions {
  maxBytes?: number;
  requiredContentType?: string;
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

/**
 * Reads and parses JSON request stream with hard byte limit enforcement.
 *
 * CRITICAL SECURITY INVARIANT:
 * Declared Content-Length is an optional early check, not the sole enforcement.
 * Streams without Content-Length or chunked streams crossing maxBytes MUST be
 * cancelled immediately to prevent memory exhaustion (DoS).
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  options: ReadJsonBodyOptions = {},
): Promise<ReadJsonBodyResult<T>> {
  const maxBytes = options.maxBytes ?? 64_000;
  const requiredContentType = options.requiredContentType ?? "application/json";

  // 1. Content-Type check
  const contentType = request.headers.get("content-type");
  if (
    !contentType ||
    !contentType.toLowerCase().includes(requiredContentType.toLowerCase())
  ) {
    return {
      ok: false,
      status: 415,
      error: "invalid_content_type",
      message: "Định dạng nội dung không được hỗ trợ",
    };
  }

  // 2. Early rejection if declared Content-Length exceeds maxBytes
  const contentLengthStr = request.headers.get("content-length");
  if (contentLengthStr) {
    const declaredLength = parseInt(contentLengthStr, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        error: "payload_too_large",
        message: "Dữ liệu quá lớn",
      };
    }
  }

  // 3. Read body stream with strict byte counting
  if (!request.body) {
    return {
      ok: false,
      status: 400,
      error: "invalid_json",
      message: "Dữ liệu yêu cầu trống",
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytesRead += value.byteLength;
        if (bytesRead > maxBytes) {
          await reader.cancel("payload_too_large").catch(() => {});
          return {
            ok: false,
            status: 413,
            error: "payload_too_large",
            message: "Dữ liệu quá lớn",
          };
        }
        chunks.push(value);
      }
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: "stream_error",
      message: "Lỗi đọc dữ liệu yêu cầu",
    };
  }

  // 4. Combine chunks and decode UTF-8 once
  const fullBuffer = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    text = decoder.decode(fullBuffer);
  } catch {
    return {
      ok: false,
      status: 400,
      error: "invalid_json",
      message: "Dữ liệu không phải UTF-8 hợp lệ",
    };
  }

  // 5. Parse JSON
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

export type ReadLimitedBodyResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | {
      ok: false;
      reason: "payload_too_large" | "missing_body" | "stream_error";
    };

/**
 * Reads a request body into memory with a hard byte limit.
 *
 * CRITICAL SECURITY INVARIANT:
 * Declared Content-Length is an optional early check, not the sole enforcement.
 * Streams without Content-Length or chunked streams crossing maxBytes MUST be
 * cancelled immediately to prevent memory exhaustion (DoS).
 */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<ReadLimitedBodyResult> {
  // 1. Early rejection if declared Content-Length exceeds maxBytes
  const contentLengthStr = request.headers.get("content-length");
  if (contentLengthStr) {
    const declaredLength = parseInt(contentLengthStr, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, reason: "payload_too_large" };
    }
  }

  // 2. Read body stream with strict byte counting
  if (!request.body) {
    return { ok: false, reason: "missing_body" };
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
          return { ok: false, reason: "payload_too_large" };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, reason: "stream_error" };
  }

  // 3. Combine chunks once
  const bytes = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes };
}

import { describe, expect, it, vi } from "vitest";

import { readJsonBody } from "@/server/http/read-json-body";

function createChunkedRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
): Request & { streamCancelled: boolean } {
  let streamCancelled = false;
  let chunkIndex = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(chunks[chunkIndex++]);
      } else {
        controller.close();
      }
    },
    cancel() {
      streamCancelled = true;
    },
  });

  const req = new Request("https://example.com/api/test", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      ...headers,
    }),
    body: stream,
    // @ts-expect-error duplex required for streaming bodies in node fetch/undici
    duplex: "half",
  });

  return Object.assign(req, {
    get streamCancelled() {
      return streamCancelled;
    },
  });
}

describe("readJsonBody", () => {
  const encoder = new TextEncoder();

  it("rejects an oversized declared Content-Length before reading stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}'));
        controller.close();
      },
    });

    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "64001",
      },
      body: stream,
      // @ts-expect-error duplex
      duplex: "half",
    });

    const getReaderSpy = vi.spyOn(req.body!, "getReader");

    const res = await readJsonBody(req, { maxBytes: 64_000 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(413);
      expect(res.error).toBe("payload_too_large");
    }
    expect(getReaderSpy).not.toHaveBeenCalled();
  });

  it("aborts/cancels chunked streams crossing maxBytes and returns 413", async () => {
    const chunk1 = new Uint8Array(40_000).fill(65); // 40 KB
    const chunk2 = new Uint8Array(30_000).fill(66); // 30 KB -> total 70 KB > 64 KB

    const req = createChunkedRequest([chunk1, chunk2]);

    const origGetReader = req.body!.getReader.bind(req.body!);
    let cancelCalled = false;
    vi.spyOn(req.body!, "getReader").mockImplementation(() => {
      const reader = origGetReader();
      const origCancel = reader.cancel.bind(reader);
      reader.cancel = async (reason) => {
        cancelCalled = true;
        return origCancel(reason);
      };
      return reader;
    });

    const res = await readJsonBody(req, { maxBytes: 64_000 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(413);
      expect(res.error).toBe("payload_too_large");
    }
    expect(cancelCalled).toBe(true);
  });

  it("accepts payloads exactly at the boundary", async () => {
    // Construct a valid JSON object padded to exactly 1,000 bytes
    const prefix = '{"padding":"';
    const suffix = '"}';
    const padLength = 1000 - prefix.length - suffix.length;
    const jsonStr = prefix + "x".repeat(padLength) + suffix;
    const bytes = encoder.encode(jsonStr);
    expect(bytes.byteLength).toBe(1000);

    const req = createChunkedRequest([bytes]);
    const res = await readJsonBody<{ padding: string }>(req, {
      maxBytes: 1000,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.bytesRead).toBe(1000);
      expect(res.data.padding).toBe("x".repeat(padLength));
    }
  });

  it("handles multibyte UTF-8 characters split across chunks", async () => {
    const text = '{"message":"Xin chào Việt Nam 🇻🇳 và thế giới 🌍"}';
    const allBytes = encoder.encode(text);

    // Split in the middle of a multibyte character
    const splitIndex = 25;
    const chunk1 = allBytes.slice(0, splitIndex);
    const chunk2 = allBytes.slice(splitIndex);

    const req = createChunkedRequest([chunk1, chunk2]);
    const res = await readJsonBody<{ message: string }>(req);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.message).toBe("Xin chào Việt Nam 🇻🇳 và thế giới 🌍");
    }
  });

  it("rejects non-JSON content-type with 415", async () => {
    const req = createChunkedRequest([encoder.encode("<xml></xml>")], {
      "content-type": "application/xml",
    });

    const res = await readJsonBody(req);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(415);
      expect(res.error).toBe("invalid_content_type");
    }
  });

  it("rejects malformed JSON with 400", async () => {
    const req = createChunkedRequest([encoder.encode("{ invalid json }")]);

    const res = await readJsonBody(req);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error).toBe("invalid_json");
    }
  });
});

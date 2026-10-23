import { describe, expect, it, vi } from "vitest";

import { normalizeSafePath, redactLogData } from "@/lib/log-redaction";
import { logger } from "@/lib/logger";

describe("Log Redaction and Data Protection (Task 13)", () => {
  it("redacts sensitive keys in deeply nested objects and arrays", () => {
    const sensitivePayload = {
      user: {
        username: "user123",
        password: "SuperSecretPassword123!",
        phone: "0901234567",
        contactPhone: "0987654321",
        deliveryAddress: "123 Đường Nguyễn Huệ, Q.1",
        tokens: {
          sessionToken: "session-token-abc",
          guestToken: "guest-cap-xyz-987",
          receiptNonce: "a".repeat(64),
          recoverySecret: "recovery-secret-123",
        },
      },
      headers: {
        authorization: "Bearer sensitive_jwt_token_here",
        cookie: "customer_session=secret_session; checkout_recovery=secret_rec",
      },
      array: [
        { password: "p1" },
        { address: "private address" },
        "https://example.com/orders/guest/abcdef1234567890abcdef1234567890",
      ],
    };

    const redacted = redactLogData(sensitivePayload) as Record<string, unknown>;

    // User credentials and PII redacted
    const user = redacted.user as Record<string, unknown>;
    expect(user.password).toBe("[REDACTED]");
    expect(user.phone).toBe("[REDACTED]");
    expect(user.contactPhone).toBe("[REDACTED]");
    expect(user.deliveryAddress).toBe("[REDACTED]");

    // Tokens redacted (the whole object under a sensitive key)
    expect(user.tokens).toBe("[REDACTED]");

    // Headers redacted
    const headers = redacted.headers as Record<string, unknown>;
    expect(headers.authorization).toBe("[REDACTED]");
    expect(headers.cookie).toBe("[REDACTED]");

    // Array items redacted
    const arr = redacted.array as Array<unknown>;
    expect((arr[0] as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((arr[1] as Record<string, unknown>).address).toBe("[REDACTED]");
    expect(arr[2]).toContain("/orders/guest/[REDACTED]");
  });

  it("normalizes guest and receipt paths in URLs and strings", () => {
    const guestUrl =
      "https://shop.example.com/orders/guest/32_byte_hex_or_base64_capability_token?ref=email";
    const receiptUrl =
      "https://shop.example.com/order-success/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    expect(normalizeSafePath(guestUrl)).toBe(
      "https://shop.example.com/orders/guest/[REDACTED]",
    );
    expect(normalizeSafePath(receiptUrl)).toBe(
      "https://shop.example.com/order-success/[REDACTED]",
    );
    expect(normalizeSafePath("/orders/guest/secret-token-123")).toBe(
      "/orders/guest/[REDACTED]",
    );
    expect(normalizeSafePath("/order-success/secret-receipt-nonce")).toBe(
      "/order-success/[REDACTED]",
    );
    expect(normalizeSafePath("/shop?query=banh-mi")).toBe(
      "/shop?query=banh-mi",
    );
  });

  it("handles circular references gracefully without crashing or stack overflow", () => {
    const circular: Record<string, unknown> = {
      label: "circular test",
      password: "secret",
    };
    circular.self = circular;

    const result = redactLogData(circular) as Record<string, unknown>;
    expect(result.password).toBe("[REDACTED]");
    expect(result.self).toBe("[CIRCULAR]");
  });

  it("handles hostile throwing getters without throwing exceptions", () => {
    const hostile = {
      label: "hostile object",
      get explode(): string {
        throw new Error("Hostile getter boom!");
      },
    };

    expect(() => redactLogData(hostile)).not.toThrow();
    const result = redactLogData(hostile) as Record<string, unknown>;
    expect(result.label).toBe("hostile object");
    expect(result.explode).toBe("[UNREADABLE]");
  });

  it("redacts Error messages and stacks containing sensitive tokens", () => {
    const sensitiveError = new Error(
      "Failed to connect with token=secret_token_12345 and password=supersecret",
    );
    // Custom error property
    (sensitiveError as unknown as Record<string, unknown>).guestToken =
      "token_xyz";

    const redacted = redactLogData(sensitiveError) as Record<string, unknown>;
    expect(redacted.name).toBe("Error");
    expect(redacted.guestToken).toBe("[REDACTED]");
  });

  it("integrates with logger to automatically sanitize output to console", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    logger.error("checkout_failure", {
      phone: "0901234567",
      customer_session: "super-secret-session",
      error: new Error("Test error"),
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedArg = consoleErrorSpy.mock.calls[0][0] as {
      level: string;
      message: string;
      meta?: { phone: string; customer_session: string };
    };

    expect(loggedArg.meta?.phone).toBe("[REDACTED]");
    expect(loggedArg.meta?.customer_session).toBe("[REDACTED]");

    consoleErrorSpy.mockRestore();
  });
});

describe("WEB-6: log redaction covers PII keys and whole values", () => {
  it("redacts personal data, OTPs, API keys and DSNs by key", () => {
    const redacted = redactLogData({
      email: "khach@example.com",
      customerEmail: "khach@example.com",
      name: "Nguyễn Văn A",
      fullName: "Nguyễn Văn A",
      customerName: "Nguyễn Văn A",
      contact_name: "Nguyễn Văn A",
      note: "Giao sau 5h, gọi trước",
      customerNote: "Nhà hẻm 12",
      otp: "123456",
      otpCode: "123456",
      apiKey: "sk_live_abc",
      api_key: "sk_live_abc",
      dsn: "https://key@o1.ingest.sentry.io/1",
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
      authorization: "Basic YWRtaW46cGFzcw==",
      cookie: "a=b",
      address: "12 Lê Lợi",
    }) as Record<string, unknown>;

    for (const [key, value] of Object.entries(redacted)) {
      expect(value, key).toBe("[REDACTED]");
    }
  });

  it("keeps diagnostic keys that only resemble sensitive words", () => {
    const meta = {
      errorClass: "PrismaClientKnownRequestError",
      errorCode: "P2002",
      errorName: "TypeError",
      productName: "Bánh mì",
      footprint: 3,
      notificationId: "n1",
      status: 500,
    };

    expect(redactLogData(meta)).toEqual(meta);
  });

  it("redacts objects and arrays under a sensitive key as a whole", () => {
    const redacted = redactLogData({
      address: { street: "12 Lê Lợi", ward: "Bến Nghé" },
      notes: ["gọi trước", "để ở bảo vệ"],
      cookies: { customer_session: "abc" },
      session: { id: "s1", role: "admin" },
      customer: { id: "c1", fullName: "Nguyễn Văn A" },
    }) as Record<string, unknown>;

    expect(redacted.address).toBe("[REDACTED]");
    expect(redacted.notes).toBe("[REDACTED]");
    expect(redacted.cookies).toBe("[REDACTED]");
    expect(redacted.session).toBe("[REDACTED]");
    expect(redacted.customer).toEqual({ id: "c1", fullName: "[REDACTED]" });
  });
});

describe("percent-encoded capability paths (WB-1)", () => {
  const TOKEN = "Secret_Guest-Token123";

  it.each([
    `/account/login?next=%2Forders%2Fguest%2F${TOKEN}`,
    `/account/login?next=%2forders%2fguest%2f${TOKEN}&ref=mail`,
    `/login?returnTo=%252Forders%252Fguest%252F${TOKEN}`,
    `/login?redirect=https%3A%2F%2Fshop.vn%2Forders%2Fguest%2F${TOKEN}`,
    `/login?callbackUrl=%2Forder-success%2F${TOKEN}`,
    `/login?next=/orders/guest/${TOKEN}`,
    `/x?ref=%2Forders%2Fguest%2F${TOKEN}#top`,
    `GET /orders%2Fguest%2F${TOKEN} 500`,
  ])("keeps the token out of %s", (input) => {
    const output = normalizeSafePath(input);

    expect(output).not.toContain(TOKEN);
    expect(output).toContain("[REDACTED]");
  });

  it.each(["next", "returnTo", "return_to", "redirect", "callbackUrl"])(
    "drops the value of the redirect-style ?%s= param",
    (param) => {
      expect(
        normalizeSafePath(`/account/login?${param}=%2Faccount%2Forders&x=1`),
      ).toBe(`/account/login?${param}=[REDACTED]&x=1`);
    },
  );

  it("still keeps ordinary query params readable", () => {
    expect(normalizeSafePath("/shop?query=banh-mi&page=2")).toBe(
      "/shop?query=banh-mi&page=2",
    );
  });

  it("redacts the encoded token in logged strings and nested data", () => {
    const redacted = redactLogData({
      message: `redirect to /account/login?next=%2Forders%2Fguest%2F${TOKEN}`,
      urls: [`/x?next=%2Forders%2Fguest%2F${TOKEN}`],
    });

    expect(JSON.stringify(redacted)).not.toContain(TOKEN);
  });
});

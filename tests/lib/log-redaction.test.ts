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

    // Tokens redacted
    const tokens = user.tokens as Record<string, unknown>;
    expect(tokens.sessionToken).toBe("[REDACTED]");
    expect(tokens.guestToken).toBe("[REDACTED]");
    expect(tokens.receiptNonce).toBe("[REDACTED]");
    expect(tokens.recoverySecret).toBe("[REDACTED]");

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
      name: "circular test",
      password: "secret",
    };
    circular.self = circular;

    const result = redactLogData(circular) as Record<string, unknown>;
    expect(result.password).toBe("[REDACTED]");
    expect(result.self).toBe("[CIRCULAR]");
  });

  it("handles hostile throwing getters without throwing exceptions", () => {
    const hostile = {
      name: "hostile object",
      get explode(): string {
        throw new Error("Hostile getter boom!");
      },
    };

    expect(() => redactLogData(hostile)).not.toThrow();
    const result = redactLogData(hostile) as Record<string, unknown>;
    expect(result.name).toBe("hostile object");
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

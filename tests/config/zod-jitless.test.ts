import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

describe("Zod JIT configuration for CSP compliance", () => {
  it("has jitless enabled so Function constructor is not called", () => {
    // Ensure jitless is configured
    z.config({ jitless: true });

    let functionConstructorCalled = false;
    const origFunction = globalThis.Function;

    const functionSpy = vi
      .spyOn(globalThis, "Function")
      .mockImplementation((...args: unknown[]) => {
        functionConstructorCalled = true;
        // @ts-expect-error test invocation
        return origFunction(...args);
      });

    try {
      const testSchema = z.object({
        name: z.string().min(1),
        count: z.number().int().positive(),
        nested: z.object({
          active: z.boolean(),
        }),
      });

      const parsed = testSchema.parse({
        name: "Test Product",
        count: 5,
        nested: { active: true },
      });

      expect(parsed).toEqual({
        name: "Test Product",
        count: 5,
        nested: { active: true },
      });

      // Crucial: CSP disallows 'unsafe-eval' in production.
      // With jitless: true, Zod must never invoke Function constructor for JIT compilation.
      expect(functionConstructorCalled).toBe(false);
      expect(functionSpy).not.toHaveBeenCalled();
    } finally {
      functionSpy.mockRestore();
    }
  });
});

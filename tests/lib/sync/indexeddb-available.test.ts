import { describe, expect, it } from "vitest";

describe("moi truong test", () => {
  it("co indexedDB", () => {
    expect(typeof indexedDB).not.toBe("undefined");
  });
});

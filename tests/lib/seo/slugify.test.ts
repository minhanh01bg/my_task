import { describe, expect, it, vi } from "vitest";

import {
  SLUG_MAX_LENGTH,
  pickUniqueSlug,
  resolveUniqueSlug,
  slugCandidate,
  slugify,
} from "@/lib/seo/slugify";

describe("slugify", () => {
  it.each([
    ["Cà phê Robusta 500g", "ca-phe-robusta-500g"],
    ["Đường Biên Hoà", "duong-bien-hoa"],
    ["  Nhớt Castrol   Power1 (1L)  ", "nhot-castrol-power1-1l"],
    ["Mì Hảo Hảo — tôm chua cay!!", "mi-hao-hao-tom-chua-cay"],
    ["ĐỒ ĂN VẶT", "do-an-vat"],
    ["Bánh quy 3/4 kg", "banh-quy-3-4-kg"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("trả chuỗi rỗng khi không còn ký tự a-z0-9", () => {
    expect(slugify("!!! ###")).toBe("");
    expect(slugify("")).toBe("");
  });

  it(`cắt tối đa ${SLUG_MAX_LENGTH} ký tự và không kết thúc bằng dấu gạch`, () => {
    const slug = slugify(`${"a".repeat(79)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toBe("a".repeat(79));
    expect(slugify("x".repeat(200))).toHaveLength(SLUG_MAX_LENGTH);
  });
});

describe("slugCandidate", () => {
  it("lần 1 giữ nguyên, sau đó thêm hậu tố -2, -3", () => {
    expect(slugCandidate("bugi", 1)).toBe("bugi");
    expect(slugCandidate("bugi", 2)).toBe("bugi-2");
    expect(slugCandidate("bugi", 3)).toBe("bugi-3");
  });

  it("cắt bớt gốc để cả hậu tố vẫn trong giới hạn độ dài", () => {
    const base = "x".repeat(SLUG_MAX_LENGTH);
    const candidate = slugCandidate(base, 12);
    expect(candidate).toHaveLength(SLUG_MAX_LENGTH);
    expect(candidate.endsWith("-12")).toBe(true);
  });
});

describe("pickUniqueSlug", () => {
  it("dùng gốc khi chưa ai giữ", () => {
    expect(pickUniqueSlug("bugi", new Set())).toBe("bugi");
  });

  it("chọn hậu tố nhỏ nhất còn trống", () => {
    expect(pickUniqueSlug("bugi", new Set(["bugi"]))).toBe("bugi-2");
    expect(pickUniqueSlug("bugi", new Set(["bugi", "bugi-2"]))).toBe("bugi-3");
    expect(pickUniqueSlug("bugi", new Set(["bugi", "bugi-3"]))).toBe("bugi-2");
  });
});

describe("resolveUniqueSlug", () => {
  it("dùng fallback khi tên không sinh được slug", async () => {
    const findTaken = vi.fn().mockResolvedValue([]);
    await expect(resolveUniqueSlug("!!!", "san-pham", findTaken)).resolves.toBe(
      "san-pham",
    );
  });

  it("hỏi các slug đã dùng theo tiền tố một lần rồi chọn hậu tố", async () => {
    const findTaken = vi.fn().mockResolvedValue(["bugi-ngk", "bugi-ngk-2"]);
    await expect(
      resolveUniqueSlug("Bugi NGK", "san-pham", findTaken),
    ).resolves.toBe("bugi-ngk-3");
    expect(findTaken).toHaveBeenCalledTimes(1);
    expect(findTaken).toHaveBeenCalledWith("bugi-ngk");
  });
});

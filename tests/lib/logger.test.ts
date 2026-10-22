import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { errorLogFields } from "@/lib/logger";

describe("errorLogFields", () => {
  it("lỗi Prisma: chỉ giữ tên lớp và mã, không giữ message có PII", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed: phone 0901234567, Nguyễn Văn A",
      { code: "P2002", clientVersion: "test" },
    );

    const fields = errorLogFields(error);

    expect(fields).toEqual({
      errorClass: "PrismaClientKnownRequestError",
      errorCode: "P2002",
    });
    expect(JSON.stringify(fields)).not.toContain("0901234567");
  });

  it("lỗi không có mã chỉ trả tên lớp", () => {
    expect(errorLogFields(new TypeError("0901234567"))).toEqual({
      errorClass: "TypeError",
    });
  });

  it("giá trị ném ra không phải Error", () => {
    expect(errorLogFields("0901234567")).toEqual({ errorClass: "string" });
    expect(errorLogFields({ code: 42 })).toEqual({
      errorClass: "object",
      errorCode: "42",
    });
  });
});

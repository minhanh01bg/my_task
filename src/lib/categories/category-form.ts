import { z } from "zod";

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập tên danh mục.")
  .max(120, "Tên danh mục tối đa 120 ký tự.");

export type SaveCategoryResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: { name?: string } };

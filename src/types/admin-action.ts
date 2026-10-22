/** Kết quả server action quản trị; lỗi luôn kèm thông báo tiếng Việt. */
export type AdminActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

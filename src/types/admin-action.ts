/** Kết quả server action quản trị; lỗi luôn kèm thông báo tiếng Việt. */
export type AdminActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

/** Hiện khi action không trả được kết quả (mất mạng, lỗi máy chủ). */
export const ACTION_FAILED_MESSAGE = "Không thực hiện được, vui lòng thử lại.";

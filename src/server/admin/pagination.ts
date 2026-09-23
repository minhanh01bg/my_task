/** Tham so chung cho moi loader danh sach trong /admin. */
export interface ListQuery<TFilters = Record<string, never>> {
  page?: number;
  pageSize?: number;
  q?: string;
  filters?: TFilters;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface PageWindow {
  skip: number;
  take: number;
}

/** `?page=` tu URL: rong, sai dinh dang hay < 1 deu ve trang 1. */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export function totalPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Chay `count` va `findMany` cung luc. Neu trang yeu cau vuot qua trang cuoi
 * (vi du vua xoa bot du lieu) thi doc lai trang cuoi — truong hop hiem, chi
 * ton them mot truy van.
 */
export async function paginate<T>(
  request: { page: number; pageSize: number },
  count: () => PromiseLike<number>,
  find: (window: PageWindow) => PromiseLike<T[]>,
): Promise<PageResult<T>> {
  const pageSize = Math.max(1, Math.floor(request.pageSize));
  const requestedPage = Math.max(1, Math.floor(request.page));

  const [total, items] = await Promise.all([
    count(),
    find({ skip: (requestedPage - 1) * pageSize, take: pageSize }),
  ]);

  const lastPage = totalPageCount(total, pageSize);
  if (requestedPage <= lastPage) {
    return { items, total, page: requestedPage, pageSize };
  }

  if (total === 0) {
    return { items: [], total, page: 1, pageSize };
  }

  const lastItems = await find({
    skip: (lastPage - 1) * pageSize,
    take: pageSize,
  });
  return { items: lastItems, total, page: lastPage, pageSize };
}

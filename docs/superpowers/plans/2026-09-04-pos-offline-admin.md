# POS Offline & Admin Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất Spec 1 — quầy bán được cả khi mất mạng (đơn xếp hàng rồi tự đồng bộ), nhận được chuyển khoản VietQR và ghi nợ, giữ được đơn dở, và chủ cửa hàng quản lý được sản phẩm, đơn hàng, công nợ, báo cáo qua `/admin`.

**Architecture:** Thêm một tầng đồng bộ độc lập (`src/lib/sync/`) đứng giữa UI bán hàng và server — UI chỉ gọi `submitOrder(payload)` và không bao giờ biết mình đang online hay offline. Hàng đợi nằm trong IndexedDB, chống trùng đơn bằng `clientId` mà `createOrder` của Plan 1 đã hỗ trợ sẵn. VietQR sinh ngay trong máy theo chuẩn EMVCo nên mất mạng vẫn hiện được QR. `/admin` là Server Components thuần, không offline, dùng Server Actions cho mọi thao tác ghi.

**Tech Stack:** Kế thừa Plan 1 (Next 16, React 19, TS strict, Tailwind 4, shadcn, Prisma + SQLite, Zod 4, Zustand 5, Vitest 4, Playwright), thêm `idb` (bọc IndexedDB), `qrcode` (vẽ QR), `fake-indexeddb` (test).

**Spec:** `docs/superpowers/specs/2026-09-04-pos-store-design.md` — mục 3 (tầng đồng bộ), 5 (giữ đơn, phím tắt), 6 (thanh toán đầy đủ), 8 (tab quản lý), 10 (xử lý lỗi).

**Kế thừa từ Plan 1:** plan này giả định Plan 1 đã xong và mọi test còn xanh. Các interface dùng lại:

- `formatVnd`, `roundVnd`, `multiplyMoney` — `@/lib/money`
- `calculateCart`, type `CartLine`, `CartTotals` — `@/lib/pricing/*`
- `searchProducts`, `buildSearchText`, `normalize`, type `SearchableProduct` — `@/lib/search/*`
- `createOrder` (idempotent theo `clientId`), type `CreateOrderInput` — `@/server/orders/create-order`
- `prisma` — `@/server/db/prisma`
- `useCartStore` — `@/stores/cart-store`
- `CartPanel`, `ProductSearch`, `CashPaymentDialog`, `PosScreen` — `@/components/pos/*`
- type `CatalogResponse`, `CatalogCategory` — `@/types/catalog`
- `SESSION_COOKIE`, `verifySession` — `@/server/auth/session`

## Global Constraints

- **Tiền là số nguyên VND** ở mọi nơi. Số lượng và tồn kho là số thực.
- **Route và tên code bằng tiếng Anh; mọi chữ hiển thị bằng tiếng Việt.**
- **Không bao giờ chặn việc bán.** Gửi đơn thất bại phải vào hàng đợi và cho bán tiếp — không hiện lỗi chặn màn hình.
- **Không bao giờ từ chối đơn đã thu tiền khách.** Hết hàng vẫn nhận đơn, cho tồn âm, gắn cảnh báo.
- **Client không quyết định số tiền cuối cùng.** Server luôn tính lại bằng `calculateCart`.
- Prefer Server Components; `"use client"` chỉ khi cần. Mọi payload API và Server Action validate bằng Zod.
- Package manager là **pnpm**. Test chỉ đặt trong `tests/**` và `e2e/**`. Alias `@/*` → `./src/*`.
- `/admin/*` **không** offline. Chỉ `/pos` và catalog được service worker cache.

---

## File Structure

**Create — tầng đồng bộ (thuần, testable, không dính React):**
- `src/lib/sync/types.ts` — `QueuedOrder`, `SubmitResult`
- `src/lib/sync/queue.ts` — đọc/ghi hàng đợi trong IndexedDB
- `src/lib/sync/submit.ts` — `submitOrder()`: gửi, thất bại thì xếp hàng
- `src/lib/sync/flush.ts` — `flushQueue()`: đẩy hàng đợi lên server
- `src/lib/sync/catalog-cache.ts` — cache danh mục vào IndexedDB

**Create — VietQR:**
- `src/lib/vietqr/crc.ts` — CRC-16/CCITT-FALSE
- `src/lib/vietqr/build.ts` — dựng payload EMVCo
- `src/lib/vietqr/types.ts` — `BankAccount`, `VietQrInput`

**Create — POS bổ sung:**
- `src/stores/held-orders-store.ts` — giữ đơn
- `src/components/pos/payment-dialog.tsx` — thay `CashPaymentDialog`, gồm cả 3 phương thức
- `src/components/pos/transfer-panel.tsx` — QR + nút "Đã nhận tiền"
- `src/components/pos/debt-panel.tsx` — chọn/tạo khách nợ
- `src/components/pos/held-orders-bar.tsx` — thanh đơn đang giữ
- `src/components/pos/sync-indicator.tsx` — "N đơn chờ đồng bộ"
- `src/components/pos/use-pos-shortcuts.ts` — phím tắt toàn cục
- `src/app/api/customers/route.ts` — tìm/tạo khách

**Create — PWA:**
- `public/manifest.webmanifest`
- `public/sw.js` — service worker

**Create — admin:**
- `src/app/admin/layout.tsx` — sidebar
- `src/app/admin/products/page.tsx` + `product-form.tsx` + `actions.ts`
- `src/app/admin/categories/page.tsx` + `actions.ts`
- `src/app/admin/orders/page.tsx` + `[id]/page.tsx` + `actions.ts`
- `src/app/admin/debts/page.tsx` + `actions.ts`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/settings/page.tsx` + `actions.ts`
- `src/server/products/save-product.ts` — nghiệp vụ lưu sản phẩm (sinh `searchText`)
- `src/server/orders/cancel-order.ts` — huỷ đơn, hoàn tồn kho
- `src/server/settings/store-settings.ts` — đọc/ghi `Setting`
- `src/server/reports/daily-revenue.ts` — báo cáo

**Modify:**
- `package.json` — thêm `idb`, `qrcode`, `fake-indexeddb`
- `src/app/layout.tsx` — link manifest, đăng ký service worker
- `src/components/pos/pos-screen.tsx` — dùng `submitOrder`, thêm giữ đơn / phím tắt / chỉ báo đồng bộ
- `vitest.setup.ts` — nạp `fake-indexeddb`
- `src/types/catalog.ts` — thêm `CustomerOption`

**Test:**
- `tests/lib/vietqr/crc.test.ts`, `tests/lib/vietqr/build.test.ts`
- `tests/lib/sync/queue.test.ts`, `tests/lib/sync/submit.test.ts`, `tests/lib/sync/flush.test.ts`
- `tests/stores/held-orders-store.test.ts`
- `tests/components/pos/payment-dialog.test.tsx`
- `tests/server/products/save-product.test.ts`
- `tests/server/orders/cancel-order.test.ts`
- `tests/server/reports/daily-revenue.test.ts`
- `e2e/pos-offline-sale.spec.ts`, `e2e/admin-products.spec.ts`

Thứ tự: thư viện thuần (VietQR, sync) → store → UI POS → PWA → admin → E2E.

---

## Task 1: Cài phụ thuộc và cấu hình test IndexedDB

**Files:**
- Modify: `package.json`, `vitest.setup.ts`

**Interfaces:**
- Produces: `idb` (bọc IndexedDB có Promise), `qrcode` (vẽ QR ra canvas/dataURL), `fake-indexeddb` (IndexedDB giả cho jsdom)

- [ ] **Step 1: Cài deps**

```bash
pnpm add idb qrcode
pnpm add -D fake-indexeddb @types/qrcode
```

- [ ] **Step 2: Nạp fake-indexeddb vào setup test**

Sửa `vitest.setup.ts` thành:

```ts
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
```

`fake-indexeddb/auto` phải đứng **trước** mọi import khác vì nó gắn `indexedDB` vào global — module nào import lúc nạp sẽ thấy ngay.

- [ ] **Step 3: Xác nhận IndexedDB có trong test**

Tạo `tests/lib/sync/indexeddb-available.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("moi truong test", () => {
  it("co indexedDB", () => {
    expect(typeof indexedDB).not.toBe("undefined");
  });
});
```

Run: `pnpm vitest run tests/lib/sync/indexeddb-available.test.ts`
Expected: PASS.

- [ ] **Step 4: Xác nhận baseline Plan 1 còn xanh**

Run: `pnpm check`
Expected: PASS — toàn bộ test Plan 1 vẫn qua.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.setup.ts tests/lib/sync/indexeddb-available.test.ts
git commit -m "chore: add idb, qrcode and fake-indexeddb"
```

---

## Task 2: CRC-16 cho VietQR

**Files:**
- Create: `src/lib/vietqr/crc.ts`
- Test: `tests/lib/vietqr/crc.test.ts`

**Interfaces:**
- Produces: `crc16CcittFalse(input: string): string` — trả về 4 ký tự hex hoa

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/lib/vietqr/crc.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { crc16CcittFalse } from "@/lib/vietqr/crc";

describe("crc16CcittFalse", () => {
  it("khop vector chuan cua CRC-16/CCITT-FALSE", () => {
    // Vector kiem thu chinh thuc cua thuat toan
    expect(crc16CcittFalse("123456789")).toBe("29B1");
  });

  it("chuoi rong tra ve gia tri khoi tao", () => {
    expect(crc16CcittFalse("")).toBe("FFFF");
  });

  it("luon tra ve dung 4 ky tu hex hoa", () => {
    const result = crc16CcittFalse("DH0001");
    expect(result).toMatch(/^[0-9A-F]{4}$/);
  });

  it("doi mot ky tu thi doi ket qua", () => {
    expect(crc16CcittFalse("DH0001")).not.toBe(crc16CcittFalse("DH0002"));
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/lib/vietqr/crc.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/vietqr/crc.ts`:

```ts
/**
 * CRC-16/CCITT-FALSE — chuan bat buoc cua ma QR EMVCo (VietQR).
 * Khoi tao 0xFFFF, da thuc 0x1021, khong dao bit, khong XOR cuoi.
 */
export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;

  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/lib/vietqr/crc.test.ts`
Expected: PASS — 4 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vietqr/crc.ts tests/lib/vietqr/crc.test.ts
git commit -m "feat(vietqr): add CRC-16/CCITT-FALSE"
```

---

## Task 3: Dựng payload VietQR

**Files:**
- Create: `src/lib/vietqr/types.ts`, `src/lib/vietqr/build.ts`
- Test: `tests/lib/vietqr/build.test.ts`

**Interfaces:**
- Consumes: `crc16CcittFalse` (Task 2)
- Produces:
  - type `BankAccount = { bankBin: string; accountNumber: string; accountName: string }`
  - type `VietQrInput = { account: BankAccount; amount: number; description: string }`
  - `buildVietQrPayload(input: VietQrInput): string`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/lib/vietqr/build.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildVietQrPayload } from "@/lib/vietqr/build";
import { crc16CcittFalse } from "@/lib/vietqr/crc";
import type { BankAccount } from "@/lib/vietqr/types";

const account: BankAccount = {
  bankBin: "970423",
  accountNumber: "0011012345678",
  accountName: "NGUYEN VAN A",
};

describe("buildVietQrPayload", () => {
  it("sinh dung payload da biet truoc", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 400000,
      description: "DH0001",
    });

    expect(payload).toBe(
      "00020101021238570010A00000072701270006970423011300110123456780208QRIBFTTA530370454064000005802VN62100806DH00016304A28F",
    );
  });

  it("CRC cuoi payload luon tu nhat quan", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 123456,
      description: "DH9999",
    });

    const body = payload.slice(0, -4);
    const checksum = payload.slice(-4);
    expect(crc16CcittFalse(body)).toBe(checksum);
  });

  it("mo dau bang payload format 000201 va QR dong 010212", () => {
    const payload = buildVietQrPayload({ account, amount: 1000, description: "DH1" });
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("010212");
  });

  it("chua ma ngan hang va so tai khoan", () => {
    const payload = buildVietQrPayload({ account, amount: 1000, description: "DH1" });
    expect(payload).toContain("970423");
    expect(payload).toContain("0011012345678");
  });

  it("gan so tien vao truong 54 khong co so thap phan", () => {
    const payload = buildVietQrPayload({ account, amount: 400000, description: "DH1" });
    expect(payload).toContain("5406400000");
  });

  it("gan noi dung chuyen khoan la ma don", () => {
    const payload = buildVietQrPayload({ account, amount: 1000, description: "DH1042" });
    expect(payload).toContain("0806DH1042");
  });

  it("bo qua truong so tien khi amount bang 0 (QR tinh)", () => {
    const payload = buildVietQrPayload({ account, amount: 0, description: "DH1" });
    expect(payload).not.toContain("5400");
    expect(payload).toContain("5802VN");
  });

  it("luon ket thuc bang 6304 + 4 ky tu CRC", () => {
    const payload = buildVietQrPayload({ account, amount: 1000, description: "DH1" });
    expect(payload.slice(-8, -4)).toBe("6304");
    expect(payload.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it("do dai truong tu tinh dung khi noi dung dai ngan khac nhau", () => {
    const short = buildVietQrPayload({ account, amount: 1000, description: "DH1" });
    const long = buildVietQrPayload({ account, amount: 1000, description: "DH123456" });
    expect(short).toContain("0803DH1");
    expect(long).toContain("0808DH123456");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/lib/vietqr/build.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết `types.ts`**

Tạo `src/lib/vietqr/types.ts`:

```ts
export interface BankAccount {
  /** Ma BIN 6 chu so cua ngan hang, VD "970423" (TPBank). */
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

export interface VietQrInput {
  account: BankAccount;
  /** So nguyen VND. Bang 0 nghia la QR tinh — khach tu nhap so tien. */
  amount: number;
  /** Noi dung chuyen khoan — dung ma don, VD "DH1042". */
  description: string;
}
```

- [ ] **Step 4: Viết `build.ts`**

Tạo `src/lib/vietqr/build.ts`:

```ts
import { crc16CcittFalse } from "./crc";
import type { VietQrInput } from "./types";

/**
 * Moi truong EMVCo co dang: <id 2 ky tu><do dai 2 chu so><noi dung>.
 * Do dai phai tu tinh nen khong the hardcode chuoi.
 */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

const GUID_VIETQR = "A000000727";
const SERVICE_TRANSFER = "QRIBFTTA";
const CURRENCY_VND = "704";
const COUNTRY_VN = "VN";

/**
 * Dung payload VietQR ngay TRONG MAY theo chuan EMVCo — khong goi API ben ngoai.
 * Nho vay mat mang van hien duoc QR va khach van chuyen khoan duoc.
 */
export function buildVietQrPayload(input: VietQrInput): string {
  const accountInfo =
    field("00", input.account.bankBin) +
    field("01", input.account.accountNumber);

  const merchantAccount =
    field("00", GUID_VIETQR) +
    field("01", accountInfo) +
    field("02", SERVICE_TRANSFER);

  let payload =
    field("00", "01") +
    field("01", "12") +
    field("38", merchantAccount) +
    field("53", CURRENCY_VND);

  if (input.amount > 0) {
    payload += field("54", String(Math.round(input.amount)));
  }

  payload += field("58", COUNTRY_VN);

  if (input.description) {
    payload += field("62", field("08", input.description));
  }

  payload += "6304";

  return payload + crc16CcittFalse(payload);
}
```

Ba chỗ dễ sai:

- `field("01", "12")` là mã QR **động** (một lần dùng). QR tĩnh là `"11"` — ta luôn dùng động vì đã gắn sẵn số tiền.
- `"6304"` phải nối vào **trước** khi tính CRC: chuẩn EMVCo tính checksum trên cả id và độ dài của chính trường CRC.
- Trường `62` là container, bên trong lại là một trường `08` nữa — nên có hai lớp `field()`.

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/lib/vietqr/build.test.ts`
Expected: PASS — 9 test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/vietqr tests/lib/vietqr/build.test.ts
git commit -m "feat(vietqr): build EMVCo payload offline"
```

---

## Task 4: Hàng đợi đơn trong IndexedDB

**Files:**
- Create: `src/lib/sync/types.ts`, `src/lib/sync/queue.ts`
- Test: `tests/lib/sync/queue.test.ts`

**Interfaces:**
- Produces:
  - type `OrderPayload` — đúng shape mà `POST /api/orders` nhận (Plan 1 Task 9)
  - type `QueuedOrder = { clientId: string; payload: OrderPayload; queuedAt: number; attempts: number; lastError: string | null }`
  - `enqueueOrder(payload: OrderPayload): Promise<void>`
  - `listQueuedOrders(): Promise<QueuedOrder[]>` — sắp theo `queuedAt` tăng dần
  - `removeQueuedOrder(clientId: string): Promise<void>`
  - `markQueuedFailure(clientId: string, error: string): Promise<void>`
  - `countQueuedOrders(): Promise<number>`
  - `clearQueue(): Promise<void>` — chỉ dùng trong test

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/lib/sync/queue.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearQueue,
  countQueuedOrders,
  enqueueOrder,
  listQueuedOrders,
  markQueuedFailure,
  removeQueuedOrder,
} from "@/lib/sync/queue";
import type { OrderPayload } from "@/lib/sync/types";

function payload(clientId: string): OrderPayload {
  return {
    clientId,
    channel: "pos",
    lines: [
      {
        productId: "p1",
        name: "Đường trắng",
        unitPrice: 15000,
        originalPrice: 15000,
        quantity: 2,
        discount: 0,
        unit: "kg",
        isService: false,
      },
    ],
    orderDiscount: 0,
    payments: [{ method: "cash", amount: 30000 }],
  };
}

beforeEach(async () => {
  await clearQueue();
});

describe("hang doi don", () => {
  it("hang doi rong luc dau", async () => {
    expect(await countQueuedOrders()).toBe(0);
    expect(await listQueuedOrders()).toEqual([]);
  });

  it("them don vao hang doi", async () => {
    await enqueueOrder(payload("c1"));

    const queued = await listQueuedOrders();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.clientId).toBe("c1");
    expect(queued[0]?.attempts).toBe(0);
    expect(queued[0]?.lastError).toBeNull();
  });

  it("giu dung thu tu ban — don cu dung truoc", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));
    await enqueueOrder(payload("c3"));

    const queued = await listQueuedOrders();
    expect(queued.map((item) => item.clientId)).toEqual(["c1", "c2", "c3"]);
  });

  it("them lai cung clientId khong tao ban ghi thu hai", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c1"));

    expect(await countQueuedOrders()).toBe(1);
  });

  it("xoa don khoi hang doi", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));

    await removeQueuedOrder("c1");

    const queued = await listQueuedOrders();
    expect(queued.map((item) => item.clientId)).toEqual(["c2"]);
  });

  it("xoa don khong ton tai khong nem loi", async () => {
    await expect(removeQueuedOrder("khong-co")).resolves.toBeUndefined();
  });

  it("ghi nhan that bai lam tang so lan thu", async () => {
    await enqueueOrder(payload("c1"));

    await markQueuedFailure("c1", "Mất mạng");
    await markQueuedFailure("c1", "Mất mạng");

    const queued = await listQueuedOrders();
    expect(queued[0]?.attempts).toBe(2);
    expect(queued[0]?.lastError).toBe("Mất mạng");
  });

  it("giu nguyen payload de gui lai y het", async () => {
    await enqueueOrder(payload("c1"));

    const queued = await listQueuedOrders();
    expect(queued[0]?.payload.lines[0]?.name).toBe("Đường trắng");
    expect(queued[0]?.payload.payments[0]?.amount).toBe(30000);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/lib/sync/queue.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết `types.ts`**

Tạo `src/lib/sync/types.ts`:

```ts
export interface OrderPayloadLine {
  productId: string | null;
  name: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  discount: number;
  unit: string;
  isService: boolean;
}

export interface OrderPayloadPayment {
  method: "cash" | "transfer" | "debt";
  amount: number;
  receivedAt?: string | null;
  note?: string | null;
}

/** Dung shape ma POST /api/orders nhan. */
export interface OrderPayload {
  clientId: string;
  channel: "pos" | "online";
  lines: OrderPayloadLine[];
  orderDiscount: number;
  payments: OrderPayloadPayment[];
  customerId?: string | null;
  note?: string | null;
}

export interface QueuedOrder {
  clientId: string;
  payload: OrderPayload;
  queuedAt: number;
  attempts: number;
  lastError: string | null;
}

export interface SubmitResult {
  /** true khi server da nhan don; false khi don nam trong hang doi. */
  synced: boolean;
  order: { code: string; total: number } | null;
}
```

- [ ] **Step 4: Viết `queue.ts`**

Tạo `src/lib/sync/queue.ts`:

```ts
import { openDB, type IDBPDatabase } from "idb";

import type { OrderPayload, QueuedOrder } from "./types";

const DB_NAME = "pos-sync";
const DB_VERSION = 1;
const ORDER_STORE = "queued-orders";
const CATALOG_STORE = "catalog";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getSyncDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        const store = db.createObjectStore(ORDER_STORE, {
          keyPath: "clientId",
        });
        store.createIndex("queuedAt", "queuedAt");
      }
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE);
      }
    },
  });

  return dbPromise;
}

/**
 * Xep don vao hang doi khi khong gui duoc. Khoa la clientId nen goi lai
 * cung mot don khong tao ban ghi thu hai.
 */
export async function enqueueOrder(payload: OrderPayload): Promise<void> {
  const db = await getSyncDb();
  const existing = await db.get(ORDER_STORE, payload.clientId);
  if (existing) return;

  const entry: QueuedOrder = {
    clientId: payload.clientId,
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    lastError: null,
  };

  await db.put(ORDER_STORE, entry);
}

/** Tra ve theo dung thu tu ban — don cu duoc gui truoc. */
export async function listQueuedOrders(): Promise<QueuedOrder[]> {
  const db = await getSyncDb();
  const all = (await db.getAll(ORDER_STORE)) as QueuedOrder[];
  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeQueuedOrder(clientId: string): Promise<void> {
  const db = await getSyncDb();
  await db.delete(ORDER_STORE, clientId);
}

export async function markQueuedFailure(
  clientId: string,
  error: string,
): Promise<void> {
  const db = await getSyncDb();
  const existing = (await db.get(ORDER_STORE, clientId)) as
    | QueuedOrder
    | undefined;
  if (!existing) return;

  await db.put(ORDER_STORE, {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error,
  });
}

export async function countQueuedOrders(): Promise<number> {
  const db = await getSyncDb();
  return db.count(ORDER_STORE);
}

/** Chi dung trong test. */
export async function clearQueue(): Promise<void> {
  const db = await getSyncDb();
  await db.clear(ORDER_STORE);
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/lib/sync/queue.test.ts`
Expected: PASS — 8 test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/types.ts src/lib/sync/queue.ts tests/lib/sync/queue.test.ts
git commit -m "feat(sync): add IndexedDB order queue"
```

---

## Task 5: Gửi đơn với dự phòng offline

Đây là ranh giới then chốt của spec: UI gọi `submitOrder()` và **không biết** mình đang online hay offline.

**Files:**
- Create: `src/lib/sync/submit.ts`
- Test: `tests/lib/sync/submit.test.ts`

**Interfaces:**
- Consumes: `enqueueOrder`, `countQueuedOrders`, `clearQueue` (Task 4), type `OrderPayload`, `SubmitResult` (Task 4)
- Produces: `submitOrder(payload: OrderPayload): Promise<SubmitResult>`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/lib/sync/submit.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearQueue, countQueuedOrders, listQueuedOrders } from "@/lib/sync/queue";
import { submitOrder } from "@/lib/sync/submit";
import type { OrderPayload } from "@/lib/sync/types";

function payload(clientId = "c1"): OrderPayload {
  return {
    clientId,
    channel: "pos",
    lines: [
      {
        productId: "p1",
        name: "Đường trắng",
        unitPrice: 15000,
        originalPrice: 15000,
        quantity: 2,
        discount: 0,
        unit: "kg",
        isService: false,
      },
    ],
    orderDiscount: 0,
    payments: [{ method: "cash", amount: 30000 }],
  };
}

beforeEach(async () => {
  await clearQueue();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitOrder", () => {
  it("gui thanh cong thi khong xep hang doi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ order: { code: "DH0001", total: 30000 }, duplicated: false }),
      }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(true);
    expect(result.order?.code).toBe("DH0001");
    expect(await countQueuedOrders()).toBe(0);
  });

  it("mat mang thi xep hang doi va KHONG nem loi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await submitOrder(payload());

    expect(result.synced).toBe(false);
    expect(result.order).toBeNull();
    expect(await countQueuedOrders()).toBe(1);
  });

  it("server loi 500 thi cung xep hang doi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(false);
    expect(await countQueuedOrders()).toBe(1);
  });

  it("server tu choi 400 thi VAN xep hang doi de nguoi dung xu ly tay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Sản phẩm đã xoá" }),
      }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(false);
    const queued = await listQueuedOrders();
    expect(queued[0]?.lastError).toContain("Sản phẩm đã xoá");
  });

  it("gui dung endpoint va dung payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order: { code: "DH0001", total: 30000 }, duplicated: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitOrder(payload("abc"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/orders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).clientId).toBe("abc");
  });

  it("don trung (duplicated) van coi la thanh cong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ order: { code: "DH0001", total: 30000 }, duplicated: true }),
      }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(true);
    expect(await countQueuedOrders()).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/lib/sync/submit.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/sync/submit.ts`:

```ts
import { enqueueOrder, markQueuedFailure } from "./queue";
import type { OrderPayload, SubmitResult } from "./types";

/**
 * Duong DUY NHAT ma UI ban hang gui don.
 *
 * Ham nay khong bao gio nem loi: mang hong, server hong, hay server tu choi
 * deu ket thuc bang "don da nam an toan trong hang doi". UI chi can biet
 * `synced` de hien chi bao, va van cho ban tiep binh thuong.
 *
 * Chong trung don do server lo qua clientId — gui lai cung payload la an toan.
 */
export async function submitOrder(
  payload: OrderPayload,
): Promise<SubmitResult> {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const body = (await response.json()) as {
        order: { code: string; total: number };
      };
      return { synced: true, order: body.order };
    }

    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message = errorBody?.message ?? `Lỗi máy chủ (${response.status})`;

    await enqueueOrder(payload);
    await markQueuedFailure(payload.clientId, message);

    return { synced: false, order: null };
  } catch (error) {
    await enqueueOrder(payload);
    await markQueuedFailure(
      payload.clientId,
      error instanceof Error ? error.message : "Mất kết nối",
    );

    return { synced: false, order: null };
  }
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/lib/sync/submit.test.ts`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/submit.ts tests/lib/sync/submit.test.ts
git commit -m "feat(sync): add submitOrder with offline fallback"
```

---

## Task 6: Đẩy hàng đợi lên server

**Files:**
- Create: `src/lib/sync/flush.ts`
- Test: `tests/lib/sync/flush.test.ts`

**Interfaces:**
- Consumes: `listQueuedOrders`, `removeQueuedOrder`, `markQueuedFailure` (Task 4)
- Produces: `flushQueue(): Promise<{ sent: number; failed: number }>`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/lib/sync/flush.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushQueue } from "@/lib/sync/flush";
import {
  clearQueue,
  countQueuedOrders,
  enqueueOrder,
  listQueuedOrders,
} from "@/lib/sync/queue";
import type { OrderPayload } from "@/lib/sync/types";

function payload(clientId: string): OrderPayload {
  return {
    clientId,
    channel: "pos",
    lines: [
      {
        productId: "p1",
        name: "Đường trắng",
        unitPrice: 15000,
        originalPrice: 15000,
        quantity: 1,
        discount: 0,
        unit: "kg",
        isService: false,
      },
    ],
    orderDiscount: 0,
    payments: [{ method: "cash", amount: 15000 }],
  };
}

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ order: { code: "DH0001", total: 15000 }, duplicated: false }),
  });
}

beforeEach(async () => {
  await clearQueue();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("flushQueue", () => {
  it("hang doi rong thi khong goi mang", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushQueue();

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("day het don va xoa khoi hang doi", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));
    vi.stubGlobal("fetch", okFetch());

    const result = await flushQueue();

    expect(result.sent).toBe(2);
    expect(await countQueuedOrders()).toBe(0);
  });

  it("gui theo dung thu tu ban", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    await flushQueue();

    const sentIds = fetchMock.mock.calls.map(
      (call) => JSON.parse(call[1].body).clientId,
    );
    expect(sentIds).toEqual(["c1", "c2"]);
  });

  it("van con mat mang thi giu nguyen don trong hang doi", async () => {
    await enqueueOrder(payload("c1"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await flushQueue();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(await countQueuedOrders()).toBe(1);
  });

  it("ghi lai loi va tang so lan thu khi that bai", async () => {
    await enqueueOrder(payload("c1"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Sản phẩm đã xoá" }),
      }),
    );

    await flushQueue();

    const queued = await listQueuedOrders();
    expect(queued[0]?.attempts).toBe(1);
    expect(queued[0]?.lastError).toContain("Sản phẩm đã xoá");
  });

  it("mot don loi khong chan cac don sau", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: { code: "DH0002", total: 15000 }, duplicated: false }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushQueue();

    expect(result).toEqual({ sent: 1, failed: 1 });
    const queued = await listQueuedOrders();
    expect(queued.map((item) => item.clientId)).toEqual(["c1"]);
  });

  it("don server bao trung van duoc xoa khoi hang doi", async () => {
    await enqueueOrder(payload("c1"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ order: { code: "DH0001", total: 15000 }, duplicated: true }),
      }),
    );

    const result = await flushQueue();

    expect(result.sent).toBe(1);
    expect(await countQueuedOrders()).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/lib/sync/flush.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/sync/flush.ts`:

```ts
import {
  listQueuedOrders,
  markQueuedFailure,
  removeQueuedOrder,
} from "./queue";

/**
 * Day toan bo hang doi len server, theo dung thu tu ban.
 *
 * Mot don that bai KHONG chan cac don sau — moi don doc lap, va server
 * chong trung bang clientId nen gui lai bao nhieu lan cung an toan.
 *
 * Don loi nghiep vu (san pham da xoa) duoc GIU LAI kem lastError de chu
 * cua hang xu ly tay — khong bao gio tu y bo don da thu tien khach.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const queued = await listQueuedOrders();

  let sent = 0;
  let failed = 0;

  for (const entry of queued) {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.payload),
      });

      if (response.ok) {
        await removeQueuedOrder(entry.clientId);
        sent += 1;
        continue;
      }

      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      await markQueuedFailure(
        entry.clientId,
        body?.message ?? `Lỗi máy chủ (${response.status})`,
      );
      failed += 1;
    } catch (error) {
      await markQueuedFailure(
        entry.clientId,
        error instanceof Error ? error.message : "Mất kết nối",
      );
      failed += 1;
    }
  }

  return { sent, failed };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/lib/sync/flush.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/flush.ts tests/lib/sync/flush.test.ts
git commit -m "feat(sync): add queue flush with per-order isolation"
```

---

## Task 7: Cache danh mục và giữ đơn

**Files:**
- Create: `src/lib/sync/catalog-cache.ts`, `src/stores/held-orders-store.ts`
- Test: `tests/stores/held-orders-store.test.ts`

**Interfaces:**
- Consumes: `getSyncDb` (Task 4), type `CatalogResponse` (Plan 1), type `CartLine` (Plan 1)
- Produces:
  - `saveCatalog(catalog: CatalogResponse): Promise<void>`
  - `loadCatalog(): Promise<CatalogResponse | null>`
  - `isCatalogStale(catalog: CatalogResponse): boolean` — cũ hơn 24 giờ
  - `useHeldOrdersStore` với `hold(lines, orderDiscount)`, `resume(id)`, `discard(id)`, state `held: HeldOrder[]`
  - type `HeldOrder = { id: string; lines: CartLine[]; orderDiscount: number; heldAt: number; total: number }`

- [ ] **Step 1: Viết test thất bại cho giữ đơn**

Tạo `tests/stores/held-orders-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import type { CartLine } from "@/lib/pricing/types";
import { useHeldOrdersStore } from "@/stores/held-orders-store";

function line(name = "Đường trắng", unitPrice = 15000): CartLine {
  return {
    id: crypto.randomUUID(),
    productId: "p1",
    name,
    unitPrice,
    originalPrice: unitPrice,
    quantity: 1,
    discount: 0,
    unit: "kg",
    isService: false,
  };
}

beforeEach(() => {
  useHeldOrdersStore.setState({ held: [] });
});

describe("giu don", () => {
  it("ban dau khong co don nao duoc giu", () => {
    expect(useHeldOrdersStore.getState().held).toEqual([]);
  });

  it("giu mot don", () => {
    useHeldOrdersStore.getState().hold([line()], 0);

    const { held } = useHeldOrdersStore.getState();
    expect(held).toHaveLength(1);
    expect(held[0]?.lines).toHaveLength(1);
    expect(held[0]?.total).toBe(15000);
  });

  it("giu don rong bi bo qua", () => {
    useHeldOrdersStore.getState().hold([], 0);
    expect(useHeldOrdersStore.getState().held).toHaveLength(0);
  });

  it("giu nhieu don cung luc", () => {
    useHeldOrdersStore.getState().hold([line("Đường trắng")], 0);
    useHeldOrdersStore.getState().hold([line("Nhớt Castrol")], 0);

    expect(useHeldOrdersStore.getState().held).toHaveLength(2);
  });

  it("tinh tong tien cua don giu de hien tren thanh", () => {
    useHeldOrdersStore.getState().hold([line("A", 15000), line("B", 25000)], 0);
    expect(useHeldOrdersStore.getState().held[0]?.total).toBe(40000);
  });

  it("mo lai don thi tra ve noi dung va xoa khoi danh sach giu", () => {
    useHeldOrdersStore.getState().hold([line()], 5000);
    const id = useHeldOrdersStore.getState().held[0]!.id;

    const resumed = useHeldOrdersStore.getState().resume(id);

    expect(resumed?.lines).toHaveLength(1);
    expect(resumed?.orderDiscount).toBe(5000);
    expect(useHeldOrdersStore.getState().held).toHaveLength(0);
  });

  it("mo lai id khong ton tai tra ve null", () => {
    expect(useHeldOrdersStore.getState().resume("khong-co")).toBeNull();
  });

  it("bo mot don dang giu", () => {
    useHeldOrdersStore.getState().hold([line()], 0);
    const id = useHeldOrdersStore.getState().held[0]!.id;

    useHeldOrdersStore.getState().discard(id);

    expect(useHeldOrdersStore.getState().held).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/stores/held-orders-store.test.ts`
Expected: FAIL — không tìm thấy store.

- [ ] **Step 3: Viết `held-orders-store.ts`**

Tạo `src/stores/held-orders-store.ts`:

```ts
import { create } from "zustand";

import { calculateCart } from "@/lib/pricing/calculate";
import type { CartLine } from "@/lib/pricing/types";

export interface HeldOrder {
  id: string;
  lines: CartLine[];
  orderDiscount: number;
  heldAt: number;
  total: number;
}

interface HeldOrdersState {
  held: HeldOrder[];
  hold: (lines: CartLine[], orderDiscount: number) => void;
  resume: (id: string) => HeldOrder | null;
  discard: (id: string) => void;
}

/**
 * Giu don de tinh nhanh cho khach khac roi quay lai — VD khach bo quen vi,
 * hoac dang tinh do thi co khach sua xe can tra tien gap.
 *
 * Don giu chi nam trong may, chua len server.
 */
export const useHeldOrdersStore = create<HeldOrdersState>((set, get) => ({
  held: [],

  hold: (lines, orderDiscount) => {
    if (lines.length === 0) return;

    const totals = calculateCart(lines, orderDiscount);

    set((state) => ({
      held: [
        ...state.held,
        {
          id: crypto.randomUUID(),
          lines,
          orderDiscount,
          heldAt: Date.now(),
          total: totals.total,
        },
      ],
    }));
  },

  resume: (id) => {
    const found = get().held.find((order) => order.id === id);
    if (!found) return null;

    set((state) => ({ held: state.held.filter((order) => order.id !== id) }));
    return found;
  },

  discard: (id) =>
    set((state) => ({ held: state.held.filter((order) => order.id !== id) })),
}));
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/stores/held-orders-store.test.ts`
Expected: PASS — 8 test.

- [ ] **Step 5: Viết `catalog-cache.ts`**

Tạo `src/lib/sync/catalog-cache.ts`:

```ts
import type { CatalogResponse } from "@/types/catalog";

import { getSyncDb } from "./queue";

const CATALOG_STORE = "catalog";
const CATALOG_KEY = "current";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Luu danh muc de mat mang van tim va ban duoc. */
export async function saveCatalog(catalog: CatalogResponse): Promise<void> {
  const db = await getSyncDb();
  await db.put(CATALOG_STORE, catalog, CATALOG_KEY);
}

export async function loadCatalog(): Promise<CatalogResponse | null> {
  const db = await getSyncDb();
  const cached = (await db.get(CATALOG_STORE, CATALOG_KEY)) as
    | CatalogResponse
    | undefined;
  return cached ?? null;
}

/**
 * Danh muc cu hon 24 gio thi nhac lam moi — nhung VAN CHO BAN.
 * Chan ban vi danh muc cu la vi pham nguyen tac "khong chan viec ban".
 */
export function isCatalogStale(catalog: CatalogResponse): boolean {
  const fetchedAt = new Date(catalog.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return true;
  return Date.now() - fetchedAt > STALE_AFTER_MS;
}
```

- [ ] **Step 6: Viết test cho catalog cache**

Thêm vào cuối `tests/lib/sync/queue.test.ts`:

```ts
describe("cache danh muc", () => {
  it("luu roi doc lai duoc", async () => {
    const { saveCatalog, loadCatalog } = await import("@/lib/sync/catalog-cache");

    await saveCatalog({
      categories: [{ id: "c1", name: "Tạp hoá", sortOrder: 1 }],
      products: [],
      fetchedAt: new Date().toISOString(),
    });

    const loaded = await loadCatalog();
    expect(loaded?.categories[0]?.name).toBe("Tạp hoá");
  });

  it("danh muc moi khong bi coi la cu", async () => {
    const { isCatalogStale } = await import("@/lib/sync/catalog-cache");

    expect(
      isCatalogStale({
        categories: [],
        products: [],
        fetchedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it("danh muc qua 24 gio bi coi la cu", async () => {
    const { isCatalogStale } = await import("@/lib/sync/catalog-cache");

    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(
      isCatalogStale({ categories: [], products: [], fetchedAt: yesterday }),
    ).toBe(true);
  });
});
```

- [ ] **Step 7: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/lib/sync tests/stores`
Expected: PASS — toàn bộ, gồm 3 test cache mới.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sync/catalog-cache.ts src/stores/held-orders-store.ts tests/stores/held-orders-store.test.ts tests/lib/sync/queue.test.ts
git commit -m "feat(sync): add catalog cache and held orders"
```

---

## Task 8: API khách hàng

**Files:**
- Create: `src/app/api/customers/route.ts`
- Modify: `src/types/catalog.ts`

**Interfaces:**
- Consumes: `prisma` (Plan 1)
- Produces:
  - type `CustomerOption = { id: string; name: string; phone: string | null }`
  - `GET /api/customers?q=<tên>` → `{ customers: CustomerOption[] }`
  - `POST /api/customers` body `{ name, phone? }` → `{ customer: CustomerOption }`

- [ ] **Step 1: Thêm type**

Thêm vào cuối `src/types/catalog.ts`:

```ts
export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}
```

- [ ] **Step 2: Viết route**

Tạo `src/app/api/customers/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import type { CustomerOption } from "@/types/catalog";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const customers = await prisma.customer.findMany({
    where: query ? { name: { contains: query } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, phone: true },
  });

  return NextResponse.json({ customers: customers satisfies CustomerOption[] });
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ message: "Thiếu tên khách" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
    select: { id: true, name: true, phone: true },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
```

- [ ] **Step 3: Kiểm tra bằng tay**

```bash
pnpm dev
```

Đăng nhập rồi mở `http://localhost:3000/api/customers` → `{"customers":[]}`.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/customers src/types/catalog.ts
git commit -m "feat(api): add customer lookup and create"
```

---

## Task 9: Hộp thoại thanh toán đầy đủ

Thay `CashPaymentDialog` của Plan 1 bằng hộp thoại ba tab: tiền mặt, chuyển khoản, ghi nợ — cộng trả kết hợp.

**Files:**
- Create: `src/components/pos/transfer-panel.tsx`, `src/components/pos/debt-panel.tsx`, `src/components/pos/payment-dialog.tsx`
- Test: `tests/components/pos/payment-dialog.test.tsx`
- Delete: `src/components/pos/cash-payment-dialog.tsx`, `tests/components/pos/cash-payment-dialog.test.tsx`

**Interfaces:**
- Consumes: `formatVnd` (Plan 1), `buildVietQrPayload` + type `BankAccount` (Task 3), type `CustomerOption` (Task 8), type `OrderPayloadPayment` (Task 4)
- Produces:
  - `<PaymentDialog open total bankAccount onCancel onConfirm />`
  - `onConfirm: (result: { payments: OrderPayloadPayment[]; customerId: string | null; received: number }) => void`
  - `<TransferPanel amount description bankAccount />`
  - `<DebtPanel selected onSelect />`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/components/pos/payment-dialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PaymentDialog } from "@/components/pos/payment-dialog";
import type { BankAccount } from "@/lib/vietqr/types";

const account: BankAccount = {
  bankBin: "970423",
  accountNumber: "0011012345678",
  accountName: "NGUYEN VAN A",
};

function renderDialog(props: Partial<React.ComponentProps<typeof PaymentDialog>> = {}) {
  return render(
    <PaymentDialog
      open
      total={400000}
      orderCode="DH0001"
      bankAccount={account}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />,
  );
}

describe("PaymentDialog", () => {
  it("mac dinh mo tab tien mat", () => {
    renderDialog();
    expect(screen.getByLabelText(/tiền khách đưa/i)).toBeInTheDocument();
  });

  it("hien tong tien phai tra", () => {
    renderDialog();
    expect(screen.getByTestId("payment-total")).toHaveTextContent("400.000");
  });

  it("tinh tien thoi lai o tab tien mat", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "500000");

    expect(screen.getByTestId("payment-change")).toHaveTextContent("100.000");
  });

  it("xac nhan tien mat tra ve mot khoan thanh toan cash", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "500000");
    await user.click(screen.getByRole("button", { name: /^xác nhận/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result = onConfirm.mock.calls[0]![0];
    expect(result.payments).toEqual([{ method: "cash", amount: 400000 }]);
    expect(result.received).toBe(500000);
  });

  it("chuyen sang tab chuyen khoan thi hien ma QR", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));

    expect(await screen.findByTestId("vietqr-canvas")).toBeInTheDocument();
  });

  it("tab chuyen khoan hien noi dung chuyen khoan la ma don", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));

    expect(screen.getByText(/DH0001/)).toBeInTheDocument();
  });

  it("chua cau hinh ngan hang thi bao chua cau hinh", async () => {
    const user = userEvent.setup();
    renderDialog({ bankAccount: null });

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));

    expect(screen.getByText(/chưa cấu hình tài khoản/i)).toBeInTheDocument();
  });

  it("bam Da nhan tien tra ve khoan transfer co receivedAt", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));
    await user.click(screen.getByRole("button", { name: /đã nhận tiền/i }));

    const result = onConfirm.mock.calls[0]![0];
    expect(result.payments[0]?.method).toBe("transfer");
    expect(result.payments[0]?.amount).toBe(400000);
    expect(result.payments[0]?.receivedAt).toBeTruthy();
  });

  it("bam Chua nhan duoc tien tra ve transfer khong co receivedAt", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));
    await user.click(screen.getByRole("button", { name: /chưa nhận được tiền/i }));

    const result = onConfirm.mock.calls[0]![0];
    expect(result.payments[0]?.method).toBe("transfer");
    expect(result.payments[0]?.receivedAt).toBeNull();
  });

  it("tab ghi no bat buoc chon khach truoc khi xac nhan", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: /ghi nợ/i }));

    expect(screen.getByRole("button", { name: /^xác nhận/i })).toBeDisabled();
  });

  it("dong khi open la false", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("payment-total")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/components/pos/payment-dialog.test.tsx`
Expected: FAIL — không tìm thấy component.

- [ ] **Step 3: Viết `transfer-panel.tsx`**

```tsx
"use client";

import QRCode from "qrcode";
import { useEffect, useRef } from "react";

import { formatVnd } from "@/lib/money";
import { buildVietQrPayload } from "@/lib/vietqr/build";
import type { BankAccount } from "@/lib/vietqr/types";

interface TransferPanelProps {
  amount: number;
  description: string;
  bankAccount: BankAccount | null;
}

/**
 * QR sinh ngay trong may — mat mang van hien duoc va khach van chuyen khoan duoc.
 */
export function TransferPanel({
  amount,
  description,
  bankAccount,
}: TransferPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!bankAccount || !canvasRef.current) return;

    const payload = buildVietQrPayload({
      account: bankAccount,
      amount,
      description,
    });

    void QRCode.toCanvas(canvasRef.current, payload, { width: 260, margin: 1 });
  }, [amount, description, bankAccount]);

  if (!bankAccount) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Chưa cấu hình tài khoản ngân hàng. Vào Quản lý → Cài đặt để khai báo.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} data-testid="vietqr-canvas" />
      <div className="text-center">
        <p className="text-2xl font-bold tabular-nums">{formatVnd(amount)}</p>
        <p className="text-sm text-muted-foreground">
          Nội dung: <span className="font-medium">{description}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {bankAccount.accountName} — {bankAccount.accountNumber}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Viết `debt-panel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CustomerOption } from "@/types/catalog";

interface DebtPanelProps {
  selected: CustomerOption | null;
  onSelect: (customer: CustomerOption | null) => void;
}

/** Khach quen mua chiu — go ten la goi y khach cu, khong co thi tao ngay. */
export function DebtPanel({ selected, onSelect }: DebtPanelProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await fetch(
        `/api/customers?q=${encodeURIComponent(query.trim())}`,
      ).catch(() => null);
      if (!response?.ok || cancelled) return;

      const body = (await response.json()) as { customers: CustomerOption[] };
      setOptions(body.customers);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function createCustomer() {
    setCreating(true);
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim() }),
    }).catch(() => null);
    setCreating(false);

    if (!response?.ok) return;

    const body = (await response.json()) as { customer: CustomerOption };
    onSelect(body.customer);
    setQuery("");
    setOptions([]);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <span className="text-lg font-medium">{selected.name}</span>
        <Button variant="outline" onClick={() => onSelect(null)}>
          Đổi khách
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label="Tên khách nợ"
        value={query}
        autoFocus
        placeholder="Tên khách nợ"
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded border px-4 py-3 text-lg"
      />

      <ul className="flex flex-col gap-1">
        {options.map((customer) => (
          <li key={customer.id}>
            <button
              type="button"
              onClick={() => onSelect(customer)}
              className="w-full rounded px-4 py-3 text-left hover:bg-accent"
            >
              {customer.name}
              {customer.phone ? (
                <span className="ml-2 text-sm text-muted-foreground">
                  {customer.phone}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {query.trim().length > 0 && options.length === 0 ? (
        <Button variant="outline" disabled={creating} onClick={createCustomer}>
          {creating ? "Đang tạo..." : `Tạo khách mới "${query.trim()}"`}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Viết `payment-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";

import { DebtPanel } from "@/components/pos/debt-panel";
import { TransferPanel } from "@/components/pos/transfer-panel";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import type { OrderPayloadPayment } from "@/lib/sync/types";
import type { BankAccount } from "@/lib/vietqr/types";
import { cn } from "@/lib/utils";
import type { CustomerOption } from "@/types/catalog";

type Method = "cash" | "transfer" | "debt";

export interface PaymentResult {
  payments: OrderPayloadPayment[];
  customerId: string | null;
  received: number;
}

interface PaymentDialogProps {
  open: boolean;
  total: number;
  orderCode: string;
  bankAccount: BankAccount | null;
  onCancel: () => void;
  onConfirm: (result: PaymentResult) => void;
}

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

const TABS: Array<{ value: Method; label: string }> = [
  { value: "cash", label: "Tiền mặt" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "debt", label: "Ghi nợ" },
];

export function PaymentDialog({
  open,
  total,
  orderCode,
  bankAccount,
  onCancel,
  onConfirm,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<Method>("cash");
  const [received, setReceived] = useState("");
  const [customer, setCustomer] = useState<CustomerOption | null>(null);

  if (!open) return null;

  const receivedValue = Math.round(Number(received) || 0);
  const change = Math.max(0, receivedValue - total);
  const cashEnough = receivedValue >= total;

  function confirmCash() {
    onConfirm({
      payments: [{ method: "cash", amount: total }],
      customerId: null,
      received: receivedValue,
    });
  }

  function confirmTransfer(receivedNow: boolean) {
    onConfirm({
      payments: [
        {
          method: "transfer",
          amount: total,
          receivedAt: receivedNow ? new Date().toISOString() : null,
        },
      ],
      customerId: null,
      received: total,
    });
  }

  function confirmDebt() {
    if (!customer) return;
    onConfirm({
      payments: [{ method: "debt", amount: total }],
      customerId: customer.id,
      received: 0,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-lg">Khách phải trả</span>
          <span data-testid="payment-total" className="text-3xl font-bold tabular-nums">
            {formatVnd(total)}
          </span>
        </div>

        <div role="tablist" className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={method === tab.value}
              onClick={() => setMethod(tab.value)}
              className={cn(
                "flex-1 rounded-lg px-4 py-3 text-base",
                method === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-muted-foreground">Tiền khách đưa</span>
              <input
                aria-label="Tiền khách đưa"
                type="number"
                min="0"
                autoFocus
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                className="mt-1 w-full rounded border px-4 py-4 text-right text-2xl tabular-nums"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  onClick={() => setReceived(String(amount))}
                >
                  {formatVnd(amount)}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="col-span-2"
                onClick={() => setReceived(String(total))}
              >
                Đúng số tiền
              </Button>
            </div>

            <div className="flex items-baseline justify-between rounded-lg bg-accent p-4">
              <span className="text-lg">Tiền thối lại</span>
              <span data-testid="payment-change" className="text-5xl font-bold tabular-nums">
                {formatVnd(change)}
              </span>
            </div>
          </div>
        ) : null}

        {method === "transfer" ? (
          <TransferPanel
            amount={total}
            description={orderCode}
            bankAccount={bankAccount}
          />
        ) : null}

        {method === "debt" ? (
          <DebtPanel selected={customer} onSelect={setCustomer} />
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-14 flex-1" onClick={onCancel}>
            Huỷ
          </Button>

          {method === "transfer" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-14 flex-1"
                onClick={() => confirmTransfer(false)}
              >
                Chưa nhận được tiền
              </Button>
              <Button
                type="button"
                className="h-14 flex-1 text-lg"
                onClick={() => confirmTransfer(true)}
              >
                Đã nhận tiền
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-14 flex-1 text-lg"
              disabled={method === "cash" ? !cashEnough : !customer}
              onClick={method === "cash" ? confirmCash : confirmDebt}
            >
              Xác nhận
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Xoá hộp thoại cũ của Plan 1**

```bash
rm src/components/pos/cash-payment-dialog.tsx tests/components/pos/cash-payment-dialog.test.tsx
```

- [ ] **Step 7: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/components/pos/payment-dialog.test.tsx`
Expected: PASS — 11 test.

`qrcode` vẽ lên canvas mà jsdom không có `getContext("2d")` thật. Nếu test QR báo lỗi canvas, thêm vào đầu file test:

```ts
vi.mock("qrcode", () => ({
  default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}));
```

Test chỉ cần khẳng định canvas được render và nội dung chuyển khoản đúng — việc vẽ pixel đã được `qrcode` tự test.

- [ ] **Step 8: Commit**

```bash
git add src/components/pos/payment-dialog.tsx src/components/pos/transfer-panel.tsx src/components/pos/debt-panel.tsx tests/components/pos/payment-dialog.test.tsx
git rm --cached src/components/pos/cash-payment-dialog.tsx tests/components/pos/cash-payment-dialog.test.tsx 2>/dev/null || true
git add -A
git commit -m "feat(pos): add full payment dialog with VietQR and debt"
```

---

## Task 10: Chỉ báo đồng bộ, thanh giữ đơn, phím tắt

**Files:**
- Create: `src/components/pos/sync-indicator.tsx`, `src/components/pos/held-orders-bar.tsx`, `src/components/pos/use-pos-shortcuts.ts`
- Modify: `src/components/pos/pos-screen.tsx`, `src/app/pos/page.tsx`

**Interfaces:**
- Consumes: `countQueuedOrders`, `flushQueue` (Task 4, 6), `submitOrder` (Task 5), `useHeldOrdersStore` (Task 7), `PaymentDialog` (Task 9), `saveCatalog`/`loadCatalog` (Task 7), `getStoreBankAccount` (Task 14 — tạm truyền `null` cho tới khi Task 14 xong)
- Produces:
  - `<SyncIndicator />` — tự đếm hàng đợi và tự đẩy khi có mạng
  - `<HeldOrdersBar onResume={(order: HeldOrder) => void} />`
  - `usePosShortcuts(handlers: { onSearch: () => void; onCheckout: () => void; onHold: () => void }): void`

- [ ] **Step 1: Viết `sync-indicator.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { flushQueue } from "@/lib/sync/flush";
import { countQueuedOrders } from "@/lib/sync/queue";

const POLL_INTERVAL_MS = 15_000;

/**
 * Hien "N don cho dong bo" va tu day hang doi khi co mang lai.
 * KHONG hien loi do doa nguoi dung — chi la mot chi bao am tham.
 */
export function SyncIndicator() {
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    setPending(await countQueuedOrders());
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const timer = setInterval(() => void flush(), POLL_INTERVAL_MS);
    window.addEventListener("online", () => void flush());

    return () => {
      clearInterval(timer);
      window.removeEventListener("online", () => void flush());
    };
  }, [flush, refresh]);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      {pending} đơn chờ đồng bộ — bấm để thử lại
    </button>
  );
}
```

- [ ] **Step 2: Viết `held-orders-bar.tsx`**

```tsx
"use client";

import { formatVnd } from "@/lib/money";
import { useHeldOrdersStore, type HeldOrder } from "@/stores/held-orders-store";

interface HeldOrdersBarProps {
  onResume: (order: HeldOrder) => void;
}

export function HeldOrdersBar({ onResume }: HeldOrdersBarProps) {
  const held = useHeldOrdersStore((state) => state.held);
  const resume = useHeldOrdersStore((state) => state.resume);

  if (held.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Đơn đang giữ:</span>
      {held.map((order, index) => (
        <button
          key={order.id}
          type="button"
          onClick={() => {
            const resumed = resume(order.id);
            if (resumed) onResume(resumed);
          }}
          className="rounded-full bg-accent px-4 py-2 text-sm"
        >
          #{index + 1} — {formatVnd(order.total)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Viết `use-pos-shortcuts.ts`**

```ts
"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onSearch: () => void;
  onCheckout: () => void;
  onHold: () => void;
}

/**
 * F2 vao o tim · F4 thanh toan · F8 giu don.
 * Ai quen ban rat nhanh; ai khong quen van bam chuot binh thuong.
 */
export function usePosShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        handlers.onSearch();
        return;
      }
      if (event.key === "F4") {
        event.preventDefault();
        handlers.onCheckout();
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        handlers.onHold();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlers]);
}
```

- [ ] **Step 4: Sửa `pos-screen.tsx` dùng tầng đồng bộ**

Thay toàn bộ nội dung `src/components/pos/pos-screen.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CartPanel } from "@/components/pos/cart-panel";
import { CategoryGrid } from "@/components/pos/category-grid";
import { HeldOrdersBar } from "@/components/pos/held-orders-bar";
import { PaymentDialog, type PaymentResult } from "@/components/pos/payment-dialog";
import { ProductSearch } from "@/components/pos/product-search";
import { ServiceLineDialog } from "@/components/pos/service-line-dialog";
import { SyncIndicator } from "@/components/pos/sync-indicator";
import { usePosShortcuts } from "@/components/pos/use-pos-shortcuts";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { calculateCart } from "@/lib/pricing/calculate";
import { isCatalogStale, loadCatalog, saveCatalog } from "@/lib/sync/catalog-cache";
import { submitOrder } from "@/lib/sync/submit";
import type { BankAccount } from "@/lib/vietqr/types";
import { useCartStore } from "@/stores/cart-store";
import { useHeldOrdersStore } from "@/stores/held-orders-store";
import type { CatalogResponse } from "@/types/catalog";

interface PosScreenProps {
  catalog: CatalogResponse;
  bankAccount: BankAccount | null;
}

interface LastSale {
  code: string | null;
  total: number;
  received: number;
  change: number;
  synced: boolean;
}

export function PosScreen({ catalog: initialCatalog, bankAccount }: PosScreenProps) {
  const lines = useCartStore((state) => state.lines);
  const orderDiscount = useCartStore((state) => state.orderDiscount);
  const addProduct = useCartStore((state) => state.addProduct);
  const clear = useCartStore((state) => state.clear);
  const hold = useHeldOrdersStore((state) => state.hold);

  const [catalog, setCatalog] = useState(initialCatalog);
  const [stale, setStale] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(
    () => calculateCart(lines, orderDiscount),
    [lines, orderDiscount],
  );

  // Luu danh muc vao IndexedDB de lan sau mat mang van ban duoc.
  useEffect(() => {
    void saveCatalog(initialCatalog);
  }, [initialCatalog]);

  // Mat mang thi Server Component tra ve danh muc rong — dung ban cache.
  useEffect(() => {
    if (initialCatalog.products.length > 0) return;

    void loadCatalog().then((cached) => {
      if (!cached) return;
      setCatalog(cached);
      setStale(isCatalogStale(cached));
    });
  }, [initialCatalog.products.length]);

  const focusSearch = useCallback(() => {
    searchRef.current?.querySelector("input")?.focus();
  }, []);

  const holdCurrent = useCallback(() => {
    if (lines.length === 0) return;
    hold(lines, orderDiscount);
    clear();
    focusSearch();
  }, [lines, orderDiscount, hold, clear, focusSearch]);

  usePosShortcuts({
    onSearch: focusSearch,
    onCheckout: () => {
      if (lines.length > 0) setPaymentOpen(true);
    },
    onHold: holdCurrent,
  });

  async function handleConfirm(result: PaymentResult) {
    setPaymentOpen(false);

    const outcome = await submitOrder({
      clientId: crypto.randomUUID(),
      channel: "pos",
      lines: lines.map((line) => ({
        productId: line.productId,
        name: line.name,
        unitPrice: line.unitPrice,
        originalPrice: line.originalPrice,
        quantity: line.quantity,
        discount: line.discount,
        unit: line.unit,
        isService: line.isService,
      })),
      orderDiscount,
      payments: result.payments,
      customerId: result.customerId,
    });

    setLastSale({
      code: outcome.order?.code ?? null,
      total: totals.total,
      received: result.received,
      change: Math.max(0, result.received - totals.total),
      synced: outcome.synced,
    });

    clear();
    focusSearch();
  }

  return (
    <main className="grid h-dvh grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_420px]">
      <section className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <div className="flex items-center gap-3">
          <SyncIndicator />
          {stale ? (
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-900">
              Danh mục đã cũ — nên làm mới khi có mạng
            </span>
          ) : null}
        </div>

        <HeldOrdersBar
          onResume={(order) => {
            useCartStore.setState({
              lines: order.lines,
              orderDiscount: order.orderDiscount,
            });
            focusSearch();
          }}
        />

        <div ref={searchRef}>
          <ProductSearch products={catalog.products} onSelect={addProduct} />
        </div>

        <CategoryGrid
          categories={catalog.categories}
          products={catalog.products}
          activeCategoryId={activeCategoryId}
          onCategoryChange={setActiveCategoryId}
          onSelect={addProduct}
        />
      </section>

      <section className="flex min-h-0 flex-col gap-2 rounded-lg border p-4">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setServiceOpen(true)}>
            + Tiền công
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={lines.length === 0}
            onClick={holdCurrent}
          >
            Giữ đơn (F8)
          </Button>
        </div>
        <CartPanel onCheckout={() => setPaymentOpen(true)} />
      </section>

      <ServiceLineDialog open={serviceOpen} onOpenChange={setServiceOpen} />

      <PaymentDialog
        open={paymentOpen}
        total={totals.total}
        orderCode="DH"
        bankAccount={bankAccount}
        onCancel={() => setPaymentOpen(false)}
        onConfirm={handleConfirm}
      />

      {lastSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-8 text-center">
            <p className="text-muted-foreground">
              {lastSale.synced
                ? `Đã lưu đơn ${lastSale.code}`
                : "Đã lưu tạm — sẽ đồng bộ khi có mạng"}
            </p>
            <p className="text-lg">Khách đưa {formatVnd(lastSale.received)}</p>
            <p className="text-sm text-muted-foreground">Tiền thối lại</p>
            <p data-testid="last-sale-change" className="text-7xl font-bold tabular-nums">
              {formatVnd(lastSale.change)}
            </p>
            <Button autoFocus className="h-16 w-full text-xl" onClick={() => setLastSale(null)}>
              Đơn mới
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
```

Ghi chú về `orderCode="DH"`: mã đơn thật do server sinh khi nhận đơn, nên lúc hiện QR ta chưa có. Nội dung chuyển khoản tạm dùng tiền tố `DH`. Task 15 sẽ thay bằng mã đặt trước để QR mang đúng mã đơn.

- [ ] **Step 5: Sửa `src/app/pos/page.tsx` truyền `bankAccount`**

Thêm vào cuối phần `Promise.all` và đổi phần return (giữ nguyên phần lấy `categories`, `products`):

```tsx
import { getStoreBankAccount } from "@/server/settings/store-settings";
```

Trong hàm, sau khi có `catalog`:

```tsx
  const bankAccount = await getStoreBankAccount();

  return <PosScreen catalog={catalog} bankAccount={bankAccount} />;
```

Hàm `getStoreBankAccount` được viết ở Task 14. Để plan chạy tuần tự được, tạm thêm file `src/server/settings/store-settings.ts` với nội dung tối thiểu ngay bây giờ:

```ts
import type { BankAccount } from "@/lib/vietqr/types";

/** Ban day du o Task 14 — tam thoi chua cau hinh. */
export async function getStoreBankAccount(): Promise<BankAccount | null> {
  return null;
}
```

- [ ] **Step 6: Chạy toàn bộ test**

Run: `pnpm check`
Expected: PASS. Test `cart-panel` và `product-search` của Plan 1 vẫn xanh vì không đổi interface.

- [ ] **Step 7: Kiểm tra bằng tay chế độ offline**

```bash
pnpm db:reset && pnpm dev
```

1. Đăng nhập, vào `/pos`, bán một đơn bình thường → hiện mã `DH0001`
2. Mở DevTools → Network → chọn **Offline**
3. Bán tiếp một đơn → hiện "Đã lưu tạm — sẽ đồng bộ khi có mạng", và góc trên hiện "1 đơn chờ đồng bộ"
4. Tắt Offline → trong 15 giây chỉ báo biến mất
5. Kiểm tra đơn đã lên server:

```bash
pnpm tsx -e "import('@prisma/client').then(async ({PrismaClient}) => { const p = new PrismaClient(); console.table(await p.order.findMany({select:{code:true,total:true,status:true}})); await p.\$disconnect(); })"
```

Expected: có 2 đơn.

- [ ] **Step 8: Commit**

```bash
git add src/components/pos src/app/pos src/server/settings
git commit -m "feat(pos): wire sync layer, held orders and shortcuts"
```

---

## Task 11: PWA — manifest và service worker

**Files:**
- Create: `public/manifest.webmanifest`, `public/sw.js`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `/pos` mở được khi mất mạng

- [ ] **Step 1: Viết manifest**

Tạo `public/manifest.webmanifest`:

```json
{
  "name": "Bán hàng",
  "short_name": "Bán hàng",
  "start_url": "/pos",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "48x48",
      "type": "image/x-icon"
    }
  ]
}
```

- [ ] **Step 2: Viết service worker**

Tạo `public/sw.js`:

```js
const CACHE_NAME = "pos-shell-v1";
const SHELL_URLS = ["/pos"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

/**
 * Chi cache man hinh ban. KHONG cache /api va /admin:
 * - /api/orders phai luon di that (hang doi IndexedDB lo phan offline)
 * - /admin can du lieu moi, va spec da chot la khong offline
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/admin")) return;
  if (!url.pathname.startsWith("/pos")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
```

Chiến lược là **network-first**: có mạng thì luôn lấy bản mới (danh mục cập nhật), mất mạng mới rơi về cache. Ngược lại với cache-first sẽ khiến sửa giá không hiện ra ở quầy.

- [ ] **Step 3: Đăng ký service worker và link manifest**

Sửa `src/app/layout.tsx`. Thêm vào `metadata`:

```ts
export const metadata: Metadata = {
  // ...giữ nguyên các trường có sẵn
  manifest: "/manifest.webmanifest",
};
```

Và thêm component đăng ký. Tạo `src/components/pos/service-worker-registrar.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
```

Render nó trong `src/app/layout.tsx`, bên trong `<body>`:

```tsx
<ServiceWorkerRegistrar />
```

Chỉ đăng ký ở production — service worker trong `next dev` gây cache lộn xộn lúc phát triển.

- [ ] **Step 4: Kiểm tra bằng build thật**

```bash
pnpm build && pnpm start
```

1. Mở `http://localhost:3000/pos`, đăng nhập
2. DevTools → Application → Service Workers → thấy `sw.js` đã activated
3. Chuyển Network sang **Offline**, nhấn F5 → trang `/pos` vẫn mở được
4. Bán một đơn khi offline → vào hàng đợi, chỉ báo hiện

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest public/sw.js src/components/pos/service-worker-registrar.tsx src/app/layout.tsx
git commit -m "feat(pwa): add manifest and network-first service worker"
```

---

## Task 12: Nghiệp vụ lưu sản phẩm và huỷ đơn

**Files:**
- Create: `src/server/products/save-product.ts`, `src/server/orders/cancel-order.ts`
- Test: `tests/server/products/save-product.test.ts`, `tests/server/orders/cancel-order.test.ts`

**Interfaces:**
- Consumes: `prisma` (Plan 1), `buildSearchText` (Plan 1)
- Produces:
  - `saveProduct(input: SaveProductInput): Promise<{ id: string }>`
  - type `SaveProductInput = { id?: string; name: string; sku?: string | null; categoryId?: string | null; unit: string; price: number; costPrice: number; stock: number; aliases?: string | null; isActive: boolean }`
  - `softDeleteProduct(id: string): Promise<void>`
  - `cancelOrder(orderId: string): Promise<void>`

- [ ] **Step 1: Viết test thất bại cho `save-product`**

Tạo `tests/server/products/save-product.test.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { saveProduct, softDeleteProduct } from "@/server/products/save-product";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("saveProduct", () => {
  it("tao san pham moi", async () => {
    const { id } = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.name).toBe("Đường trắng");
    expect(saved.price).toBe(25000);
  });

  it("sinh searchText da bo dau", async () => {
    const { id } = await saveProduct({
      name: "Nhớt Castrol Power1",
      unit: "chai",
      price: 120000,
      costPrice: 95000,
      stock: 10,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.searchText).toContain("nhot castrol power1");
  });

  it("gop ca aliases va sku vao searchText", async () => {
    const { id } = await saveProduct({
      name: "Bugi NGK C7HSA",
      sku: "PT-102",
      aliases: "bugi wave, bugi thường",
      unit: "cái",
      price: 35000,
      costPrice: 24000,
      stock: 20,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.searchText).toContain("bugi wave");
    expect(saved.searchText).toContain("bugi thuong");
    expect(saved.searchText).toContain("pt-102");
  });

  it("gop ten danh muc vao searchText", async () => {
    const category = await prisma.category.create({
      data: { name: "Phụ tùng xe", sortOrder: 1 },
    });

    const { id } = await saveProduct({
      name: "Ruột xe máy",
      categoryId: category.id,
      unit: "cái",
      price: 55000,
      costPrice: 38000,
      stock: 5,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.searchText).toContain("phu tung xe");
  });

  it("sua san pham cu va cap nhat lai searchText", async () => {
    const created = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    await saveProduct({
      id: created.id,
      name: "Đường vàng",
      unit: "kg",
      price: 27000,
      costPrice: 22000,
      stock: 40,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(saved.name).toBe("Đường vàng");
    expect(saved.searchText).toContain("duong vang");
    expect(saved.searchText).not.toContain("duong trang");
  });

  it("khong tao ban ghi thu hai khi sua", async () => {
    const created = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    await saveProduct({
      id: created.id,
      name: "Đường trắng",
      unit: "kg",
      price: 26000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    expect(await prisma.product.count()).toBe(1);
  });
});

describe("softDeleteProduct", () => {
  it("xoa mem — van con ban ghi nhung khong hien o POS", async () => {
    const { id } = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    await softDeleteProduct(id);

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.deletedAt).not.toBeNull();
    expect(saved.isActive).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/server/products/save-product.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết `save-product.ts`**

Tạo `src/server/products/save-product.ts`:

```ts
import { buildSearchText } from "@/lib/search/search-text";
import { prisma } from "@/server/db/prisma";

export interface SaveProductInput {
  id?: string;
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  unit: string;
  price: number;
  costPrice: number;
  stock: number;
  aliases?: string | null;
  isActive: boolean;
}

/**
 * Noi duy nhat duoc phep ghi san pham — vi searchText PHAI duoc sinh lai
 * moi lan luu. Sua san pham bang duong khac se lam tim kiem sai.
 */
export async function saveProduct(
  input: SaveProductInput,
): Promise<{ id: string }> {
  const category = input.categoryId
    ? await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { name: true },
      })
    : null;

  const data = {
    name: input.name,
    sku: input.sku || null,
    categoryId: input.categoryId || null,
    unit: input.unit,
    price: Math.round(input.price),
    costPrice: Math.round(input.costPrice),
    stock: input.stock,
    aliases: input.aliases || null,
    isActive: input.isActive,
    searchText: buildSearchText({
      name: input.name,
      aliases: input.aliases,
      sku: input.sku,
      categoryName: category?.name ?? null,
    }),
  };

  if (input.id) {
    const updated = await prisma.product.update({
      where: { id: input.id },
      data,
      select: { id: true },
    });
    return updated;
  }

  const created = await prisma.product.create({ data, select: { id: true } });
  return created;
}

/**
 * Xoa mem — don cu van tham chieu duoc san pham, nhung POS khong hien nua.
 */
export async function softDeleteProduct(id: string): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/server/products/save-product.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 5: Viết test thất bại cho `cancel-order`**

Tạo `tests/server/orders/cancel-order.test.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cancelOrder } from "@/server/orders/cancel-order";
import { createOrder } from "@/server/orders/create-order";

const prisma = new PrismaClient();

async function seedProduct(stock = 10) {
  return prisma.product.create({
    data: {
      name: "Đường trắng",
      price: 15000,
      stock,
      unit: "kg",
      searchText: "duong trang",
    },
  });
}

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cancelOrder", () => {
  it("doi trang thai don sang cancelled", async () => {
    const product = await seedProduct();
    const { order } = await createOrder({
      clientId: "c1",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 30000 }],
    });

    await cancelOrder(order.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("cancelled");
  });

  it("hoan lai ton kho da tru", async () => {
    const product = await seedProduct(10);
    const { order } = await createOrder({
      clientId: "c2",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2.5,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 40000 }],
    });

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7.5);

    await cancelOrder(order.id);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
  });

  it("ghi StockMovement voi reason cancel", async () => {
    const product = await seedProduct();
    const { order } = await createOrder({
      clientId: "c3",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 30000 }],
    });

    await cancelOrder(order.id);

    const movements = await prisma.stockMovement.findMany({ where: { reason: "cancel" } });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.delta).toBe(2);
  });

  it("dong dich vu khong hoan ton kho", async () => {
    const { order } = await createOrder({
      clientId: "c4",
      lines: [
        {
          productId: null,
          name: "Công thay nhớt",
          unitPrice: 20000,
          originalPrice: 20000,
          quantity: 1,
          discount: 0,
          unit: "lần",
          isService: true,
        },
      ],
      payments: [{ method: "cash", amount: 20000 }],
    });

    await cancelOrder(order.id);

    expect(await prisma.stockMovement.count({ where: { reason: "cancel" } })).toBe(0);
  });

  it("huy hai lan khong hoan ton kho hai lan", async () => {
    const product = await seedProduct(10);
    const { order } = await createOrder({
      clientId: "c5",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 30000 }],
    });

    await cancelOrder(order.id);
    await cancelOrder(order.id);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
  });
});
```

- [ ] **Step 6: Viết `cancel-order.ts`**

Tạo `src/server/orders/cancel-order.ts`:

```ts
import { prisma } from "@/server/db/prisma";

/**
 * Huy don va hoan lai ton kho. Idempotent — huy don da huy khong lam gi them,
 * neu khong se cong ton kho nhieu lan.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.status === "cancelled") return;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "cancelled" },
    });

    for (const item of order.items) {
      if (item.isService || !item.productId) continue;

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          delta: item.quantity,
          reason: "cancel",
          refId: orderId,
        },
      });
    }
  });
}
```

- [ ] **Step 7: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/server/orders/cancel-order.test.ts`
Expected: PASS — 5 test.

- [ ] **Step 8: Commit**

```bash
git add src/server/products src/server/orders/cancel-order.ts tests/server/products tests/server/orders/cancel-order.test.ts
git commit -m "feat(admin): add product save and order cancel logic"
```

---

## Task 13: Báo cáo doanh thu

**Files:**
- Create: `src/server/reports/daily-revenue.ts`
- Test: `tests/server/reports/daily-revenue.test.ts`

**Interfaces:**
- Consumes: `prisma` (Plan 1)
- Produces:
  - `getDailyRevenue(days: number): Promise<DailyRevenueRow[]>`
  - type `DailyRevenueRow = { date: string; orderCount: number; revenue: number }`
  - `getTopProducts(limit: number): Promise<TopProductRow[]>`
  - type `TopProductRow = { id: string; name: string; soldCount: number }`
  - `getLowStockProducts(threshold: number): Promise<LowStockRow[]>`
  - type `LowStockRow = { id: string; name: string; stock: number; unit: string }`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/server/reports/daily-revenue.test.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getDailyRevenue,
  getLowStockProducts,
  getTopProducts,
} from "@/server/reports/daily-revenue";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createOrderAt(total: number, createdAt: Date, status = "paid") {
  await prisma.order.create({
    data: {
      code: `DH${Math.random().toString().slice(2, 8)}`,
      clientId: crypto.randomUUID(),
      status,
      subtotal: total,
      total,
      createdAt,
    },
  });
}

describe("getDailyRevenue", () => {
  it("khong co don thi tra ve mang rong", async () => {
    expect(await getDailyRevenue(7)).toEqual([]);
  });

  it("cong don doanh thu theo ngay", async () => {
    const today = new Date();
    await createOrderAt(100000, today);
    await createOrderAt(50000, today);

    const rows = await getDailyRevenue(7);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderCount).toBe(2);
    expect(rows[0]?.revenue).toBe(150000);
  });

  it("tach rieng tung ngay", async () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await createOrderAt(100000, today);
    await createOrderAt(70000, yesterday);

    const rows = await getDailyRevenue(7);
    expect(rows).toHaveLength(2);
  });

  it("KHONG tinh don da huy vao doanh thu", async () => {
    const today = new Date();
    await createOrderAt(100000, today);
    await createOrderAt(999000, today, "cancelled");

    const rows = await getDailyRevenue(7);
    expect(rows[0]?.revenue).toBe(100000);
  });

  it("bo qua don ngoai khoang ngay yeu cau", async () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await createOrderAt(100000, longAgo);

    expect(await getDailyRevenue(7)).toEqual([]);
  });
});

describe("getTopProducts", () => {
  it("xep theo so lan ban giam dan", async () => {
    await prisma.product.createMany({
      data: [
        { name: "Ít bán", price: 1000, searchText: "it ban", soldCount: 2 },
        { name: "Bán chạy", price: 1000, searchText: "ban chay", soldCount: 50 },
      ],
    });

    const rows = await getTopProducts(10);
    expect(rows[0]?.name).toBe("Bán chạy");
  });

  it("gioi han so dong tra ve", async () => {
    await prisma.product.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        name: `SP ${index}`,
        price: 1000,
        searchText: `sp ${index}`,
        soldCount: index,
      })),
    });

    expect(await getTopProducts(5)).toHaveLength(5);
  });
});

describe("getLowStockProducts", () => {
  it("chi lay hang duoi nguong", async () => {
    await prisma.product.createMany({
      data: [
        { name: "Sắp hết", price: 1000, searchText: "sap het", stock: 2, unit: "cái" },
        { name: "Còn nhiều", price: 1000, searchText: "con nhieu", stock: 50, unit: "cái" },
      ],
    });

    const rows = await getLowStockProducts(5);
    expect(rows.map((row) => row.name)).toEqual(["Sắp hết"]);
  });

  it("bao gom ca hang bi ton am", async () => {
    await prisma.product.create({
      data: { name: "Âm kho", price: 1000, searchText: "am kho", stock: -3, unit: "cái" },
    });

    const rows = await getLowStockProducts(5);
    expect(rows[0]?.stock).toBe(-3);
  });

  it("bo qua hang da xoa mem", async () => {
    await prisma.product.create({
      data: {
        name: "Đã xoá",
        price: 1000,
        searchText: "da xoa",
        stock: 1,
        unit: "cái",
        deletedAt: new Date(),
      },
    });

    expect(await getLowStockProducts(5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/server/reports/daily-revenue.test.ts`
Expected: FAIL — không tìm thấy module.

- [ ] **Step 3: Viết implementation**

Tạo `src/server/reports/daily-revenue.ts`:

```ts
import { prisma } from "@/server/db/prisma";

export interface DailyRevenueRow {
  /** Dang YYYY-MM-DD. */
  date: string;
  orderCount: number;
  revenue: number;
}

export interface TopProductRow {
  id: string;
  name: string;
  soldCount: number;
}

export interface LowStockRow {
  id: string;
  name: string;
  stock: number;
  unit: string;
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Doanh thu theo ngay. Don da huy KHONG duoc tinh — neu tinh thi con so
 * bao cao se cao hon tien that trong ket.
 */
export async function getDailyRevenue(days: number): Promise<DailyRevenueRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { not: "cancelled" } },
    select: { createdAt: true, total: true },
  });

  const byDate = new Map<string, { orderCount: number; revenue: number }>();

  for (const order of orders) {
    const key = toDateKey(order.createdAt);
    const current = byDate.get(key) ?? { orderCount: 0, revenue: 0 };
    byDate.set(key, {
      orderCount: current.orderCount + 1,
      revenue: current.revenue + order.total,
    });
  }

  return [...byDate.entries()]
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTopProducts(limit: number): Promise<TopProductRow[]> {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { soldCount: "desc" },
    take: limit,
    select: { id: true, name: true, soldCount: true },
  });
}

/** Gom ca hang bi ton am — do la dau hieu can chinh kho gap. */
export async function getLowStockProducts(
  threshold: number,
): Promise<LowStockRow[]> {
  return prisma.product.findMany({
    where: {
      deletedAt: null,
      isService: false,
      stock: { lte: threshold },
    },
    orderBy: { stock: "asc" },
    select: { id: true, name: true, stock: true, unit: true },
  });
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/server/reports/daily-revenue.test.ts`
Expected: PASS — 10 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/reports tests/server/reports
git commit -m "feat(admin): add revenue and stock reports"
```

---

## Task 14: Cài đặt cửa hàng

**Files:**
- Create: `src/server/settings/store-settings.ts` (thay bản tạm ở Task 10), `src/app/admin/settings/page.tsx`, `src/app/admin/settings/actions.ts`

**Interfaces:**
- Consumes: `prisma` (Plan 1), type `BankAccount` (Task 3)
- Produces:
  - `getStoreBankAccount(): Promise<BankAccount | null>`
  - `saveStoreBankAccount(account: BankAccount): Promise<void>`
  - `getStoreName(): Promise<string>`
  - `saveStoreName(name: string): Promise<void>`

- [ ] **Step 1: Viết `store-settings.ts`**

Ghi đè `src/server/settings/store-settings.ts`:

```ts
import { prisma } from "@/server/db/prisma";
import type { BankAccount } from "@/lib/vietqr/types";

const KEY_BANK_BIN = "bank.bin";
const KEY_BANK_ACCOUNT = "bank.accountNumber";
const KEY_BANK_NAME = "bank.accountName";
const KEY_STORE_NAME = "store.name";

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Tra ve null khi chua khai bao du ca ba truong — POS se hien
 * "chua cau hinh tai khoan" thay vi sinh QR sai.
 */
export async function getStoreBankAccount(): Promise<BankAccount | null> {
  const [bankBin, accountNumber, accountName] = await Promise.all([
    readSetting(KEY_BANK_BIN),
    readSetting(KEY_BANK_ACCOUNT),
    readSetting(KEY_BANK_NAME),
  ]);

  if (!bankBin || !accountNumber || !accountName) return null;

  return { bankBin, accountNumber, accountName };
}

export async function saveStoreBankAccount(account: BankAccount): Promise<void> {
  await Promise.all([
    writeSetting(KEY_BANK_BIN, account.bankBin),
    writeSetting(KEY_BANK_ACCOUNT, account.accountNumber),
    writeSetting(KEY_BANK_NAME, account.accountName),
  ]);
}

export async function getStoreName(): Promise<string> {
  return (await readSetting(KEY_STORE_NAME)) ?? "Cửa hàng";
}

export async function saveStoreName(name: string): Promise<void> {
  await writeSetting(KEY_STORE_NAME, name);
}
```

- [ ] **Step 2: Viết Server Action**

Tạo `src/app/admin/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  saveStoreBankAccount,
  saveStoreName,
} from "@/server/settings/store-settings";

const schema = z.object({
  storeName: z.string().min(1),
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng phải là 6 chữ số"),
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
});

export async function saveSettingsAction(formData: FormData) {
  const parsed = schema.safeParse({
    storeName: formData.get("storeName"),
    bankBin: formData.get("bankBin"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });

  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  await saveStoreName(parsed.data.storeName);
  await saveStoreBankAccount({
    bankBin: parsed.data.bankBin,
    accountNumber: parsed.data.accountNumber,
    accountName: parsed.data.accountName,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/pos");

  return { ok: true as const };
}
```

- [ ] **Step 3: Viết trang cài đặt**

Tạo `src/app/admin/settings/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import {
  getStoreBankAccount,
  getStoreName,
} from "@/server/settings/store-settings";

import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [storeName, account] = await Promise.all([
    getStoreName(),
    getStoreBankAccount(),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>

      <form action={saveSettingsAction} className="space-y-4">
        <label className="block">
          <span className="text-sm text-muted-foreground">Tên cửa hàng</span>
          <input
            name="storeName"
            defaultValue={storeName}
            className="mt-1 w-full rounded border px-4 py-3"
          />
        </label>

        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">
            Tài khoản nhận chuyển khoản
          </legend>

          <label className="block">
            <span className="text-sm text-muted-foreground">
              Mã ngân hàng (BIN, 6 chữ số)
            </span>
            <input
              name="bankBin"
              defaultValue={account?.bankBin ?? ""}
              placeholder="VD: 970423"
              className="mt-1 w-full rounded border px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">Số tài khoản</span>
            <input
              name="accountNumber"
              defaultValue={account?.accountNumber ?? ""}
              className="mt-1 w-full rounded border px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">
              Tên chủ tài khoản (không dấu)
            </span>
            <input
              name="accountName"
              defaultValue={account?.accountName ?? ""}
              placeholder="NGUYEN VAN A"
              className="mt-1 w-full rounded border px-4 py-3"
            />
          </label>
        </fieldset>

        <Button type="submit">Lưu cài đặt</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. `src/app/pos/page.tsx` (Task 10 Step 5) giờ dùng bản `getStoreBankAccount` thật.

- [ ] **Step 5: Commit**

```bash
git add src/server/settings src/app/admin/settings
git commit -m "feat(admin): add store settings with bank account"
```

---

## Task 15: Mã đơn đặt trước cho QR

Vấn đề còn tồn từ Task 10: QR hiện lúc thanh toán nhưng mã đơn do server sinh sau, nên nội dung chuyển khoản chỉ là `"DH"`. Sửa bằng cách để máy bán tự đặt trước mã.

**Files:**
- Modify: `src/server/orders/create-order.ts`, `src/app/api/orders/route.ts`, `src/lib/sync/types.ts`, `src/components/pos/pos-screen.tsx`
- Test: `tests/server/orders/create-order.test.ts` (thêm test)

**Interfaces:**
- Sửa `CreateOrderInput` — thêm `preferredCode?: string | null`
- Sửa `OrderPayload` — thêm `preferredCode?: string | null`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe("createOrder", ...)` trong `tests/server/orders/create-order.test.ts`:

```ts
  it("dung ma don do may ban dat truoc", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "pref1",
      preferredCode: "DH7777",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(result.order.code).toBe("DH7777");
  });

  it("ma dat truoc bi trung thi tu sinh ma khac", async () => {
    const product = await seedProduct();

    await createOrder({
      clientId: "pref2",
      preferredCode: "DH8888",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    const second = await createOrder({
      clientId: "pref3",
      preferredCode: "DH8888",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(second.order.code).not.toBe("DH8888");
    expect(second.order.code).toMatch(/^DH\d+$/);
  });

  it("khong dat truoc thi van sinh ma tu dong", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "pref4",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(result.order.code).toMatch(/^DH\d+$/);
  });
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm vitest run tests/server/orders/create-order.test.ts`
Expected: FAIL — `preferredCode` không tồn tại trong `CreateOrderInput`.

- [ ] **Step 3: Sửa `create-order.ts`**

Thêm trường vào interface:

```ts
export interface CreateOrderInput {
  clientId: string;
  /** Ma do may ban dat truoc de gan vao noi dung QR. Trung thi server tu doi. */
  preferredCode?: string | null;
  channel?: "pos" | "online";
  lines: CreateOrderLine[];
  orderDiscount?: number;
  payments: CreateOrderPayment[];
  customerId?: string | null;
  note?: string | null;
}
```

Trong `prisma.$transaction`, thay dòng tính `code`:

```ts
    const sequence = (await tx.order.count()) + 1;

    // Ma dat truoc chi duoc dung neu chua ai chiem — tranh vi pham unique.
    let code = generateOrderCode(sequence);
    if (input.preferredCode) {
      const taken = await tx.order.findUnique({
        where: { code: input.preferredCode },
        select: { id: true },
      });
      if (!taken) code = input.preferredCode;
    }
```

Rồi dùng `code` thay cho `generateOrderCode(sequence)` trong `data`:

```ts
      data: {
        code,
        channel: input.channel ?? "pos",
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `pnpm vitest run tests/server/orders/create-order.test.ts`
Expected: PASS — 15 test (12 cũ + 3 mới).

- [ ] **Step 5: Cho phép `preferredCode` qua API**

Thêm vào `bodySchema` trong `src/app/api/orders/route.ts`:

```ts
  preferredCode: z.string().regex(/^DH\d+$/).nullable().optional(),
```

- [ ] **Step 6: Thêm vào `OrderPayload`**

Thêm vào `src/lib/sync/types.ts`, interface `OrderPayload`:

```ts
  preferredCode?: string | null;
```

- [ ] **Step 7: Sinh mã đặt trước ở màn hình bán**

Trong `src/components/pos/pos-screen.tsx`, thêm state ngay dưới các state khác:

```tsx
  // Ma dat truoc de QR mang dung ma don. Sinh lai sau moi lan ban xong.
  const [pendingCode, setPendingCode] = useState(
    () => `DH${Date.now().toString().slice(-6)}`,
  );
```

Đổi prop của `PaymentDialog`:

```tsx
        orderCode={pendingCode}
```

Trong `handleConfirm`, thêm `preferredCode` vào payload và sinh mã mới sau khi bán xong:

```tsx
    const outcome = await submitOrder({
      clientId: crypto.randomUUID(),
      preferredCode: pendingCode,
      channel: "pos",
```

và ngay trước `clear()`:

```tsx
    setPendingCode(`DH${Date.now().toString().slice(-6)}`);
```

- [ ] **Step 8: Kiểm tra bằng tay**

```bash
pnpm db:reset && pnpm dev
```

Vào `/admin/settings`, khai BIN `970423`, số tài khoản bất kỳ, tên `NGUYEN VAN A`, lưu. Vào `/pos`, thêm hàng, bấm Thanh toán → tab Chuyển khoản → QR hiện, và dòng "Nội dung" khớp mã đơn hiện ra sau khi xác nhận.

- [ ] **Step 9: Commit**

```bash
git add src/server/orders/create-order.ts src/app/api/orders/route.ts src/lib/sync/types.ts src/components/pos/pos-screen.tsx tests/server/orders/create-order.test.ts
git commit -m "feat(orders): let POS reserve order code for QR"
```

---

## Task 16: Khung `/admin` và trang sản phẩm

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/products/page.tsx`, `src/app/admin/products/product-form.tsx`, `src/app/admin/products/actions.ts`

**Interfaces:**
- Consumes: `saveProduct`, `softDeleteProduct` (Task 12), `prisma` (Plan 1), `formatVnd` (Plan 1)
- Produces: `saveProductAction(formData: FormData)`, `deleteProductAction(id: string)`

- [ ] **Step 1: Viết layout admin**

Tạo `src/app/admin/layout.tsx`:

```tsx
import Link from "next/link";

const NAV = [
  { href: "/pos", label: "← Bán hàng" },
  { href: "/admin/products", label: "Sản phẩm" },
  { href: "/admin/categories", label: "Danh mục" },
  { href: "/admin/orders", label: "Đơn hàng" },
  { href: "/admin/debts", label: "Công nợ" },
  { href: "/admin/reports", label: "Báo cáo" },
  { href: "/admin/settings", label: "Cài đặt" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-[220px_1fr]">
      <nav className="border-r p-4">
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded px-3 py-2 hover:bg-accent"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Viết Server Action**

Tạo `src/app/admin/products/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveProduct, softDeleteProduct } from "@/server/products/save-product";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Tên sản phẩm không được để trống"),
  sku: z.string().nullable(),
  categoryId: z.string().nullable(),
  unit: z.string().min(1),
  price: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().int().min(0),
  stock: z.coerce.number(),
  aliases: z.string().nullable(),
});

export async function saveProductAction(formData: FormData) {
  const raw = {
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    sku: (formData.get("sku") as string) || null,
    categoryId: (formData.get("categoryId") as string) || null,
    unit: formData.get("unit"),
    price: formData.get("price"),
    costPrice: formData.get("costPrice"),
    stock: formData.get("stock"),
    aliases: (formData.get("aliases") as string) || null,
  };

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    };
  }

  await saveProduct({ ...parsed.data, isActive: true });

  revalidatePath("/admin/products");
  revalidatePath("/pos");

  return { ok: true as const };
}

export async function deleteProductAction(id: string) {
  await softDeleteProduct(id);
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}
```

- [ ] **Step 3: Viết form sản phẩm**

Tạo `src/app/admin/products/product-form.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CatalogCategory } from "@/types/catalog";

import { saveProductAction } from "./actions";

interface ProductFormProps {
  categories: CatalogCategory[];
}

export function ProductForm({ categories }: ProductFormProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    const result = await saveProductAction(formData);
    setMessage(result.ok ? "Đã lưu" : result.message);
  }

  return (
    <form action={handleAction} className="grid grid-cols-2 gap-3 rounded-lg border p-4">
      <label className="col-span-2 block">
        <span className="text-sm text-muted-foreground">Tên sản phẩm</span>
        <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      <label className="col-span-2 block">
        <span className="text-sm text-muted-foreground">
          Tên gọi khác (ngăn cách bằng dấu phẩy) — giúp tìm nhanh hàng phụ tùng
        </span>
        <input
          name="aliases"
          placeholder="bugi wave, bugi thường"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Mã nội bộ</span>
        <input name="sku" placeholder="PT-102" className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Danh mục</span>
        <select name="categoryId" className="mt-1 w-full rounded border px-3 py-2">
          <option value="">— Không —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Đơn vị</span>
        <input name="unit" defaultValue="cái" required className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Tồn kho</span>
        <input name="stock" type="number" step="any" defaultValue="0" className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Giá bán (VND)</span>
        <input name="price" type="number" defaultValue="0" className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Giá vốn (VND)</span>
        <input name="costPrice" type="number" defaultValue="0" className="mt-1 w-full rounded border px-3 py-2" />
      </label>

      <div className="col-span-2 flex items-center gap-3">
        <Button type="submit">Thêm sản phẩm</Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Viết trang sản phẩm**

Tạo `src/app/admin/products/page.tsx`:

```tsx
import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";

import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sản phẩm</h1>

      <ProductForm categories={categories} />

      <table className="w-full text-left">
        <thead className="border-b text-sm text-muted-foreground">
          <tr>
            <th className="py-2">Tên</th>
            <th>Danh mục</th>
            <th className="text-right">Giá bán</th>
            <th className="text-right">Tồn</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b">
              <td className="py-2">
                <span className="font-medium">{product.name}</span>
                {product.aliases ? (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({product.aliases})
                  </span>
                ) : null}
              </td>
              <td className="text-sm text-muted-foreground">
                {product.category?.name ?? "—"}
              </td>
              <td className="text-right tabular-nums">{formatVnd(product.price)}</td>
              <td className="text-right tabular-nums">
                <span className={product.stock < 0 ? "text-red-600" : undefined}>
                  {product.stock} {product.unit}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Kiểm tra bằng tay**

```bash
pnpm dev
```

Vào `/admin/products`, thêm sản phẩm "Ruột xe Dream" với tên gọi khác `sam dream`. Sang `/pos`, gõ `sam dream` → sản phẩm mới hiện ra. Đây là bằng chứng `searchText` được sinh đúng qua đường Server Action.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/products
git commit -m "feat(admin): add product management page"
```

---

## Task 17: Danh mục, đơn hàng, công nợ, báo cáo

**Files:**
- Create: `src/app/admin/categories/page.tsx` + `actions.ts`, `src/app/admin/orders/page.tsx` + `actions.ts`, `src/app/admin/debts/page.tsx` + `actions.ts`, `src/app/admin/reports/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Plan 1), `cancelOrder` (Task 12), `getDailyRevenue`/`getTopProducts`/`getLowStockProducts` (Task 13), `formatVnd` (Plan 1)
- Produces: `saveCategoryAction`, `cancelOrderAction`, `settleDebtAction`

- [ ] **Step 1: Trang danh mục**

Tạo `src/app/admin/categories/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const schema = z.object({
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

export async function saveCategoryAction(formData: FormData) {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) {
    return { ok: false as const, message: "Tên danh mục không được để trống" };
  }

  await prisma.category.create({ data: parsed.data });

  revalidatePath("/admin/categories");
  revalidatePath("/pos");

  return { ok: true as const };
}
```

Tạo `src/app/admin/categories/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { prisma } from "@/server/db/prisma";

import { saveCategoryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Danh mục</h1>

      <form action={saveCategoryAction} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="text-sm text-muted-foreground">Tên danh mục</span>
          <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="w-24">
          <span className="text-sm text-muted-foreground">Thứ tự</span>
          <input name="sortOrder" type="number" defaultValue="0" className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <Button type="submit">Thêm</Button>
      </form>

      <ul className="divide-y">
        {categories.map((category) => (
          <li key={category.id} className="flex justify-between py-3">
            <span>{category.name}</span>
            <span className="text-sm text-muted-foreground">
              {category._count.products} sản phẩm
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Trang đơn hàng**

Tạo `src/app/admin/orders/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { cancelOrder } from "@/server/orders/cancel-order";

export async function cancelOrderAction(orderId: string) {
  await cancelOrder(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/pos");
}
```

Tạo `src/app/admin/orders/page.tsx`:

```tsx
import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";

import { cancelOrderAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  debt: "Ghi nợ",
  cancelled: "Đã huỷ",
};

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      items: { select: { nameSnapshot: true, quantity: true, unit: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Đơn hàng</h1>

      <ul className="divide-y">
        {orders.map((order) => (
          <li key={order.id} className="flex items-start justify-between py-3">
            <div>
              <p className="font-medium">
                {order.code}
                {order.hasStockWarning ? (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                    Tồn âm
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.items.map((item) => `${item.nameSnapshot} ×${item.quantity}`).join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {STATUS_LABEL[order.status] ?? order.status}
                {order.customer ? ` — ${order.customer.name}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold tabular-nums">
                {formatVnd(order.total)}
              </span>
              {order.status !== "cancelled" ? (
                <form action={cancelOrderAction.bind(null, order.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Huỷ đơn
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Trang công nợ**

Tạo `src/app/admin/debts/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db/prisma";

/** Khach tra tien no — ghi them mot khoan thanh toan tien mat va dong don. */
export async function settleDebtAction(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { total: true, status: true },
  });

  if (!order || order.status !== "debt") return;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        orderId,
        method: "cash",
        amount: order.total,
        receivedAt: new Date(),
        note: "Khách trả nợ",
      },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: "paid" } }),
  ]);

  revalidatePath("/admin/debts");
}
```

Tạo `src/app/admin/debts/page.tsx`:

```tsx
import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";

import { settleDebtAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const debts = await prisma.order.findMany({
    where: { status: "debt" },
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { name: true, phone: true } } },
  });

  const byCustomer = new Map<string, { name: string; total: number }>();
  for (const order of debts) {
    const key = order.customerId ?? "unknown";
    const current = byCustomer.get(key) ?? {
      name: order.customer?.name ?? "Khách lẻ",
      total: 0,
    };
    byCustomer.set(key, { name: current.name, total: current.total + order.total });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Công nợ</h1>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Tổng nợ theo khách</h2>
        {byCustomer.size === 0 ? (
          <p className="text-muted-foreground">Không ai đang nợ</p>
        ) : (
          <ul className="divide-y">
            {[...byCustomer.values()].map((row) => (
              <li key={row.name} className="flex justify-between py-2">
                <span>{row.name}</span>
                <span className="font-semibold tabular-nums">{formatVnd(row.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Từng đơn nợ</h2>
        <ul className="divide-y">
          {debts.map((order) => (
            <li key={order.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{order.code}</p>
                <p className="text-sm text-muted-foreground">
                  {order.customer?.name ?? "Khách lẻ"}
                  {order.customer?.phone ? ` — ${order.customer.phone}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tabular-nums">
                  {formatVnd(order.total)}
                </span>
                <form action={settleDebtAction.bind(null, order.id)}>
                  <button type="submit" className="text-sm text-green-700 hover:underline">
                    Khách trả tiền
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Trang báo cáo**

Tạo `src/app/admin/reports/page.tsx`:

```tsx
import { formatVnd } from "@/lib/money";
import {
  getDailyRevenue,
  getLowStockProducts,
  getTopProducts,
} from "@/server/reports/daily-revenue";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [revenue, topProducts, lowStock] = await Promise.all([
    getDailyRevenue(14),
    getTopProducts(10),
    getLowStockProducts(5),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Báo cáo</h1>

      <section>
        <h2 className="mb-2 font-medium">Doanh thu 14 ngày gần nhất</h2>
        {revenue.length === 0 ? (
          <p className="text-muted-foreground">Chưa có đơn nào</p>
        ) : (
          <ul className="divide-y">
            {revenue.map((row) => (
              <li key={row.date} className="flex justify-between py-2">
                <span>
                  {row.date}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {row.orderCount} đơn
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatVnd(row.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Hàng bán chạy</h2>
        <ul className="divide-y">
          {topProducts.map((row) => (
            <li key={row.id} className="flex justify-between py-2">
              <span>{row.name}</span>
              <span className="text-muted-foreground">{row.soldCount} lượt</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Sắp hết hàng</h2>
        {lowStock.length === 0 ? (
          <p className="text-muted-foreground">Không có hàng nào sắp hết</p>
        ) : (
          <ul className="divide-y">
            {lowStock.map((row) => (
              <li key={row.id} className="flex justify-between py-2">
                <span>{row.name}</span>
                <span className={row.stock < 0 ? "text-red-600" : undefined}>
                  {row.stock} {row.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Chạy toàn bộ kiểm tra**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Kiểm tra bằng tay**

```bash
pnpm dev
```

Đi hết vòng: `/admin/categories` thêm danh mục → `/admin/products` thêm hàng vào danh mục đó → `/pos` bán một đơn ghi nợ cho khách mới → `/admin/debts` thấy khoản nợ → bấm "Khách trả tiền" → nợ biến mất → `/admin/reports` thấy doanh thu hôm nay.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin
git commit -m "feat(admin): add categories, orders, debts and reports pages"
```

---

## Task 18: E2E offline và quản lý sản phẩm

**Files:**
- Create: `e2e/pos-offline-sale.spec.ts`, `e2e/admin-products.spec.ts`

**Interfaces:**
- Consumes: toàn bộ Task 1–17

- [ ] **Step 1: Viết E2E offline**

Tạo `e2e/pos-offline-sale.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("Bán khi mất mạng", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: /vào bán hàng/i }).click();
    await page.waitForURL("**/pos");
  });

  test("mat mang van ban duoc, co mang lai thi tu dong bo", async ({ page, context }) => {
    const search = page.getByRole("combobox");

    // Ban binh thuong truoc de chac chan luong online van chay
    await search.fill("nhot");
    await search.press("Enter");
    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("button", { name: /đúng số tiền/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();
    await expect(page.getByText(/Đã lưu đơn DH/)).toBeVisible();
    await page.getByRole("button", { name: /đơn mới/i }).click();

    // Ngat mang
    await context.setOffline(true);

    await search.fill("duong");
    await search.press("Enter");
    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("button", { name: /đúng số tiền/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();

    // Van ban duoc, chi bao doi trang thai
    await expect(page.getByText(/sẽ đồng bộ khi có mạng/i)).toBeVisible();
    await page.getByRole("button", { name: /đơn mới/i }).click();
    await expect(page.getByText(/1 đơn chờ đồng bộ/)).toBeVisible();

    // Co mang lai
    await context.setOffline(false);
    await page.getByText(/1 đơn chờ đồng bộ/).click();

    await expect(page.getByText(/đơn chờ đồng bộ/)).toBeHidden({ timeout: 10_000 });
  });

  test("giu don roi mo lai", async ({ page }) => {
    const search = page.getByRole("combobox");

    await search.fill("nhot");
    await search.press("Enter");
    await expect(page.getByTestId("cart-total")).toHaveText("120.000");

    await page.getByRole("button", { name: /giữ đơn/i }).click();
    await expect(page.getByText(/chưa có sản phẩm/i)).toBeVisible();
    await expect(page.getByText(/đơn đang giữ/i)).toBeVisible();

    await page.getByRole("button", { name: /#1 — 120\.000/ }).click();
    await expect(page.getByTestId("cart-total")).toHaveText("120.000");
  });
});
```

- [ ] **Step 2: Viết E2E quản lý sản phẩm**

Tạo `e2e/admin-products.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("Quản lý sản phẩm", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: /vào bán hàng/i }).click();
    await page.waitForURL("**/pos");
  });

  test("them san pham roi tim duoc ngay o POS qua ten goi khac", async ({ page }) => {
    await page.goto("/admin/products");

    await page.getByLabel("Tên sản phẩm").fill("Ruột xe Dream");
    await page
      .getByLabel(/tên gọi khác/i)
      .fill("sam dream, ruot dream");
    await page.getByLabel("Đơn vị").fill("cái");
    await page.getByLabel("Giá bán (VND)").fill("55000");
    await page.getByLabel("Tồn kho").fill("10");
    await page.getByRole("button", { name: /thêm sản phẩm/i }).click();

    await expect(page.getByText("Ruột xe Dream")).toBeVisible();

    // Tim duoc bang ten goi khac, khong dau
    await page.goto("/pos");
    await page.getByRole("combobox").fill("sam dream");
    await expect(page.getByText("Ruột xe Dream")).toBeVisible();
  });

  test("ban ghi no roi tat toan o trang cong no", async ({ page }) => {
    await page.goto("/pos");

    const search = page.getByRole("combobox");
    await search.fill("duong");
    await search.press("Enter");

    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("tab", { name: /ghi nợ/i }).click();
    await page.getByLabel(/tên khách nợ/i).fill("Bà Lan");
    await page.getByRole("button", { name: /tạo khách mới/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();
    await page.getByRole("button", { name: /đơn mới/i }).click();

    await page.goto("/admin/debts");
    await expect(page.getByText("Bà Lan")).toBeVisible();

    await page.getByRole("button", { name: /khách trả tiền/i }).click();
    await expect(page.getByText(/không ai đang nợ/i)).toBeVisible();
  });
});
```

- [ ] **Step 3: Chạy E2E**

```bash
pnpm db:reset
pnpm test:e2e
```

Expected: toàn bộ test PASS, gồm cả `pos-cash-sale.spec.ts` của Plan 1.

> Test E2E ghi dữ liệu thật vào `prisma/dev.db`. Chạy `pnpm db:reset` trước mỗi lần chạy lại để tổng tiền khớp kỳ vọng.

- [ ] **Step 4: Chạy toàn bộ kiểm tra lần cuối**

Run: `pnpm check && pnpm build && pnpm test:e2e`
Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/pos-offline-sale.spec.ts e2e/admin-products.spec.ts
git commit -m "test(e2e): add offline sale and admin flows"
```

---

## Hoàn thành Spec 1

Sau Plan 2, cửa hàng có đủ:

- **Bán tại quầy** — gõ tìm tức thì (không dấu, nhiều từ rời, tên lóng), lưới danh mục, sửa giá và số lượng lẻ, tiền công sửa xe, giữ đơn, phím tắt F2/F4/F8
- **Thanh toán** — tiền mặt, VietQR động sinh trong máy, ghi nợ theo khách, đối soát thủ công
- **Mất mạng vẫn bán được** — PWA, danh mục cache sẵn, đơn xếp hàng rồi tự đồng bộ, chống trùng đơn
- **Quản lý** — sản phẩm, danh mục, đơn hàng, công nợ, báo cáo, cài đặt ngân hàng

**Bước tiếp theo (ngoài Spec 1):**

- **Spec 2 — Kho & mua hàng:** nhà cung cấp, phiếu nhập, giá vốn bình quân, báo cáo lãi, kiểm kê. `StockMovement` và `costPrice` đã có sẵn từ Plan 1, nên Spec 2 chỉ thêm màn hình và loại phiếu.
- **Spec 3 — Đơn hàng online:** `Order.channel` và `createOrder` tách khỏi UI đã sẵn sàng.

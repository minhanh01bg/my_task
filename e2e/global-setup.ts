import { execSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

/**
 * Chay mot lan truoc toan bo bo e2e: dua co so du lieu ve dung trang thai
 * vua seed. Khong co buoc nay thi chay bo test lan thu hai se hong — cac
 * test tao san pham, don hang va cong no roi khang dinh nhung thu nhu
 * "khong ai dang no", hoac tim mot ten san pham va gap hai ket qua.
 *
 * Setting duoc giu lai vi do la cau hinh cua hang, khong phai du lieu test.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    await prisma.adminNotification.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  } finally {
    await prisma.$disconnect();
  }

  execSync("pnpm db:seed", { stdio: "inherit" });
}

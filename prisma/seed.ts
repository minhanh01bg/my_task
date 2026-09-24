import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

import { buildSearchText } from "../src/lib/search/search-text";
import { backfillSlugs } from "../src/server/seo/backfill-slugs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

const prisma = new PrismaClient();

const CATEGORIES = [
  { key: "grocery", name: "Tạp hoá", sortOrder: 1 },
  { key: "footwear", name: "Giày dép", sortOrder: 2 },
  { key: "moto", name: "Phụ tùng xe", sortOrder: 3 },
];

const PRODUCTS = [
  {
    category: "grocery",
    name: "Đường trắng",
    unit: "kg",
    price: 25000,
    costPrice: 21000,
    stock: 40,
    aliases: null,
    sku: null,
    imageUrl: "/products/duong-trang.webp",
  },
  {
    category: "grocery",
    name: "Coca Cola chai 390ml",
    unit: "chai",
    price: 10000,
    costPrice: 8000,
    stock: 60,
    aliases: "nuoc ngot",
    sku: null,
    imageUrl: "/products/coca-cola-390ml.webp",
  },
  {
    category: "grocery",
    name: "Coca Cola lon 320ml",
    unit: "lon",
    price: 12000,
    costPrice: 9500,
    stock: 24,
    aliases: "nuoc ngot",
    sku: null,
    imageUrl: "/products/coca-cola-can-320ml.webp",
  },
  {
    category: "grocery",
    name: "Mì Hảo Hảo tôm chua cay",
    unit: "gói",
    price: 4500,
    costPrice: 3600,
    stock: 200,
    aliases: "mi tom",
    sku: null,
    imageUrl: "/products/mi-hao-hao.webp",
  },
  {
    category: "grocery",
    name: "Dây điện đôi",
    unit: "mét",
    price: 15000,
    costPrice: 11000,
    stock: 85.5,
    aliases: "day dien",
    sku: null,
    imageUrl: "/products/day-dien-doi.webp",
  },
  {
    category: "footwear",
    name: "Dép tông Lào size 40",
    unit: "đôi",
    price: 85000,
    costPrice: 65000,
    stock: 12,
    aliases: "dep lao",
    sku: null,
    imageUrl: "/products/dep-lao.webp",
  },
  {
    category: "footwear",
    name: "Giày bata trắng size 41",
    unit: "đôi",
    price: 150000,
    costPrice: 110000,
    stock: 6,
    aliases: null,
    sku: null,
    imageUrl: "/products/giay-bata-trang.webp",
  },
  {
    category: "moto",
    name: "Nhớt Castrol Power1 0.8L",
    unit: "chai",
    price: 120000,
    costPrice: 95000,
    stock: 15,
    aliases: "nhot xe may",
    sku: "PT-101",
    imageUrl: "/products/nhot-castrol-power1.webp",
  },
  {
    category: "moto",
    name: "Bugi NGK C7HSA",
    unit: "cái",
    price: 35000,
    costPrice: 24000,
    stock: 20,
    aliases: "bugi wave, bugi thuong",
    sku: "PT-102",
    imageUrl: "/products/bugi-ngk-c7hsa.webp",
  },
  {
    category: "moto",
    name: "Bộ nhông sên dĩa xe Wave",
    unit: "bộ",
    price: 280000,
    costPrice: 210000,
    stock: 4,
    aliases: "sen nhong dia, sen wave",
    sku: "PT-103",
    imageUrl: "/products/nhong-sen-dia-wave.webp",
  },
  {
    category: "moto",
    name: "Ruột xe máy 2.25-17",
    unit: "cái",
    price: 55000,
    costPrice: 38000,
    stock: 18,
    aliases: "sam xe",
    sku: "PT-104",
    imageUrl: "/products/ruot-xe-may.webp",
  },
];

const SAMPLE_VOUCHERS = [
  {
    code: "GIAM10",
    type: "percent",
    value: 10,
    maxDiscount: 30_000,
    minOrderTotal: 0,
  },
  {
    code: "FREESHIP",
    type: "freeship",
    value: 0,
    minOrderTotal: 200_000,
  },
];

async function main() {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: category.name, sortOrder: category.sortOrder },
    });
    categoryIds.set(category.key, created.id);
  }

  for (const item of PRODUCTS) {
    const categoryName = CATEGORIES.find((c) => c.key === item.category)?.name;
    await prisma.product.create({
      data: {
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        price: item.price,
        costPrice: item.costPrice,
        stock: item.stock,
        aliases: item.aliases,
        imageUrl: item.imageUrl,
        categoryId: categoryIds.get(item.category),
        searchText: buildSearchText({
          name: item.name,
          aliases: item.aliases,
          sku: item.sku,
          categoryName,
        }),
      },
    });
  }

  await prisma.adminIdentity.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      role: "owner",
      version: 1,
    },
    update: {},
  });

  // Voucher mẫu: upsert theo code, không đụng usedCount đã có.
  for (const voucher of SAMPLE_VOUCHERS) {
    await prisma.voucher.upsert({
      where: { code: voucher.code },
      create: voucher,
      update: {},
    });
  }

  // Seed ghi thẳng Prisma: gán slug SEO cùng quy tắc với saveProduct.
  const slugs = await backfillSlugs(prisma);

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${PRODUCTS.length} products, 1 admin identity, ${SAMPLE_VOUCHERS.length} vouchers; slugs: ${slugs.products} products, ${slugs.categories} categories`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

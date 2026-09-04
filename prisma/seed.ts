import { PrismaClient } from "@prisma/client";

import { buildSearchText } from "../src/lib/search/search-text";

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

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${PRODUCTS.length} products`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

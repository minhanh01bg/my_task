import assert from "node:assert/strict";

// Read-only: dùng được với production, không seed DB hay gửi lệnh ghi dữ liệu.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3001");
const failures = [];
let checks = 0;

async function check(path, statuses = [200], headers = {}, mime) {
  checks++;
  try {
    const response = await fetch(new URL(path, origin), {
      headers,
      redirect: path === "/admin" ? "manual" : "follow",
      signal: AbortSignal.timeout(20_000),
    });
    assert.ok(
      statuses.includes(response.status),
      `${path}: HTTP ${response.status}`,
    );
    if (mime)
      assert.match(response.headers.get("content-type") ?? "", mime, path);
    return await response.text();
  } catch (error) {
    failures.push(error.message);
    return "";
  }
}

const login = await check("/login?next=%2Fadmin", [200], {}, /text\/html/);
const scripts = new Set(
  [...login.matchAll(/src="(\/_next\/static\/[^\"]+\.js[^\"]*)"/g)].map(
    (match) => match[1],
  ),
);
if (!scripts.size) failures.push("Trang đăng nhập không có JavaScript chunks");
for (const path of scripts)
  await check(path, [200], {}, /(?:application|text)\/javascript/);

const shop = await check("/shop", [200], {}, /text\/html/);
const categories = new Set(
  [...shop.matchAll(/href="(\/shop\/c\/[^"?#]+)"/g)].map((match) => match[1]),
);
if (!categories.size)
  failures.push("Cửa hàng không có link danh mục để kiểm tra");
for (const path of categories) {
  await check(path, [200], {}, /text\/html/);
  await check(`${path}?_rsc=smoke`, [200], { RSC: "1" }, /text\/x-component/);
  await check(
    `${path}?page=2&_rsc=smoke`,
    [200, 404],
    { RSC: "1" },
    /text\/x-component/,
  );
}
for (const path of [
  "/shop/delivery-policy",
  "/shop/return-policy",
  "/shop/payment-policy",
  "/shop/privacy",
])
  await check(`${path}?_rsc=smoke`, [200], { RSC: "1" }, /text\/x-component/);
for (const path of [
  "/",
  "/checkout",
  "/account",
  "/account/login",
  "/account/register",
  "/account/orders",
  "/shop.webmanifest",
])
  await check(path);
// Bao gồm CTA do admin cấu hình trong banner/promotion và link sản phẩm thực tế.
const linkedPages = new Set(
  [...shop.matchAll(/<a\b[^>]*href="(\/[^"#?]*)[^"]*"/g)].map(
    (match) => match[1],
  ),
);
for (const path of linkedPages) {
  if (/^\/(?:admin|pos|login)(?:\/|$)/.test(path)) continue;
  if (
    categories.has(path) ||
    [
      "/shop",
      "/checkout",
      "/account/orders",
      "/account/login",
      "/account/register",
      "/shop/delivery-policy",
      "/shop/return-policy",
      "/shop/payment-policy",
      "/shop/privacy",
    ].includes(path)
  )
    continue;
  await check(path);
}
await check("/admin", [307]);

for (const failure of failures) process.stderr.write(`${failure}\n`);
process.stdout.write(`${checks} checks, ${failures.length} failures\n`);
if (failures.length) process.exitCode = 1;

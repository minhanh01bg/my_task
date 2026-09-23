/**
 * SQLite file dung rieng cho test — tach khoi dev.db, gitignored qua `*.db`.
 * Co the doi qua bien `TEST_DATABASE_URL` de nhieu tien trinh test chay
 * song song tren cac file khac nhau (vi du: `TEST_DATABASE_URL=file:./prisma/test-a.db`).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL?.trim() || "file:./prisma/test.db";

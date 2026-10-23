/**
 * Mat khau cua hang va mat khau chu dung cho e2e. playwright.config.ts sinh
 * ngau nhien moi lan chay va dua hash cho web server; production tu choi hash
 * mau (123456) nen khong co mat khau co dinh nao o day.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; run e2e through playwright.config.ts`);
  }
  return value;
}

export const STORE_PASSWORD = required("E2E_STORE_PASSWORD");
export const OWNER_PASSWORD = required("E2E_OWNER_PASSWORD");

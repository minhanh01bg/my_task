import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

async function main() {
  const { applyOnlineStoreRetention } =
    await import("@/server/privacy/retention");
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const dryRun = !isExecute;

  let retentionDays = 90;
  const daysIndex = args.indexOf("--days");
  if (daysIndex !== -1 && args[daysIndex + 1]) {
    const parsed = parseInt(args[daysIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      retentionDays = parsed;
    }
  }

  console.log("=================================================");
  console.log("       ONLINE STORE DATA RETENTION SERVICE       ");
  console.log("=================================================");
  console.log(
    `Mode:           ${dryRun ? "DRY-RUN (Preview Only)" : "EXECUTE (Permanent Modification)"}`,
  );
  console.log(`Retention Days: ${retentionDays} days`);
  console.log(`Timestamp:      ${new Date().toISOString()}`);
  console.log("-------------------------------------------------");

  const summary = await applyOnlineStoreRetention({
    dryRun,
    retentionDays,
  });

  console.log(
    `Cutoff Date:                       ${summary.cutoffDate.toISOString()}`,
  );
  console.log(`Eligible Orders Found:             ${summary.ordersEligible}`);
  if (!dryRun) {
    console.log(
      `Orders Anonymized:                 ${summary.ordersAnonymized}`,
    );
  }
  console.log(
    `Expired Guest Capabilities Purged: ${summary.expiredGuestAccessPurged}`,
  );
  console.log(
    `Expired Idempotency Purged:        ${summary.expiredIdempotencyPurged}`,
  );
  console.log(
    `Expired Customer Sessions Purged:  ${summary.expiredCustomerSessionsPurged}`,
  );
  console.log(
    `Expired Admin Sessions Purged:     ${summary.expiredAdminSessionsPurged}`,
  );
  console.log("=================================================");

  if (dryRun) {
    console.log(
      "\n[INFO] Dry-run completed. No database mutations were performed.",
    );
    console.log("To apply changes permanently, run with: --execute");
  } else {
    console.log("\n[SUCCESS] Retention policies applied successfully.");
  }
}

main().catch((err) => {
  console.error("[ERROR] Failed to execute data retention script:", err);
  process.exit(1);
});

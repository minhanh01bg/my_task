# Online Store Data Retention, Backup & PII Access Controls

## 1. Overview

This document defines the data retention schedule, privacy anonymization procedures, backup security, and access controls for the Online Store platform, in compliance with data protection principles and statutory accounting obligations.

---

## 2. Data Inventory & Classification Schedule

| Data Category                      | Table & Fields                                                                                                                                             | Data Owner                       | Purpose                                                                 | Retention Window                                     | Expiration Action                                                                                                 | Statutory / Legal Basis                              |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| **Order PII**                      | `Order.contactName`, `Order.contactPhone`, `Order.deliveryAddress`, `Order.deliveryWard`, `Order.deliveryDistrict`, `Order.deliveryProvince`, `Order.note` | Customer & Store Operations      | Contact, shipping address routing, order delivery verification          | **90 days** (configurable via `DATA_RETENTION_DAYS`) | **Anonymize** (name masked to `"Khách hàng đã ẩn danh"`, phone & addresses cleared, `anonymizedAt` timestamp set) | Data minimization principle                          |
| **Financial & Accounting Records** | `Order.id`, `Order.code`, `Order.total`, `Order.status`, `OrderItem.*`, `Payment.*`, `StockMovement.*`                                                     | Store Accounting & Tax Authority | Tax filing, financial auditing, inventory valuation, dispute resolution | **10 years** (3650 days)                             | **Permanent retention** (immutable line items, unit prices, payments, and movements)                              | Commercial tax and accounting statutory requirements |
| **Customer Sessions**              | `CustomerSession.tokenHash`, `CustomerSession.lastSeenAt`, `CustomerSession.expiresAt`                                                                     | Authentication Service           | User session authorization, access revocation                           | **30 days** post expiration                          | **Hard Delete** (unrecoverable purge)                                                                             | Security session lifecycle                           |
| **Admin Sessions & Audit**         | `AdminSession.tokenHash`, `AdminSession.lastSeenAt`, `AdminAuditEvent.eventType`, `AdminAuditEvent.targetId`                                               | Security Operations              | Attributable administrative audit trail, zero-customer-PII audit events | **1 year** (365 days)                                | **Hard Delete** for sessions; **Archive** for audit events                                                        | System integrity and administrative accountability   |
| **Transient Capabilities**         | `GuestOrderAccess.tokenHash`, `CheckoutIdempotency.recoveryDigest`, `CheckoutIdempotency.encryptedGuestToken`                                              | Online Checkout Service          | Capability recovery on lost connection, idempotency replay              | **7 days** post creation                             | **Hard Delete**                                                                                                   | Principle of least privilege for guest access        |
| **Limiter Telemetry**              | Upstash Redis keyed HMAC buckets (`rl:v1:...`)                                                                                                             | Platform Infrastructure          | Brute-force & DDoS mitigation                                           | **1–24 hours** (governed by Redis TTLs)              | **Auto-expire** via Redis `EXPIRE`                                                                                | Pseudonymized infrastructure protection              |

---

## 3. Legal Hold & Exemption Procedure

- Orders associated with ongoing disputes, litigation, law enforcement requests, or active investigations must have `Order.legalHold` set to `true`.
- The automated retention service explicitly checks `where: { legalHold: false }` and skips any record marked with a legal hold.
- Removing a legal hold requires explicit administrative authorization and an attributable audit entry.

---

## 4. Retention Automation

### 4.1 CLI Script

The retention routine is implemented in `src/server/privacy/retention.ts` and invoked via `scripts/apply-online-store-retention.ts`:

- **Dry-run (Default & Safe):**
  ```bash
  pnpm exec tsx scripts/apply-online-store-retention.ts --dry-run
  ```
- **Execute (Permanent modification):**
  ```bash
  pnpm exec tsx scripts/apply-online-store-retention.ts --execute --days 90
  ```

### 4.2 Invariant Guarantees

1. **Financial Immutability**: Financial totals (`order.total`, `order.shippingFee`), order line items (`OrderItem`), payments (`Payment`), and inventory ledger entries (`StockMovement`) are never altered or deleted during anonymization.
2. **Idempotency**: Running the retention process multiple times produces no additional modifications or errors.
3. **Bounded Batches**: Updates are processed in configurable chunk sizes (default 100) to prevent table locks or transaction timeouts in SQLite/PostgreSQL.

---

## 5. Storage Security & Encryption Controls

### 5.1 Volume & Database Encryption

- Production database storage (`dev.db`, production SQLite, or managed PostgreSQL) must reside on encrypted persistent volumes (e.g. AWS EBS with KMS AES-256, GCP Persistent Disk encryption, or BitLocker/LUKS).
- Database files (`*.db`, `*.sqlite`, `*.sqlite-journal`) are strictly excluded from source control via `.gitignore`.
- Database backups must never be committed to source repositories or exported into public CI build artifacts.

### 5.2 Backup Management & Restore Verification

- **Automated Snapshots**: Database snapshots are captured daily and encrypted using AES-256 with customer-managed keys (CMK).
- **Backup Retention**: Daily backups are retained for 30 days; monthly accounting snapshots are retained for 10 years in immutable, versioned object storage (e.g. S3 Object Lock / WORM).
- **Drill / Restore Testing**: A quarterly automated restore test restores the snapshot to an isolated environment and executes data consistency assertions.

### 5.3 Least-Privilege Access Roles

- Application processes run under dedicated non-root service accounts with file permissions restricted to the application root.
- Administrative access to production databases requires multi-factor authentication (MFA) and just-in-time (JIT) access approval with session recording.

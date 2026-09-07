export interface BucketConfig {
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitPolicy {
  name: string;
  failClosed: boolean;
  timeoutMs?: number;
  buckets: BucketConfig[];
}

/**
 * Predefined rate-limit policies for Online Store sensitive boundaries.
 */
export const POLICIES = {
  checkoutIp: {
    name: "checkout-ip",
    failClosed: true,
    timeoutMs: 1500,
    buckets: [
      { name: "ip-burst", limit: 10, windowSeconds: 60 },
      { name: "subnet-burst", limit: 50, windowSeconds: 60 },
      { name: "global-burst", limit: 500, windowSeconds: 60 },
    ],
  },
  checkoutPhone: {
    name: "checkout-phone",
    failClosed: true,
    timeoutMs: 1500,
    buckets: [{ name: "phone-hourly", limit: 5, windowSeconds: 3600 }],
  },
  checkoutProduct: {
    name: "checkout-product",
    failClosed: true,
    timeoutMs: 1500,
    buckets: [{ name: "product-velocity", limit: 100, windowSeconds: 60 }],
  },
  customerAuth: {
    name: "customer-auth",
    failClosed: true,
    timeoutMs: 1500,
    buckets: [
      { name: "ip-attempts", limit: 20, windowSeconds: 900 },
      { name: "subnet-attempts", limit: 100, windowSeconds: 900 },
      { name: "phone-attempts", limit: 5, windowSeconds: 900 },
      { name: "global-attempts", limit: 1000, windowSeconds: 900 },
    ],
  },
  adminLogin: {
    name: "admin-login",
    failClosed: true,
    timeoutMs: 1500,
    buckets: [
      { name: "ip-attempts", limit: 10, windowSeconds: 900 },
      { name: "global-attempts", limit: 30, windowSeconds: 900 },
    ],
  },
} as const satisfies Record<string, RateLimitPolicy>;

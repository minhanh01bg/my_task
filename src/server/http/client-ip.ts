import net from "node:net";

import { env } from "@/config/env";

export type TrustedProxyMode = "none" | "vercel" | "cloudflare" | "custom";

export interface ClientIpOptions {
  mode?: TrustedProxyMode;
  customHeader?: string;
  isProduction?: boolean;
}

export type ClientIpResolution =
  | {
      ok: true;
      ip: string;
      family: "ipv4" | "ipv6";
      subnet: string;
      isLoopback: boolean;
      isPrivate: boolean;
    }
  | {
      ok: false;
      error:
        | "missing_header"
        | "invalid_ip"
        | "untrusted_proxy_mode"
        | "private_address_rejected";
    };

function parseIpv6Hextets(ip: string): number[] | null {
  const parts = ip.split("::");
  if (parts.length > 2) return null;

  if (parts.length === 1) {
    const segments = ip.split(":");
    if (segments.length !== 8) return null;
    const nums: number[] = [];
    for (const s of segments) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(s)) return null;
      nums.push(parseInt(s, 16));
    }
    return nums;
  }

  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts[1] ? parts[1].split(":") : [];
  if (left.length + right.length >= 8) return null;

  const leftNums: number[] = [];
  for (const s of left) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(s)) return null;
    leftNums.push(parseInt(s, 16));
  }

  const rightNums: number[] = [];
  for (const s of right) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(s)) return null;
    rightNums.push(parseInt(s, 16));
  }

  const fillCount = 8 - (leftNums.length + rightNums.length);
  const fill = new Array(fillCount).fill(0);
  return [...leftNums, ...fill, ...rightNums];
}

function formatCanonicalIpv6(hextets: number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < 8; i++) {
    if (hextets[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen < 2) {
    return hextets.map((h) => h.toString(16)).join(":");
  }

  const left = hextets
    .slice(0, bestStart)
    .map((h) => h.toString(16))
    .join(":");
  const right = hextets
    .slice(bestStart + bestLen)
    .map((h) => h.toString(16))
    .join(":");
  return `${left}::${right}`;
}

function classifyIpv4(ipStr: string): ClientIpResolution {
  const parts = ipStr.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return { ok: false, error: "invalid_ip" };
  }

  const canonicalIp = parts.join(".");
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  const isLoopback = parts[0] === 127;
  const isPrivate =
    isLoopback ||
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254);

  return {
    ok: true,
    ip: canonicalIp,
    family: "ipv4",
    subnet,
    isLoopback,
    isPrivate,
  };
}

function classifyIpv6(hextets: number[]): ClientIpResolution {
  const isLoopback =
    hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1;
  const isPrivate =
    isLoopback ||
    (hextets[0] & 0xfe00) === 0xfc00 || // fc00::/7 Unique Local
    (hextets[0] & 0xffc0) === 0xfe80; // fe80::/10 Link Local

  const canonicalIp = formatCanonicalIpv6(hextets);

  // Derive /64 subnet
  const prefix4 = hextets.slice(0, 4);
  while (prefix4.length > 0 && prefix4[prefix4.length - 1] === 0) {
    prefix4.pop();
  }
  const subnet =
    prefix4.length === 0
      ? "::/64"
      : `${prefix4.map((h) => h.toString(16)).join(":")}::/64`;

  return {
    ok: true,
    ip: canonicalIp,
    family: "ipv6",
    subnet,
    isLoopback,
    isPrivate,
  };
}

/**
 * Resolves trusted client IP according to server configuration.
 *
 * CRITICAL SECURITY INVARIANT:
 * Untrusted client-supplied headers (e.g. raw X-Forwarded-For) must never
 * be used to resolve client identity or bypass rate limits.
 * In production, unresolved client IP fails closed with an explicit error.
 */
export function resolveTrustedClientIp(
  request: Request,
  options?: ClientIpOptions,
): ClientIpResolution {
  const mode = options?.mode ?? env.TRUSTED_PROXY_MODE;
  const customHeader = options?.customHeader ?? env.TRUSTED_CLIENT_IP_HEADER;
  const isProduction = options?.isProduction ?? env.NODE_ENV === "production";

  if (mode === "none") {
    if (isProduction) {
      return { ok: false, error: "untrusted_proxy_mode" };
    }
    // In local development and testing, fallback to loopback
    return {
      ok: true,
      ip: "127.0.0.1",
      family: "ipv4",
      subnet: "127.0.0.0/24",
      isLoopback: true,
      isPrivate: true,
    };
  }

  let rawHeader: string | null = null;

  if (mode === "cloudflare") {
    rawHeader = request.headers.get("cf-connecting-ip");
  } else if (mode === "vercel") {
    rawHeader =
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-real-ip");
  } else if (mode === "custom" && customHeader) {
    rawHeader = request.headers.get(customHeader.toLowerCase());
  }

  if (!rawHeader) {
    return { ok: false, error: "missing_header" };
  }

  // If header contains multiple comma-separated values, reject as invalid to avoid ambiguity
  if (rawHeader.includes(",")) {
    return { ok: false, error: "invalid_ip" };
  }

  const trimmed = rawHeader.trim();
  if (!trimmed) {
    return { ok: false, error: "invalid_ip" };
  }

  // Check for IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (trimmed.toLowerCase().startsWith("::ffff:")) {
    const v4Candidate = trimmed.slice(7);
    if (net.isIP(v4Candidate) === 4) {
      return classifyIpv4(v4Candidate);
    }
  }

  const ipVersion = net.isIP(trimmed);
  if (ipVersion === 4) {
    return classifyIpv4(trimmed);
  }

  if (ipVersion === 6) {
    const hextets = parseIpv6Hextets(trimmed);
    if (!hextets) {
      return { ok: false, error: "invalid_ip" };
    }
    return classifyIpv6(hextets);
  }

  return { ok: false, error: "invalid_ip" };
}

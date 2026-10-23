import { describe, expect, it } from "vitest";

import {
  isInternalHost,
  isPublicHttpsUrl,
  isSafeRelativePath,
} from "@/lib/safe-url";

describe("isInternalHost (WEB-7c)", () => {
  it.each([
    "localhost",
    "LOCALHOST.",
    // More than one trailing dot
    "localhost..",
    "localhost...",
    "127.0.0.1..",
    "api.localhost..",
    "api.localhost",
    "printer.local",
    "0.0.0.0",
    "127.0.0.1",
    "127.8.9.10",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    // Decimal, octal, hex and shorthand IPv4
    "2130706433",
    "0177.0.0.1",
    "0x7f.0.0.1",
    "0x7f000001",
    "127.1",
    "0xa9fea9fe",
    // IPv6
    "::1",
    "[::1]",
    "::",
    "0:0:0:0:0:0:0:1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "febf::1",
    "::ffff:127.0.0.1",
    "[::ffff:7f00:1]",
    "::ffff:a9fe:a9fe",
    "::ffff:10.0.0.1",
    // Carrier-grade NAT 100.64.0.0/10 and benchmark 198.18.0.0/15
    "100.64.0.1",
    "100.127.255.255",
    "198.18.0.1",
    "198.19.255.255",
    "::ffff:100.64.0.1",
    // NAT64 64:ff9b::/96 with an internal embedded IPv4
    "64:ff9b::127.0.0.1",
    "64:ff9b::a9fe:a9fe",
    "[64:ff9b::7f00:1]",
    "64:ff9b:0:0:0:0:10.0.0.1",
    "64:ff9b::100.64.0.1",
    // IPv4 multicast 224.0.0.0/4 and reserved 240.0.0.0/4 (incl. broadcast)
    "224.0.0.1",
    "239.255.255.250",
    "240.0.0.1",
    "255.255.255.255",
    "0xffffffff",
    "::ffff:224.0.0.1",
    // IPv6 multicast ff00::/8
    "ff02::1",
    "ff05::1:3",
    "[ff0e::1]",
    // 6to4 2002::/16 with an internal embedded IPv4
    "2002:7f00:1::",
    "2002:7f00:0001::1",
    "2002:a9fe:a9fe::1",
    "2002:0a00:0001::",
    "2002:c0a8:0101::1",
    "2002:e000:1::",
    // Teredo 2001:0::/32 is blocked whole
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "2001::80ff:fffe",
    "[2001:0000:5ef5:79fd::1]",
  ])("blocks %s", (host) => {
    expect(isInternalHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "images.unsplash.com",
    "localhost.example.com",
    "10.example.com",
    "8.8.8.8",
    "172.15.255.255",
    "172.32.0.1",
    "192.169.0.1",
    "169.255.0.1",
    "2606:4700::1111",
    "::ffff:8.8.8.8",
    "100.63.255.255",
    "100.128.0.1",
    "198.17.255.255",
    "198.20.0.1",
    "64:ff9b::8.8.8.8",
    "64:ff9b::808:808",
    "223.255.255.255",
    "2002:808:808::1",
    "2001:4860:4860::8888",
    "2001:1::1",
  ])("allows public host %s", (host) => {
    expect(isInternalHost(host)).toBe(false);
  });
});

describe("isInternalHost reserved ranges and local names (WB-5)", () => {
  it.each([
    // Single-label names resolve through the local DNS search domain
    "intranet",
    "router",
    "metadata",
    // Private-use and special-use suffixes
    "db.internal",
    "metadata.google.internal",
    "nas.lan",
    "printer.home.arpa",
    "printer.local",
    "api.localhost",
    "NAS.LAN.",
    // IETF protocol assignments 192.0.0.0/24 and TEST-NETs
    "192.0.0.1",
    "192.0.0.170",
    "192.0.2.1",
    "198.51.100.7",
    "203.0.113.255",
    // Benchmarking 198.18.0.0/15, reserved 240.0.0.0/4 and broadcast
    "198.18.5.5",
    "240.1.2.3",
    "255.255.255.255",
    // IPv4-mapped ::ffff:0:0/96 (dotted and hex) and translated ::ffff:0:0:0/96
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "[::ffff:c000:201]",
    "::ffff:0:127.0.0.1",
    "::ffff:0:7f00:1",
    "::ffff:0:a9fe:a9fe",
    "::ffff:0:8.8.8.8",
    // NAT64 well-known 64:ff9b::/96 and local-use 64:ff9b:1::/48
    "64:ff9b::7f00:1",
    "64:ff9b::192.0.2.1",
    "64:ff9b:1::1",
    "64:ff9b:1:ffff::8.8.8.8",
    // Site-local fec0::/10 (deprecated), discard-only 100::/64
    "fec0::1",
    "feff::1",
    "100::",
    "100::1:2:3:4",
    // Documentation 2001:db8::/32 and 3fff::/20
    "2001:db8::1",
    "[2001:0db8:85a3::8a2e:370:7334]",
    "3fff::1",
    "3fff:fff::1",
    // Anything outside global unicast 2000::/3 is not publicly routable
    "4000::1",
    "5f00::1",
    "fe00::1",
  ])("blocks %s", (host) => {
    expect(isInternalHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "cdn.example.vn",
    "internal.example.com",
    "lan.example.com",
    "local-images.example.com",
    "8.8.8.8",
    "134744072",
    "192.0.1.255",
    "192.0.3.1",
    "198.51.99.1",
    "198.51.101.1",
    "203.0.112.1",
    "203.0.114.1",
    "64:ff9b::808:808",
    "::ffff:8.8.8.8",
    "2001:db9::1",
    "2001:4860:4860::8888",
    "3fff:1000::1",
    "2606:4700::1111",
  ])("allows public host %s", (host) => {
    expect(isInternalHost(host)).toBe(false);
  });

  it.each([
    "https://intranet/a.png",
    "https://metadata.google.internal/computeMetadata/v1",
    "https://nas.lan/a.png",
    "https://printer.home.arpa/a.png",
    "https://192.0.2.10/a.png",
    "https://[::ffff:0:a9fe:a9fe]/latest/meta-data",
    "https://[64:ff9b:1::a9fe:a9fe]/latest/meta-data",
    "https://[fec0::1]/a.png",
    "https://[100::1]/a.png",
    "https://[2001:db8::1]/a.png",
  ])("isPublicHttpsUrl rejects %s", (value) => {
    expect(isPublicHttpsUrl(value)).toBe(false);
  });
});

describe("isPublicHttpsUrl (WEB-7a)", () => {
  it("accepts a public https URL", () => {
    expect(isPublicHttpsUrl("https://images.unsplash.com/photo-1")).toBe(true);
  });

  it.each([
    "http://example.com/a.png",
    "//evil.com/a.png",
    "/uploads/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://user:pass@example.com/a.png",
    "https://localhost./a.png",
    "https://localhost../a.png",
    "https://127.0.0.1../a.png",
    "https://127.0.0.1/a.png",
    "https://2130706433/a.png",
    "https://0x7f.1/a.png",
    "https://[::1]/a.png",
    "https://[::ffff:127.0.0.1]/a.png",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/a.png",
    "https://198.18.0.1/a.png",
    "https://[64:ff9b::169.254.169.254]/latest/meta-data",
    "https://255.255.255.255/a.png",
    "https://[ff02::1]/a.png",
    "https://[2002:a9fe:a9fe::]/latest/meta-data",
    "https://[2001::80ff:fffe]/a.png",
    "not a url",
  ])("rejects %s", (value) => {
    expect(isPublicHttpsUrl(value)).toBe(false);
  });
});

describe("isSafeRelativePath (WEB-7b)", () => {
  it.each([
    "/shop/banh-mi",
    "/shop?category=sale",
    "/shop#catalog",
    "/uploads/promo.jpg",
  ])("accepts %s", (value) => {
    expect(isSafeRelativePath(value)).toBe(true);
  });

  it.each([
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "/\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://example.com",
    "javascript:alert(1)",
    "shop",
    "",
  ])("rejects %j", (value) => {
    expect(isSafeRelativePath(value)).toBe(false);
  });
});

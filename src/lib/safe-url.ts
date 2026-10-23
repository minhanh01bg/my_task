/**
 * URL checks shared by admin forms (client) and server validation, so this
 * file must stay isomorphic: no Node or DOM-only APIs beyond `URL`.
 */

const RELATIVE_BASE = "https://relative.invalid";

const INTERNAL_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast 255.255.255.255
];

/**
 * Parses IPv4 the way the WHATWG URL parser does: 1-4 parts, each decimal,
 * octal (leading 0) or hex (0x), so "2130706433", "0177.1" and "0x7f.0.0.1"
 * all resolve to 127.0.0.1.
 */
function parseIPv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length > 4) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    let value: number;
    if (/^0x[0-9a-f]*$/i.test(part)) {
      value = part.length === 2 ? 0 : parseInt(part.slice(2), 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = parseInt(part, 8);
    } else if (/^(?:0|[1-9][0-9]*)$/.test(part)) {
      value = Number(part);
    } else {
      return null;
    }
    numbers.push(value);
  }

  const last = numbers.pop()!;
  if (numbers.some((n) => n > 255) || last >= 256 ** (4 - numbers.length)) {
    return null;
  }
  return numbers.reduce((sum, n, i) => sum + n * 256 ** (3 - i), last);
}

function isInternalIPv4(address: number): boolean {
  return INTERNAL_IPV4_RANGES.some(([base, bits]) => {
    const shift = 32 - bits;
    return address >>> shift === parseIPv4(base)! >>> shift;
  });
}

/** Expands an IPv6 address (with optional dotted IPv4 tail) to 8 groups. */
function parseIPv6(host: string): number[] | null {
  let address = host;
  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    address,
  );
  if (dotted) {
    const [a, b, c, d] = dotted.slice(2).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    address = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) =>
    part === ""
      ? []
      : part
          .split(":")
          .map((group) =>
            /^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN,
          );
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if ([...head, ...tail].some(Number.isNaN)) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}

function isInternalIPv6(groups: number[]): boolean {
  const [first] = groups;
  // fc00::/7 unique local, fe80::/10 link local, ff00::/8 multicast
  if (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00
  ) {
    return true;
  }
  // Teredo 2001:0::/32 hides the client IPv4 (bit-inverted) and relays
  // through a third-party server; no legitimate image host needs it, so the
  // whole prefix is blocked instead of decoding the client address.
  if (first === 0x2001 && groups[1] === 0) return true;
  // 6to4 2002::/16 embeds the IPv4 in groups 1-2
  if (first === 0x2002) {
    return isInternalIPv4(((groups[1] << 16) | groups[2]) >>> 0);
  }
  const embeddedIPv4 = ((groups[6] << 16) | groups[7]) >>> 0;
  // ::, ::1, IPv4-compatible (::a.b.c.d) and IPv4-mapped (::ffff:a.b.c.d)
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    (groups[5] === 0 || groups[5] === 0xffff)
  ) {
    return isInternalIPv4(embeddedIPv4);
  }
  // NAT64 well-known prefix 64:ff9b::/96 is translated to the embedded IPv4
  if (
    first === 0x64 &&
    groups[1] === 0xff9b &&
    groups.slice(2, 6).every((group) => group === 0)
  ) {
    return isInternalIPv4(embeddedIPv4);
  }
  // Documentation 2001:db8::/32 and 3fff::/20
  if (
    (first === 0x2001 && groups[1] === 0xdb8) ||
    (first === 0x3fff && groups[1] < 0x1000)
  ) {
    return true;
  }
  // Only global unicast 2000::/3 is publicly routed. This also covers
  // site-local fec0::/10, discard-only 100::/64, IPv4-translated
  // ::ffff:0:0:0/96 and local-use NAT64 64:ff9b:1::/48.
  return (first & 0xe000) !== 0x2000;
}

/** Private-use and special-use DNS suffixes that never resolve publicly. */
const INTERNAL_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home.arpa",
];

/**
 * True for loopback, private, link-local, carrier-grade NAT, benchmarking,
 * documentation, multicast, reserved and unspecified addresses (also behind
 * NAT64 or 6to4), for IPv6 outside global unicast, for any Teredo address,
 * and for single-label or local-only names. An IPv6 literal that cannot be
 * parsed counts as internal (fail closed).
 */
export function isInternalHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    // Every trailing dot: "localhost.." would otherwise pass as a dotted name.
    .replace(/\.+$/, "");

  if (
    host === "" ||
    host === "localhost" ||
    INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return true;
  }

  if (host.includes(":")) {
    const groups = parseIPv6(host);
    return groups === null || isInternalIPv6(groups);
  }

  const ipv4 = parseIPv4(host);
  if (ipv4 !== null) return isInternalIPv4(ipv4);
  // Single-label names ("intranet") resolve through the local search domain
  return !host.includes(".");
}

/** An absolute https URL to a public host, without embedded credentials. */
export function isPublicHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !isInternalHost(url.hostname)
  );
}

/**
 * A same-origin path such as "/shop/banh-mi". Rejects "//evil.com" and
 * "/\evil.com", which browsers resolve to another host, and control
 * characters (tab/newline) that the URL parser silently drops.
 */
export function isSafeRelativePath(value: string): boolean {
  if (!value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) {
    return false;
  }
  try {
    return new URL(value, RELATIVE_BASE).origin === RELATIVE_BASE;
  } catch {
    return false;
  }
}

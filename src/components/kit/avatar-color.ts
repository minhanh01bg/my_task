/**
 * Bam ten ra mot goc mau on dinh. Khong dung Math.random vi anh du phong
 * phai giong nhau giua server va client, neu khong React se bao hydrate lech.
 */
export function avatarHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

/** Chu cai dau cua toi da hai tu dau — du de phan biet trong luoi. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

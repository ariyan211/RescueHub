import { randomInt } from "node:crypto";

// Crockford base32 without I, L, O, U: easy to read aloud over a phone line.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * RH-<year>-<8 chars>  → 32^8 ≈ 1.1e12 combinations, so codes are not enumerable
 * by the public tracking endpoint (which is also rate limited).
 */
export function generateTrackingCode(date = new Date()): string {
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `RH-${date.getUTCFullYear()}-${suffix}`;
}

/** Uppercases and fixes look-alike characters (I/L→1, O→0) in the random suffix only. */
export function normalizeTrackingCode(input: string): string {
  const code = input.trim().toUpperCase();
  const cut = code.lastIndexOf("-");
  if (cut < 0) return code;
  return code.slice(0, cut + 1) + code.slice(cut + 1).replace(/[IL]/g, "1").replace(/O/g, "0");
}

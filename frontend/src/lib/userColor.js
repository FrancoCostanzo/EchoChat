/* Deterministic per-user accent for group chats (Discord/Telegram-style).
   Hash the stable user id into a curated palette so each participant keeps
   the same hue everywhere, with enough contrast on dark & light surfaces. */

const PALETTE = [
  'oklch(0.72 0.16 275)', // periwinkle
  'oklch(0.72 0.15 155)', // green
  'oklch(0.75 0.14 220)', // sky
  'oklch(0.75 0.15 65)',  // amber
  'oklch(0.72 0.17 15)',  // coral
  'oklch(0.72 0.16 320)', // orchid
  'oklch(0.75 0.13 185)', // teal
  'oklch(0.74 0.15 345)', // pink
];

export function userColor(seed) {
  if (!seed) return PALETTE[0];
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

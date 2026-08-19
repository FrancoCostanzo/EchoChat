/** Matches backend defaults in system_settings (0 = unlimited). */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const MESSAGE_DELETE_WINDOW_MS = 15 * 60 * 1000;

export function isWithinMessageWindow(sentAt, windowMs) {
  if (windowMs <= 0) return true;
  if (!sentAt) return false;
  const sent = new Date(sentAt).getTime();
  if (!Number.isFinite(sent)) return false;
  return Date.now() - sent <= windowMs;
}

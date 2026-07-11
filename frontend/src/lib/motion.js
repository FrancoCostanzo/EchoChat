/** Shared motion presets — keep chat animations consistent and respect reduced motion. */
export const EASE_OUT = [0.34, 1, 0.64, 1];
export const SPRING_SNAPPY = { type: 'spring', stiffness: 420, damping: 30 };
export const SPRING_SOFT = { type: 'spring', stiffness: 320, damping: 28 };
export const SPRING_BOUNCY = { type: 'spring', stiffness: 380, damping: 22 };

export function msgEntryTransition(isOwn, reducedMotion) {
  if (reducedMotion) return { duration: 0.01 };
  return isOwn ? SPRING_SNAPPY : { duration: 0.24, ease: EASE_OUT };
}

export function msgEntryInitial(isOwn, shouldAnimate, reducedMotion) {
  if (!shouldAnimate || reducedMotion) return false;
  return isOwn
    ? { opacity: 0, y: 14, x: 10, scale: 0.94 }
    : { opacity: 0, y: 10, x: -8, scale: 0.97 };
}

/** Staggered list-item entrance (same pattern as the chat sidebar items). */
export function listItemEntry(index, reducedMotion) {
  if (reducedMotion) return {};
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: EASE_OUT, delay: Math.min(index, 12) * 0.02 },
  };
}

/** Fade + slight scale for empty states / tab panels. */
export const PANEL_FADE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.16, ease: EASE_OUT },
};

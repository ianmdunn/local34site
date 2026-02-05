/**
 * Single source of truth for Yale wealth ticker.
 * Base date: end of FY25. Growth: $44.1B × 8.25% / 365 = $9,967,808/day.
 */

export const CONFIG = {
  baseEndowment: 44_100_000_000,
  baseDate: new Date('2025-06-30T00:00:00'),
};

export const GROWTH_PER_DAY = 9_967_808;
export const GROWTH_PER_SECOND = GROWTH_PER_DAY / 86400;

/**
 * Accumulated growth since base date (same value the ticker displays).
 * @returns {number} Growth in dollars (>= 0)
 */
export function getAccumulatedGrowth() {
  const now = Date.now();
  const diffSeconds = (now - CONFIG.baseDate.getTime()) / 1000;
  return Math.max(0, diffSeconds * GROWTH_PER_SECOND);
}

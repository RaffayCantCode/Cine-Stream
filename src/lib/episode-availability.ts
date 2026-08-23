/**
 * Centralized configuration and calculation for episode availability.
 *
 * Rules:
 * 1. Exact release datetime (with time): Add a 2-hour buffer.
 *    Episode becomes available only after (official_datetime + 2h).
 * 2. Date-only release date (no time): Do not unlock at 12:00 AM.
 *    Use a 6-hour fallback delay from the start of that release date.
 */

export const EPISODE_AVAILABILITY_CONFIG = {
  /** Buffer in hours added when an exact release datetime is provided */
  exactTimeBufferHours: 2,
  /** Fallback delay in hours from the start of release date when no time is provided */
  missingTimeFallbackHours: 6,
};

/**
 * Checks if a string or number represents an exact release datetime with time.
 */
function hasExactTime(value: string | number | Date): boolean {
  if (typeof value === "number") {
    // Unix timestamp (seconds or ms) has exact time
    return true;
  }
  if (value instanceof Date) {
    return value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0 || value.getUTCSeconds() !== 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Check for explicit time part (e.g., "2026-08-17T06:00:00", "2026-08-17 14:30", etc.)
    const timeMatch = trimmed.match(/[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      // If non-zero time is explicitly given, it's an exact time
      return !(hours === 0 && minutes === 0 && seconds === 0);
    }
    return false;
  }
  return false;
}

/**
 * Calculates the exact timestamp (in ms) when an episode becomes available on CineStream.
 *
 * @param dateValue - Release date string (e.g. "2026-08-17", "2026-08-17T06:00:00Z"), Unix timestamp, or Date.
 * @returns Date object of availability, or null if dateValue is invalid / missing.
 */
export function getEpisodeAvailableAt(
  dateValue?: string | number | Date | null,
  config = EPISODE_AVAILABILITY_CONFIG
): Date | null {
  if (dateValue === null || dateValue === undefined || dateValue === "") {
    return null;
  }

  // 1. Unix timestamp (seconds or milliseconds)
  if (typeof dateValue === "number") {
    const ms = dateValue < 1e11 ? dateValue * 1000 : dateValue;
    if (Number.isNaN(ms) || ms <= 0) return null;
    const availableMs = ms + config.exactTimeBufferHours * 60 * 60 * 1000;
    return new Date(availableMs);
  }

  // 2. Date object
  if (dateValue instanceof Date) {
    if (Number.isNaN(dateValue.getTime())) return null;
    const isExact = hasExactTime(dateValue);
    const delayHours = isExact ? config.exactTimeBufferHours : config.missingTimeFallbackHours;
    return new Date(dateValue.getTime() + delayHours * 60 * 60 * 1000);
  }

  // 3. String representation
  if (typeof dateValue === "string") {
    const str = dateValue.trim();
    if (!str) return null;

    // Check for pure unix string (e.g. "1755410400")
    if (/^\d{9,13}$/.test(str)) {
      const num = parseInt(str, 10);
      return getEpisodeAvailableAt(num, config);
    }

    const isExact = hasExactTime(str);

    if (isExact) {
      const parsed = new Date(str);
      if (Number.isNaN(parsed.getTime())) return null;
      // Add exact time buffer (2 hours)
      return new Date(parsed.getTime() + config.exactTimeBufferHours * 60 * 60 * 1000);
    }

    // Date-only string (e.g. "2026-08-17", "2026/08/17", "2026-08-17T00:00:00")
    const datePart = str.split(/[T\s]/)[0];
    const match = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      // Start of release date in UTC: Date.UTC(year, month, day, 0, 0, 0)
      const startOfDayUtc = Date.UTC(year, month, day, 0, 0, 0);
      if (Number.isNaN(startOfDayUtc)) return null;

      // Add missing time fallback delay (12 hours) from the start of the release date
      return new Date(startOfDayUtc + config.missingTimeFallbackHours * 60 * 60 * 1000);
    }

    // Fallback parser if date format is non-standard
    const fallbackParsed = new Date(str);
    if (Number.isNaN(fallbackParsed.getTime())) return null;
    return new Date(fallbackParsed.getTime() + config.missingTimeFallbackHours * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Returns true if the episode is currently available to watch based on its release date/time.
 */
export function isEpisodeAvailable(
  dateValue?: string | number | Date | null,
  nowMs = Date.now(),
  config = EPISODE_AVAILABILITY_CONFIG
): boolean {
  if (!dateValue) return true;
  const availableAt = getEpisodeAvailableAt(dateValue, config);
  if (!availableAt) return true;
  return nowMs >= availableAt.getTime();
}

/**
 * Returns true if the episode is upcoming / not yet available.
 */
export function isEpisodeUpcoming(
  dateValue?: string | number | Date | null,
  nowMs = Date.now(),
  config = EPISODE_AVAILABILITY_CONFIG
): boolean {
  if (!dateValue) return false;
  const availableAt = getEpisodeAvailableAt(dateValue, config);
  if (!availableAt) return false;
  return nowMs < availableAt.getTime();
}

/**
 * Checks if an upcoming episode will air within the next X days.
 */
export function isWithinUpcomingDays(
  dateValue?: string | number | Date | null,
  days = 7,
  nowMs = Date.now(),
  config = EPISODE_AVAILABILITY_CONFIG
): boolean {
  if (!dateValue) return false;
  const availableAt = getEpisodeAvailableAt(dateValue, config);
  if (!availableAt) return false;
  const time = availableAt.getTime();
  const maxTime = nowMs + days * 24 * 60 * 60 * 1000;
  return time >= nowMs && time <= maxTime;
}

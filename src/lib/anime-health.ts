/**
 * Anime Primary API Health Tracker & Circuit Breaker
 *
 * Ensures AniList remains the primary data source at all times.
 * A single timeout or temporary rate-limit does NOT trigger emergency fallback.
 * Emergency fallback (Kitsu) is only activated after confirmed, consecutive primary outages.
 * Probes primary health periodically to auto-recover immediately when primary is back.
 */

export type HealthStatus = "HEALTHY" | "DEGRADED" | "OUTAGE";

interface CircuitBreakerState {
  status: HealthStatus;
  consecutiveFailures: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  lastProbeTime: number;
}

const FAILURE_THRESHOLD = 3; // 3 consecutive confirmed failures across primary sources required for outage
const PROBE_INTERVAL_MS = 45 * 1000; // Check primary health every 45s during outage
const DEGRADED_WINDOW_MS = 60 * 1000; // Reset consecutive failures if no new failure within 60s

const state: CircuitBreakerState = {
  status: "HEALTHY",
  consecutiveFailures: 0,
  lastFailureTime: 0,
  lastSuccessTime: Date.now(),
  lastProbeTime: 0,
};

/**
 * Record a successful response from primary sources (AniList).
 * Immediately restores circuit breaker status to HEALTHY.
 */
export function recordPrimarySuccess(): void {
  state.consecutiveFailures = 0;
  state.status = "HEALTHY";
  state.lastSuccessTime = Date.now();
}

/**
 * Record a failure from primary sources (after all internal retries have failed).
 */
export function recordPrimaryFailure(): void {
  const now = Date.now();
  if (now - state.lastFailureTime > DEGRADED_WINDOW_MS) {
    state.consecutiveFailures = 1;
  } else {
    state.consecutiveFailures += 1;
  }
  state.lastFailureTime = now;

  if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
    if (state.status !== "OUTAGE") {
      console.warn(`[Anime Circuit Breaker] Primary sources confirmed in OUTAGE (${state.consecutiveFailures} consecutive failures). Activating emergency fallback.`);
    }
    state.status = "OUTAGE";
  } else {
    state.status = "DEGRADED";
  }
}

/**
 * Check if primary source should be queried.
 * Always returns true unless circuit breaker is in confirmed OUTAGE state and cooldown probe has not elapsed.
 */
export function shouldAttemptPrimary(): boolean {
  if (state.status !== "OUTAGE") return true;

  // During outage, allow probing primary once every PROBE_INTERVAL_MS
  const now = Date.now();
  if (now - state.lastProbeTime > PROBE_INTERVAL_MS) {
    state.lastProbeTime = now;
    return true; // Probe attempt
  }

  return false;
}

/**
 * Check whether primary sources are currently deemed available.
 */
export function isPrimaryAvailable(): boolean {
  return state.status !== "OUTAGE";
}

/**
 * Get current health metrics for debugging/admin stats.
 */
export function getPrimaryHealthMetrics(): Readonly<CircuitBreakerState> {
  return { ...state };
}

/**
 * Explicitly probe AniList health.
 */
export async function probeAniListHealth(): Promise<boolean> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "CineStream/1.0",
      },
      body: JSON.stringify({
        query: "query { Media(id: 21, type: ANIME) { id } }",
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      recordPrimarySuccess();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

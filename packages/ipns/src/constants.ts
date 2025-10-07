const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export const DEFAULT_LIFETIME_MS = 48 * HOUR

/**
 * The default DHT record expiry
 */
export const DHT_EXPIRY_MS = 48 * HOUR

/**
 * How often to run the republish loop
 */
export const DEFAULT_REPUBLISH_INTERVAL_MS = HOUR

/**
 * Republish IPNS records when the expiry of our provider records is within this
 * threshold
 */
export const REPUBLISH_THRESHOLD = 24 * HOUR

export const DEFAULT_TTL_NS = BigInt(MINUTE) * 5_000_000n // 5 minutes

export const DEFAULT_REPUBLISH_CONCURRENCY = 5

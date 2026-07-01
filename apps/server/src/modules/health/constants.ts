export const HEALTH_REDIS_CLIENT = Symbol("health:redis-client");

/** Upper bound for a single dependency probe; keeps /health safe to poll. */
export const HEALTH_CHECK_TIMEOUT_MS = 3000;

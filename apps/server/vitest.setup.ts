// Provide fallback env vars so specs that transitively import `@spark/env`
// (e.g. via crypto.service) pass validation in CI, where no .env exists.
// Only fills values that are unset, so a local .env still takes precedence.
const testEnv: Record<string, string> = {
  NODE_ENV: "test",
  BULL_BOARD_USERNAME: "test",
  BULL_BOARD_PASSWORD: "test",
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  ENCRYPTION_KEY: "0".repeat(64),
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  TRUELAYER_ENV: "sandbox",
  TRUELAYER_CLIENT_ID: "test",
  TRUELAYER_CLIENT_SECRET: "test",
  TRUELAYER_REDIRECT_URI: "http://localhost:3000/callback",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
};

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] ??= value;
}

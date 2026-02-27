import { db } from "@spark/db/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@spark/env/server";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { socialProviders, getSocialProviders } from "./providers/config.ts";

const isProduction = env.NODE_ENV === "production";

export const auth = betterAuth({
  plugins: [tanstackStartCookies()],
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: [env.CORS_ORIGIN],
  socialProviders: getSocialProviders(socialProviders),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  advanced: {
    cookiePrefix: "spark",
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      httpOnly: true,
    },
  },
});

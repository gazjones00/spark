import { env } from "@spark/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema/index.ts";

export const db = drizzle(env.DATABASE_URL, { schema });

export type Database = typeof db;

export { eq, and, or, sql, desc, asc } from "drizzle-orm";

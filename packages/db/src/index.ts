import type { db } from "./client.ts";

export type Database = typeof db;

export { eq, and, or, sql, desc, asc, gt, lt, gte, lte, inArray } from "drizzle-orm";

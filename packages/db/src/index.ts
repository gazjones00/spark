import type { db } from "./client.ts";

export type Database = typeof db;

/**
 * A database handle or the transaction handle `db.transaction` passes to its
 * callback — for methods designed to run inside the caller's unit of work.
 */
export type DatabaseExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export {
  eq,
  and,
  or,
  sql,
  desc,
  asc,
  gt,
  lt,
  gte,
  lte,
  inArray,
  isNull,
  isNotNull,
} from "drizzle-orm";

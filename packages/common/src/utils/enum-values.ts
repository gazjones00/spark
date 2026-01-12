/**
 * Converts a const object's values to a tuple type suitable for Zod enums or Drizzle enums.
 *
 * @example
 * const Status = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
 * const statusValues = enumValues(Status); // ["ACTIVE", "INACTIVE"] as tuple
 * const StatusSchema = z.enum(statusValues);
 */
export const enumValues = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [T[keyof T], ...T[keyof T][]];

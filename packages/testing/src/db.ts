import { vi } from "vitest";

export function createMockDb() {
  return {
    query: {
      notificationPreferences: { findFirst: vi.fn() },
      userPreferences: { findFirst: vi.fn() },
    },
    update: vi.fn(),
    insert: vi.fn(),
  };
}

export type MockDb = ReturnType<typeof createMockDb>;

export function chainMock(returning: unknown) {
  return {
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([returning]),
  };
}

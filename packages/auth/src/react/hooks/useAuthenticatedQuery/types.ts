import type { useSession } from "@spark/auth/client";

export interface UseAuthenticatedQueryOptions<TData> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
}

export interface UseAuthenticatedQueryResult {
  isAuthenticated: boolean;
  isPending: boolean;
  session: ReturnType<typeof useSession>["data"];
}

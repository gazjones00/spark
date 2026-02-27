import { useSession } from "@spark/auth/client";
import type { UseAuthenticatedQueryResult } from "./types.ts";

/**
 * Hook that provides authentication state for use with React Query.
 * Use this to conditionally enable queries based on authentication status.
 *
 * @example
 * ```tsx
 * const { isAuthenticated, isPending } = useAuthenticatedQuery();
 *
 * const query = useQuery({
 *   queryKey: ['user-data'],
 *   queryFn: fetchUserData,
 *   enabled: isAuthenticated && !isPending,
 * });
 * ```
 */
export function useAuthenticatedQuery(): UseAuthenticatedQueryResult {
  const { data: session, isPending } = useSession();

  return {
    isAuthenticated: !!session?.user,
    isPending,
    session,
  };
}

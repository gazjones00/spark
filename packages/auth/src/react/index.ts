// Components
export { AuthProvider } from "./components/index.ts";

// Hooks
export { useAuth, useAuthenticatedQuery } from "./hooks/index.ts";
export type {
  UseAuthReturn,
  UseAuthenticatedQueryOptions,
  UseAuthenticatedQueryResult,
} from "./hooks/index.ts";

// Re-export client utilities
export {
  authClient,
  useSession,
  signIn,
  signUp,
  signOut,
  getSession,
  updateUser,
} from "../client.ts";

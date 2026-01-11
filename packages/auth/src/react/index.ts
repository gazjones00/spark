// Components
export { AuthProvider } from "./components";

// Hooks
export { useAuth, useAuthenticatedQuery } from "./hooks";
export type {
  UseAuthReturn,
  UseAuthenticatedQueryOptions,
  UseAuthenticatedQueryResult,
} from "./hooks";

// Re-export client utilities
export { authClient, useSession, signIn, signUp, signOut, getSession, updateUser } from "../client";

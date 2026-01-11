import type { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component that wraps the application.
 * Better-auth manages its own state internally via the useSession hook,
 * so this provider is mainly for future extensibility and consistency.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <>{children}</>;
}

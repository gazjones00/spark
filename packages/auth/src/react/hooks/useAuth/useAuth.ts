import { useCallback } from "react";
import { useSession, signIn, signUp, signOut } from "@spark/auth/client";

import type { UseAuthReturn } from "./types";

export function useAuth(): UseAuthReturn {
  const { data: session, isPending, error, refetch } = useSession();

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn.email({
      email,
      password,
    });

    if (result.error) {
      return { error: { message: result.error.message ?? "Login failed" } };
    }

    return {};
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const result = await signUp.email({
      name,
      email,
      password,
    });

    if (result.error) {
      return { error: { message: result.error.message ?? "Signup failed" } };
    }

    return {};
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  return {
    user: session?.user ?? null,
    session,
    isAuthenticated: !!session?.user,
    isPending,
    error,
    login,
    signup,
    logout,
    refetch,
  };
}

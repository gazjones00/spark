import { useSession } from "@spark/auth/client";

export interface UseAuthReturn {
  user: typeof useSession extends () => { data: infer T }
    ? T extends { user: infer U }
      ? U
      : null
    : null;
  session: ReturnType<typeof useSession>["data"];
  isAuthenticated: boolean;
  isPending: boolean;
  error: ReturnType<typeof useSession>["error"];
  login: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error?: { message: string } }>;
  logout: () => Promise<void>;
  refetch: ReturnType<typeof useSession>["refetch"];
}

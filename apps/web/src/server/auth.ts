import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getSession } from "@spark/auth/client";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();

  const session = await getSession({
    fetchOptions: {
      headers,
      credentials: "include",
    },
  });

  return session?.data?.user ?? null;
});

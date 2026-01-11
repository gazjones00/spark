import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSession } from "@spark/auth/client";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await getSession({
    fetchOptions: {
      headers: request.headers,
    },
  });

  return session?.data?.user ?? null;
});

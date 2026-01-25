import { useMutation } from "@tanstack/react-query";
import { orpc } from "@spark/orpc";

export function useReauthAccount() {
  return useMutation({
    mutationFn: (providerId?: string) => orpc.truelayer.generateAuthLink.call({ providerId }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

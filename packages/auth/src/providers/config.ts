import type { SocialProviderConfig } from "./types.ts";
import { socialProviders as serverSocialProviders } from "./server.ts";
import { GoogleIcon } from "./icons";

export const socialProviders = {
  ...serverSocialProviders,
  google: {
    ...serverSocialProviders.google,
    icon: GoogleIcon,
  },
} satisfies SocialProviderConfig;

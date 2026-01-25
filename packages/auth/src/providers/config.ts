import type { SocialProviderConfig } from "./types";
import { GoogleIcon } from "./icons";
import type { SocialProviders } from "better-auth/social-providers";

export const socialProviders = {
  google: {
    name: "Google",
    icon: GoogleIcon,
    // Uncomment when OAuth credentials are available:
    config: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  // apple: {
  //   name: "Apple",
  //   icon: AppleIcon,
  //   config: {
  //     clientId: process.env.APPLE_CLIENT_ID!,
  //     clientSecret: process.env.APPLE_CLIENT_SECRET!,
  //   },
  // },
} satisfies SocialProviderConfig;

export const getSocialProviders = (socialProviders: SocialProviderConfig): SocialProviders => {
  return Object.fromEntries(
    Object.entries(socialProviders).map(([id, provider]) => [id, provider.config]),
  );
};

import { authClient } from "@spark/auth/client";
import { socialProviders, type ProviderId } from "@spark/auth/providers";

import { Button } from "@/components/ui/button";

interface SocialLoginButtonsProps {
  disabled?: boolean;
  callbackURL?: string;
}

export function SocialLoginButtons({
  disabled,
  callbackURL = "/dashboard",
}: SocialLoginButtonsProps) {
  const handleSocialLogin = async (providerId: ProviderId) => {
    await authClient.signIn.social({
      provider: providerId,
      callbackURL: `${window.location.origin}${callbackURL}`,
    });
  };

  return (
    <div className="grid gap-2">
      {Object.entries(socialProviders).map(([id, provider]) => {
        const Icon = provider.icon;
        return (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => handleSocialLogin(id as ProviderId)}
          >
            {Icon ? <Icon className="size-4" /> : null}
            Continue with {provider.name}
          </Button>
        );
      })}
    </div>
  );
}

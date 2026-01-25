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
    const fullCallbackURL = `${window.location.origin}${callbackURL}`;

    await authClient.signIn.social({
      provider: providerId,
      callbackURL: fullCallbackURL,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(socialProviders).map(([id, provider]) => {
        const Icon = provider.icon;
        return (
          <Button
            key={id}
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => handleSocialLogin(id as ProviderId)}
          >
            {Icon && <Icon className="mr-2 size-4" />}
            {provider.name}
          </Button>
        );
      })}
    </div>
  );
}

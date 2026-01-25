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
  const providerEntries = Object.entries(socialProviders);
  const isOddCount = providerEntries.length % 2 === 1;

  const handleSocialLogin = async (providerId: ProviderId) => {
    const fullCallbackURL = `${window.location.origin}${callbackURL}`;

    await authClient.signIn.social({
      provider: providerId,
      callbackURL: fullCallbackURL,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {providerEntries.map(([id, provider], index) => {
        const Icon = provider.icon;
        const shouldCenter = isOddCount && index === providerEntries.length - 1;
        return (
          <Button
            key={id}
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => handleSocialLogin(id as ProviderId)}
            className={shouldCenter ? "col-span-2" : undefined}
          >
            {Icon && <Icon className="mr-2 size-4" />}
            {provider.name}
          </Button>
        );
      })}
    </div>
  );
}

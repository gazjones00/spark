import type { ComponentType, SVGProps } from "react";
import type { SocialProviderList, SocialProviders } from "better-auth/social-providers";

/**
 * Icon component type - can be a Lucide icon or custom SVG component.
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

/**
 * Re-export better-auth types for convenience.
 */
export type { SocialProviderList, SocialProviders };

/**
 * Provider ID - any provider supported by better-auth.
 */
export type ProviderId = SocialProviderList[number];

/**
 * Configuration for a single social provider with UI metadata.
 */
export interface ProviderUIConfig<T extends ProviderId = ProviderId> {
  /** Display name shown in the UI */
  name: string;
  /** Icon component to display in the button */
  icon?: IconComponent;
  /** OAuth configuration for the provider (server-side) - uses better-auth types */
  config: SocialProviders[T];
}

/**
 * Map of social provider configurations.
 * Keys are provider IDs, values include UI config and optional OAuth config.
 */
export type SocialProviderConfig = {
  [K in ProviderId]?: ProviderUIConfig<K>;
};

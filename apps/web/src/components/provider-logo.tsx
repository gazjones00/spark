import { useState, type ReactNode } from "react";

interface ProviderLogoProps {
  logoUri?: string | null;
  alt?: string;
  className?: string;
  /** Rendered when there is no logo URL, or the logo fails to load. */
  fallback: ReactNode;
}

/**
 * Renders a bank/card provider logo, degrading to `fallback` when the URL is
 * missing or fails to load. TrueLayer occasionally returns logo URLs that 404
 * (e.g. some card providers), so a present `logoUri` is not a guarantee the
 * image will render — the `onError` fallback keeps a broken image out of the UI.
 */
export function ProviderLogo({ logoUri, alt, className, fallback }: ProviderLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!logoUri || failed) {
    return <>{fallback}</>;
  }

  return <img src={logoUri} alt={alt} className={className} onError={() => setFailed(true)} />;
}

import * as React from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. The session is
 * only known in the browser, so text derived from it (names, initials) waits
 * for this to keep server and client markup identical.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Standalone test config — deliberately does NOT load the TanStack Start plugin
// from vite.config.ts (it injects SSR/router behaviour that breaks unit tests).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});

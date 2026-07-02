// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro (build-only), componentTagger (dev-only),
// VITE_* env injection, @ path alias, React/TanStack dedupe, error logger
// plugins, and sandbox detection. Do NOT add those manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Target: Netlify. Nitro emits a Netlify Function for SSR and static assets
// to `dist/`. The included `netlify.toml` wires the publish dir + function.
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  nitro: {
    preset: "netlify",
  },
});

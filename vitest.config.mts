import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Resolve the "@/…" alias declared in tsconfig.json
  resolve: { tsconfigPaths: true },
  test: {
    // Pure logic runs in Node; component tests opt into jsdom with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});

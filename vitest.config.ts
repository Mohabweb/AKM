import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key-test-service-key",
    },
    include: ["tests/unit/**/*.test.ts", "tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["controllers/**/*.js", "middleware/**/*.js", "utils/**/*.js"],
      exclude: ["controllers/seed-demo-data.js"],
    },
  },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/extension",
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  webServer: {
    command:
      "npx vite preview --outDir dist-extension --host 127.0.0.1 --port 4180 --strictPort",
    url: "http://127.0.0.1:4180",
  },
});

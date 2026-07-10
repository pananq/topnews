import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/topnews/",
  server: {
    host: "127.0.0.1",
  },
  test: {
    environment: "jsdom",
    globals: false,
    api: false,
  },
});

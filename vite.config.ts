import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  base: "/jhaymartstoolsmonitoringsystem/",

  tanstackStart: {
    server: { entry: "server" },
  },
});

import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [
    react({
      babel: {
        plugins: ["./scripts/babel-plugin-jsx-source-location.cjs"],
      },
    }),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  base: command === "build" ? "./" : "/",
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  build: { outDir: "../public/amazon-ads-analyzer", emptyOutDir: true },
}));

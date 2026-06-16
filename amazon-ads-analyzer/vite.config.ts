import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const enableSourceLocation = command === "serve";

  return {
    plugins: [
      react({
        babel: {
          plugins: enableSourceLocation ? ["./scripts/babel-plugin-jsx-source-location.cjs"] : [],
        },
      }),
      tailwindcss(),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    base: command === "build" ? "./" : "/",
    server: { host: "0.0.0.0", port: 5173, strictPort: true },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("recharts")) return "vendor-recharts";
            if (id.includes("xlsx")) return "vendor-xlsx";
            if (id.includes("mermaid")) return "vendor-mermaid";
          },
        },
      },
    },
  };
});

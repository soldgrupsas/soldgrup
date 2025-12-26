import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  // En desarrollo usar "/", en producción usar "/soldgrup/" para GitHub Pages
  base: mode === "production" ? "/soldgrup/" : "/",
  build: {
    outDir: "docs", //  GitHub Pages
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

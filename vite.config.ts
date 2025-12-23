import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/soldgrup/", // NOMBRE EXACTO DEL REPO
  build: {
    outDir: "docs", //  GitHub Pages
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

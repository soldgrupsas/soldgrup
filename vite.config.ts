import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Determinar el base según el entorno
  // Coolify siempre usa "/" como base path
  // GitHub Pages usa "/soldgrup/"
  // Desarrollo usa "/"
  const isCoolify = !!process.env.COOLIFY_URL || !!process.env.COOLIFY_FQDN;
  const base = process.env.VITE_APP_BASE || (isCoolify ? "/" : (mode === "production" ? "/soldgrup/" : "/"));
  
  console.log(`Building with base: ${base}, mode: ${mode}, COOLIFY_URL: ${process.env.COOLIFY_URL}, COOLIFY_FQDN: ${process.env.COOLIFY_FQDN}`);
  
  return {
  base: base,
  build: {
    outDir: "docs", //  GitHub Pages
    rollupOptions: {
      // Excluir archivos de backup del build
      external: (id) => {
        // Excluir archivos de backup que pueden tener problemas de codificación
        if (id.includes("TimeControl_backup") || id.includes("_backup_")) {
          return true;
        }
        return false;
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Excluir archivos de backup del sistema de archivos del servidor
  server: {
    fs: {
      deny: ["**/TimeControl_backup*.tsx", "**/*_backup_*.tsx", "**/*_backup_*.ts"],
    },
  },
  };
});

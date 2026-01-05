import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Determinar el base según el entorno
  // Si VITE_APP_BASE está definido, usarlo (para Coolify o dominio personalizado)
  // Si no, usar "/" para dominio personalizado (app.soldgrup.com)
  // Desarrollo siempre usa "/"
  const base = process.env.VITE_APP_BASE || "/";
  
  console.log(`Building with base: ${base}, mode: ${mode}, VITE_APP_BASE: ${process.env.VITE_APP_BASE}`);
  
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

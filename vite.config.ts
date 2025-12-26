import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Determinar el base según el entorno
  // Si hay una variable de entorno COOLIFY, usar "/" (Coolify)
  // Si no, usar "/soldgrup/" para GitHub Pages
  const isCoolify = process.env.COOLIFY_URL || process.env.COOLIFY_FQDN;
  const base = isCoolify ? "/" : (mode === "production" ? "/soldgrup/" : "/");
  
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

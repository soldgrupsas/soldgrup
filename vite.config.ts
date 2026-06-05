import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Base para assets y rutas. Por defecto "/" para que funcione en Coolify (app en raíz).
  // Para GitHub Pages en /soldgrup/ definir VITE_APP_BASE=/soldgrup/
  const base = process.env.VITE_APP_BASE ?? (mode === "production" ? "/" : "/");
  
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
      output: {
        // Separar dependencias pesadas en chunks propios para que el navegador
        // los descargue en paralelo, los cachee entre versiones y no se carguen
        // si la pantalla no los necesita (clave en dispositivos de gama baja).
        manualChunks: {
          "vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts": ["recharts"],
        },
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
  // Configuración del servidor de preview para Coolify
  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: [
      "app.soldgrup.com",
      "localhost",
      ".soldgrup.com", // Permite cualquier subdominio de soldgrup.com
    ],
  },
  };
});

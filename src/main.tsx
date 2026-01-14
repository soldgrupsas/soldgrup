import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Manejo global de errores no capturados
window.addEventListener("error", (event) => {
  console.error("Error global no capturado:", event.error);
  // Mostrar un mensaje en la consola para debugging
  if (event.error) {
    console.error("Stack trace:", event.error.stack);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Promise rechazada no manejada:", event.reason);
});

// Asegurar que la app solo se monte una vez
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found");
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
      <div style="text-align: center; padding: 2rem;">
        <h1 style="color: #dc2626; margin-bottom: 1rem;">Error de inicialización</h1>
        <p>No se pudo encontrar el elemento raíz de la aplicación.</p>
        <p style="margin-top: 1rem; color: #6b7280;">Por favor, recarga la página.</p>
      </div>
    </div>
  `;
  throw new Error("Root element not found");
}

try {
  // Crear la raíz solo una vez - React 18 maneja esto internamente, pero lo hacemos explícito
  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error("Error al renderizar la aplicación:", error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
      <div style="text-align: center; padding: 2rem; max-width: 600px;">
        <h1 style="color: #dc2626; margin-bottom: 1rem;">Error al cargar la aplicación</h1>
        <p style="margin-bottom: 1rem;">Ocurrió un error al intentar cargar la aplicación.</p>
        <p style="margin-bottom: 1rem; color: #6b7280;">${error instanceof Error ? error.message : "Error desconocido"}</p>
        <button 
          onclick="window.location.reload()" 
          style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;"
        >
          Recargar Página
        </button>
        ${process.env.NODE_ENV === "development" ? `
          <details style="margin-top: 2rem; text-align: left;">
            <summary style="cursor: pointer; font-weight: bold; margin-bottom: 0.5rem;">Detalles del error (solo en desarrollo)</summary>
            <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.375rem; overflow: auto; font-size: 0.875rem;">${error instanceof Error ? error.stack : String(error)}</pre>
          </details>
        ` : ""}
      </div>
    </div>
  `;
}

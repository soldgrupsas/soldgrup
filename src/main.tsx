import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Asegurar que la app solo se monte una vez
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Crear la raíz solo una vez - React 18 maneja esto internamente, pero lo hacemos explícito
const root = createRoot(rootElement);
root.render(<App />);

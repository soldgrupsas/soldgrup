import { lazy, type ComponentType } from "react";

// Mensajes típicos de fallo al descargar un chunk (módulo cargado de forma diferida).
// Ocurren en redes móviles inestables o cuando, tras un despliegue nuevo, el navegador
// tiene en caché un index.html viejo que apunta a chunks que ya no existen.
const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return (
    name === "ChunkLoadError" ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /dynamically imported module/i.test(message)
  );
};

const RELOAD_FLAG_PREFIX = "chunk_reload_";

/**
 * Igual que React.lazy, pero:
 *  - Reintenta la descarga del chunk ante fallos transitorios de red.
 *  - Si el chunk no existe (despliegue nuevo con index.html viejo en caché),
 *    fuerza una recarga completa de la página UNA sola vez para obtener el HTML/manifest nuevo.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string,
  retries = 2,
  delayMs = 600,
) {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const module = await factory();
        // Carga exitosa: limpiar la bandera de recarga para este chunk.
        try {
          sessionStorage.removeItem(`${RELOAD_FLAG_PREFIX}${chunkName}`);
        } catch {
          /* sessionStorage puede no estar disponible; no es crítico */
        }
        return module;
      } catch (error) {
        lastError = error;

        if (isChunkLoadError(error)) {
          const flagKey = `${RELOAD_FLAG_PREFIX}${chunkName}`;
          let alreadyReloaded = false;
          try {
            alreadyReloaded = sessionStorage.getItem(flagKey) === "1";
          } catch {
            /* ignore */
          }

          if (!alreadyReloaded) {
            try {
              sessionStorage.setItem(flagKey, "1");
            } catch {
              /* ignore */
            }
            // Recargar para traer el index.html y el manifest de assets actualizados.
            window.location.reload();
            // Devolver una promesa que nunca resuelve: la página se está recargando.
            return new Promise<{ default: T }>(() => {});
          }
        }

        // Esperar antes de reintentar (backoff lineal).
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }

    throw lastError;
  });
}

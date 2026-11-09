import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./client";

const memoryAuthStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * Cliente sin sesión para la pantalla de marcación.
 * No lee ni renueva tokens: un token vencido no puede dejar la interfaz esperando.
 */
export const kioskSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: memoryAuthStorage,
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

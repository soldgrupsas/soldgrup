/**
 * Crea el usuario Contabilidad (solo módulo time-control / horas extras).
 *
 * Requiere en .env (raíz del proyecto):
 *   VITE_SUPABASE_URL o SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (clave "service_role" del panel, NO la anon)
 *
 * Uso: npm run create-user:contabilidad
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Carga .env desde la raíz del repo (Node no lee .env solo) */
function loadEnvFromRoot() {
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFromRoot();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Faltan variables en .env (raíz del proyecto):");
  console.error("   - VITE_SUPABASE_URL o SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY  (Project Settings → API → service_role)");
  console.error("");
  console.error("   Añade SUPABASE_SERVICE_ROLE_KEY a tu .env; la clave anon no sirve para este script.");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Mismo email que en login (Supabase normaliza a minúsculas) */
const CONTABILIDAD_EMAIL = "contabilidad@soldgrup.com";
const CONTABILIDAD_PASSWORD = process.env.CONTABILIDAD_PASSWORD || "CS2026";
const CONTABILIDAD_FULL_NAME = "Contabilidad";
const CONTABILIDAD_ROLE = "contabilidad" as const;

async function findUserByEmail(email: string) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return undefined;
    page += 1;
  }
}

async function main() {
  console.log("Creando o actualizando usuario Contabilidad...");
  const existing = await findUserByEmail(CONTABILIDAD_EMAIL);

  if (existing) {
    console.log("Usuario ya existe:", existing.id, "- actualizando contraseña y confirmación de email...");
    const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: CONTABILIDAD_PASSWORD,
      email_confirm: true,
    });
    if (updError) throw updError;
    const { error: rpcError } = await supabaseAdmin.rpc("assign_user_role", {
      _user_id: existing.id,
      _role: CONTABILIDAD_ROLE,
    });
    if (rpcError) throw rpcError;
    console.log("Contraseña actualizada y rol contabilidad asignado.");
    return;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: CONTABILIDAD_EMAIL,
    password: CONTABILIDAD_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: CONTABILIDAD_FULL_NAME },
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sin usuario en respuesta");

  const userId = authData.user.id;
  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email: CONTABILIDAD_EMAIL,
    full_name: CONTABILIDAD_FULL_NAME,
  });

  await new Promise((r) => setTimeout(r, 500));

  const { error: assignError } = await supabaseAdmin.rpc("assign_user_role", {
    _user_id: userId,
    _role: CONTABILIDAD_ROLE,
  });
  if (assignError) throw assignError;

  console.log("Listo. Email:", CONTABILIDAD_EMAIL, "| Rol:", CONTABILIDAD_ROLE);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

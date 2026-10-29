import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// NEXT_PUBLIC_ variables are copied into the browser code at build time: only
// public values belong here. The anon / publishable key can only do what RLS
// allows (read stations). Never put the service_role key in a NEXT_PUBLIC_ variable.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing: copy .env.example to .env.local",
  );
}

/**
 * Typed with the generated schema: a wrong table or column name is a compile error.
 * Accounts (PLAN.md task 10): the session is kept in the browser's localStorage
 * so the user stays signed in. Reading stations needs no session.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in is by code, not by link: there is never a session in the URL.
    detectSessionInUrl: false,
  },
});

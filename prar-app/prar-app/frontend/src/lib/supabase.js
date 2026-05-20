// Supabase client for PRAR App.
//
// All PRAR App tables live in the `prar` schema of the shared MESPI Supabase
// project (which also hosts PRAR Bouquets in the `public` schema). Setting
// db.schema = "prar" makes every `.from("…")` call target that schema by
// default, so consumers in db.js can write `.from("installments")` instead
// of `.from("prar.installments")`.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://guucfdsygguxjvdozyqr.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dWNmZHN5Z2d1eGp2ZG96eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYzNzcsImV4cCI6MjA5MzY1MjM3N30.dLYyj-qRmCOn5l5g_Zr-2umWYHC2Na1LSqBFfo2EEIw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: "prar" },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Auth state hook + sign-in/sign-out helpers for PRAR App.
//
// useAuth() returns { session, user, loading } and keeps in sync with
// Supabase's auth events. The app shell uses this to gate the rest of
// the UI behind a sign-in screen.

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Pull the current session on mount (handles already-signed-in users
    // and users who just clicked a magic link — Supabase processes the
    // URL fragment automatically when detectSessionInUrl is true).
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    // Subscribe to subsequent auth changes (sign-in, sign-out, token
    // refresh). The callback fires synchronously, so React batches the
    // resulting state updates.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

// Send a magic-link email. The user clicks the link, Supabase redirects
// them back to the app with a session token in the URL, and detectSessionInUrl
// (set in supabase.js) handles the rest. The redirect target is the
// current origin — make sure this is in the project's Redirect URLs list.
export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

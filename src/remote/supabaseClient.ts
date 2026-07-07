import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at startup rather than surfacing as a confusing runtime error
  // deep inside a sync/upload call later.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Anonymous Auth (architecture doc v4.1 §4): one device-scoped user, no login UI.
// Safe to call repeatedly — no-ops if a session already exists.
export async function ensureAuthenticated(): Promise<string> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user.id) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(`Anonymous sign-in failed: ${error?.message ?? 'unknown error'}`);
  }
  return data.user.id;
}

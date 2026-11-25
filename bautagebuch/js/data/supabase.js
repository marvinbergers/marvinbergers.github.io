// Supabase-Zugang. Die Sitzung wird dauerhaft gespeichert und automatisch erneuert:
// einmal anmelden pro Gerät, danach nie wieder.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let client = null;

export async function getClient() {
  if (client) return client;
  const { createClient } = await import('../vendor/supabase.js');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bautagebuch-auth', detectSessionInUrl: false },
  });
  return client;
}

export async function requestCode(c, email) {
  // Kein Link (iPhone öffnet sonst Safari statt der App), kein neues Konto.
  const { error } = await c.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function verifyCode(c, email, code) {
  const { error } = await c.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw error;
}

export function onAuthChange(c, cb) {
  c.auth.getSession().then(({ data }) => cb(data.session ? 'SIGNED_IN' : 'SIGNED_OUT', data.session));
  c.auth.onAuthStateChange((event, session) => cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
}

// Supabase-Zugang. Die Sitzung wird dauerhaft gespeichert und automatisch erneuert:
// einmal anmelden pro Gerät, danach nie wieder.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let client = null;

export async function getClient() {
  if (client) return client;
  const { createClient } = await import('../vendor/supabase.js');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: STORAGE_KEY, detectSessionInUrl: false },
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

const STORAGE_KEY = 'bautagebuch-auth';

/** Gespeicherte Sitzung direkt aus dem Gerät (für den Start ohne Netz). */
export function storedSession() {
  try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); return s?.user ? s : null; } catch { return null; }
}

export function onAuthChange(c, cb) {
  c.auth.getSession().then(({ data }) => {
    if (data?.session) return cb('SIGNED_IN', data.session);
    // Ohne Netz kann ein abgelaufenes Token nicht erneuert werden; die gespeicherte Sitzung bleibt aber gültig
    // und wird erneuert, sobald wieder Netz da ist.
    const s = storedSession();
    cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s);
  }, () => { const s = storedSession(); cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s); });
  c.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') cb('SIGNED_OUT', null);
    else if (session) cb('SIGNED_IN', session);
  });
}

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

/** Startet Postgres im Prozess, bildet die nötigen Supabase-Teile nach und spielt alle Migrationen ein. */
export async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
  `);
  for (const f of readdirSync('supabase/migrations').sort()) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  }
  return db;
}

export const FAMILIE = { sub: '11111111-1111-1111-1111-111111111111', email: 'eins@example.org', role: 'authenticated' };
export const FREMD = { sub: '99999999-9999-9999-9999-999999999999', email: 'fremd@example.org', role: 'authenticated' };

/** Führt fn als bestimmter Nutzer in einer Transaktion aus. */
export async function als(db, claims, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? {})]);
    await tx.exec(`set local role ${claims ? 'authenticated' : 'anon'}`);
    return fn(tx);
  });
}

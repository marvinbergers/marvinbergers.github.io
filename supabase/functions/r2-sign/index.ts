// Supabase Edge Function: stellt kurzlebige signierte URLs für den privaten R2-Bucket aus.
// Nur für angemeldete Familienmitglieder (Prüfung über ist_familie() mit dem Token des Nutzers).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { validateRequest, GUELTIG_SEKUNDEN } from './logic.ts';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://marvinbergers.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3', region: 'auto',
});
// R2_ENDPOINT = S3-Endpunkt aus Cloudflare (bei EU-Buckets mit „.eu.“), sonst aus der Konto-ID gebildet.
const ENDPOINT = (Deno.env.get('R2_ENDPOINT') ?? `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`).replace(/\/+$/, '');
const BUCKET_URL = `${ENDPOINT}/${Deno.env.get('R2_BUCKET')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { fehler: 'nur POST' });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!token) return json(401, { fehler: 'nicht angemeldet' });
  // Neuer Publishable Key (als Secret APP_PUBLISHABLE_KEY hinterlegt); alter anon-Key nur als Rückfall.
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('APP_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u?.user) return json(401, { fehler: 'nicht angemeldet' });
  const { data: familie } = await sb.rpc('ist_familie');
  if (familie !== true) return json(403, { fehler: 'nicht freigeschaltet' });

  const v = validateRequest(await req.json().catch(() => null));
  if (!v.ok) return json(v.status, { fehler: v.fehler });

  const urls = await Promise.all(v.ops.map(async (op) => {
    const url = new URL(`${BUCKET_URL}/${op.key.split('/').map(encodeURIComponent).join('/')}`);
    url.searchParams.set('X-Amz-Expires', String(GUELTIG_SEKUNDEN));
    const headers: Record<string, string> = op.method === 'PUT' && op.contentType ? { 'Content-Type': op.contentType } : {};
    const signed = await r2.sign(new Request(url, { method: op.method, headers }), { aws: { signQuery: true } });
    return signed.url;
  }));
  return json(200, { urls });
});

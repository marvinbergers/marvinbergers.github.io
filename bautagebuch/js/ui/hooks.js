import { useState, useEffect, useCallback } from '../vendor/preact.js';

/** Lädt Daten asynchron; reload() lädt neu. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(async () => {
    try { setState({ data: await fn(), error: null, loading: false }); } catch (error) { setState({ data: null, error, loading: false }); }
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

/** Anzeige-URLs für Speicherschlüssel, gesammelt geladen. */
export function useUrls(api, keys) {
  const [urls, setUrls] = useState({});
  const sig = keys.filter(Boolean).join('|');
  useEffect(() => {
    let aktiv = true;
    Promise.all(keys.filter(Boolean).map(async (k) => [k, await api.url(k)])).then((paare) => {
      if (aktiv) setUrls((alt) => ({ ...alt, ...Object.fromEntries(paare) }));
    });
    return () => { aktiv = false; };
  }, [sig]);
  return urls;
}

export const sortiert = (rows) => [...(rows ?? [])].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0) || `${a.name}`.localeCompare(`${b.name}`));

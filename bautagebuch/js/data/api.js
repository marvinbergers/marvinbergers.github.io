// Gemeinsame Schnittstelle der Datenschicht. Zwei Umsetzungen:
//  - remote.js: Supabase + R2 (echter Betrieb)
//  - memory.js: alles im Speicher (Vorschau ohne Backend und UI-Tests)
// Komponenten holen sich die API über useApi().
import { createContext } from '../vendor/preact.js';
import { useContext } from '../vendor/preact.js';

export const ApiContext = createContext(null);
export const useApi = () => useContext(ApiContext);

/**
 * @typedef {object} Api
 * @property {(table: string, filter?: object) => Promise<object[]>} list    nur nicht gelöschte Zeilen
 * @property {(table: string) => Promise<object[]>} listDeleted               gelöschte der letzten 90 Tage
 * @property {(table: string, row: object) => Promise<object>} insert
 * @property {(table: string, id: string, patch: object) => Promise<object>} update
 * @property {(table: string, id: string) => Promise<void>} softDelete
 * @property {(table: string, id: string) => Promise<void>} restore
 * @property {(id: string) => Promise<object[]>} history                      neueste zuerst
 * @property {(key: string) => Promise<string>} url                           Anzeige-URL für Bild/Plan
 * @property {(key: string, blob: Blob, type: string) => Promise<void>} put   direkter Upload (Pläne, Dokumente)
 * @property {object} queue
 * @property {() => Promise<void>} syncNow
 * @property {{ id: string, email: string }} me
 */

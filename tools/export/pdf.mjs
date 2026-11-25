// Tagebuch als PDF: Tag für Tag mit Wetter, Anwesenheit, Texten und Vorschaubildern.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4 = [595.28, 841.89];
const RAND = 48;
// Standardschrift kann nur WinAnsi: Zeichen außerhalb werden ersetzt (z. B. Emojis).
const winAnsi = (s) => `${s ?? ''}`.replace(/[^\u0020-\u007E\u00A0-\u00FF–—‚„“”‘’…€•\n]/g, '');

export async function tagebuchPdf({ tage, abschnitte, anwesenheit, personen, firmen, fotosNachTag, ladeVorschau, stellenName }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Bautagebuch');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page; let y;
  const neueSeite = () => { page = pdf.addPage(A4); y = A4[1] - RAND; };
  const platz = (h) => { if (y - h < RAND) neueSeite(); };
  const zeile = (text, { f = font, size = 10, farbe = rgb(0, 0, 0), einzug = 0 } = {}) => {
    const breite = A4[0] - 2 * RAND - einzug;
    for (const absatz of winAnsi(text).split('\n')) {
      let akt = '';
      for (const wort of absatz.split(' ')) {
        const probe = akt ? `${akt} ${wort}` : wort;
        if (f.widthOfTextAtSize(probe, size) > breite && akt) { platz(size + 4); page.drawText(akt, { x: RAND + einzug, y, size, font: f, color: farbe }); y -= size + 4; akt = wort; } else akt = probe;
      }
      platz(size + 4); page.drawText(akt, { x: RAND + einzug, y, size, font: f, color: farbe }); y -= size + 4;
    }
  };
  const pName = new Map(personen.map((p) => [p.id, p.name])); const fName = new Map(firmen.map((f) => [f.id, f.name]));
  const TYPEN = { arbeiten: 'Arbeiten', lieferungen: 'Lieferungen', probleme: 'Probleme / Entscheidungen' };

  neueSeite();
  zeile('Bautagebuch', { f: fett, size: 22 });
  zeile(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, { size: 9, farbe: rgb(0.4, 0.4, 0.4) });
  y -= 10;

  const daten = [...new Set([...tage.map((t) => t.datum), ...fotosNachTag.keys()])].sort();
  for (const datum of daten) {
    const tag = tage.find((t) => t.datum === datum);
    platz(60); y -= 8;
    zeile(new Date(`${datum}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }), { f: fett, size: 14 });
    if (tag?.wetter?.text) zeile(`Wetter: ${tag.wetter.text}${tag.wetter.tmin != null ? `, ${Math.round(tag.wetter.tmin)}–${Math.round(tag.wetter.tmax)} °C` : ''}`, { size: 9 });
    const anw = anwesenheit.filter((a) => a.tag_id === tag?.id).map((a) => `${pName.get(a.person_id) ?? fName.get(a.firma_id) ?? '?'}${a.stunden ? ` (${a.stunden} h)` : ''}`);
    if (anw.length) zeile(`Anwesend: ${anw.join(', ')}`, { size: 9 });
    for (const [typ, titel] of Object.entries(TYPEN)) {
      const texte = abschnitte.filter((a) => a.tag_id === tag?.id && a.typ === typ);
      if (!texte.length) continue;
      zeile(titel, { f: fett, size: 10 });
      for (const t of texte) zeile(`• ${t.text}`, { einzug: 8 });
    }
    const gruppen = fotosNachTag.get(datum) ?? [];
    for (const g of gruppen) {
      zeile(`Fotos: ${stellenName(g.stelle_id)} (${g.fotos.length})`, { size: 9, farbe: rgb(0.3, 0.3, 0.3) });
      const BILD = 110; let x = RAND;
      platz(BILD + 6);
      for (const f of g.fotos) {
        try {
          const img = await pdf.embedJpg(Uint8Array.from(await ladeVorschau(f))); // Kopie: pdf-lib verträgt keine Node-Buffer mit Offset
          const s = Math.min(BILD / img.width, BILD / img.height);
          if (x + BILD > A4[0] - RAND) { x = RAND; y -= BILD + 6; platz(BILD + 6); }
          page.drawImage(img, { x, y: y - img.height * s, width: img.width * s, height: img.height * s });
          x += BILD + 6;
        } catch { /* Vorschau fehlt – übergehen */ }
      }
      y -= BILD + 10;
    }
  }
  return pdf.save();
}

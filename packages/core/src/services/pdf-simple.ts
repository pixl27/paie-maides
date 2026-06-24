/**
 * Moteur HTML→PDF binaire SANS dépendance externe.
 *
 * Produit un PDF valide (Helvetica, WinAnsi, multi-pages) à partir du HTML
 * « document » : extraction du texte, gestion des sauts de page (`</page><page>`
 * et sections `md-page`), retour à la ligne et pagination automatique.
 *
 * Ce n'est pas un moteur de mise en page CSS (utiliser PuppeteerPdfRenderer pour
 * une fidélité totale) mais un générateur de PDF réel, ouvrable, prêt à l'emploi.
 */

import { PdfRenderer } from './documents.js';

export interface OptionsPdf {
  /** Largeur de page en points (A4 = 595). */
  largeur?: number;
  /** Hauteur de page en points (A4 = 842). */
  hauteur?: number;
  /** Marge en points. */
  marge?: number;
  /** Taille de police en points. */
  taillePolice?: number;
  /** Interligne en points. */
  interligne?: number;
  /** Nombre max de caractères par ligne (retour à la ligne). */
  largeurLigne?: number;
}

const DEFAUTS: Required<OptionsPdf> = {
  largeur: 595, hauteur: 842, marge: 56, taillePolice: 11, interligne: 15, largeurLigne: 92,
};

/* ------------------------------------------------------------------ */
/* Extraction de texte                                                 */
/* ------------------------------------------------------------------ */

const ENTITES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
};

function decodeEntites(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENTITES[e.toLowerCase()] ?? e);
}

/** Découpe le HTML document en pages logiques (sauts de page). */
function decoupePages(html: string): string[] {
  // sections produites par documentImprimable
  const sections = [...html.matchAll(/<section class="md-page">([\s\S]*?)<\/section>/g)].map((m) => m[1]!);
  if (sections.length > 0) return sections;
  // sinon marqueur brut du compilateur de gabarit
  if (html.includes('</page><page>')) return html.split('</page><page>');
  return [html];
}

/** Transforme un fragment HTML en lignes de texte. */
function htmlVersLignes(html: string, largeurLigne: number): string[] {
  let t = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|section|header|footer)>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '');
  t = decodeEntites(t);
  // collapse des espaces (les insecables sont deja convertis par decodeEntites)
  const lignesBrutes = t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim());
  const lignes: string[] = [];
  for (const ligne of lignesBrutes) {
    if (ligne === '') { lignes.push(''); continue; }
    // retour à la ligne par mots
    let courant = '';
    for (const mot of ligne.split(' ')) {
      if (courant === '') { courant = mot; }
      else if ((courant + ' ' + mot).length <= largeurLigne) { courant += ' ' + mot; }
      else { lignes.push(courant); courant = mot; }
    }
    lignes.push(courant);
  }
  return lignes;
}

/* ------------------------------------------------------------------ */
/* Écriture PDF bas niveau                                             */
/* ------------------------------------------------------------------ */

function escapePdf(s: string): string {
  return s.replace(/[\\()]/g, (c) => '\\' + c);
}

/** Encode une chaine en octets Latin-1/WinAnsi (1 octet par caractère). */
function latin1(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out.push(c <= 0xff ? c : 0x3f /* '?' */);
  }
  return out;
}

/** Construit le flux de contenu d'une page à partir de ses lignes. */
function fluxPage(lignes: string[], o: Required<OptionsPdf>): string {
  const y = o.hauteur - o.marge;
  let flux = `BT /F1 ${o.taillePolice} Tf ${o.interligne} TL ${o.marge} ${y} Td\n`;
  for (const ligne of lignes) {
    flux += `(${escapePdf(ligne)}) Tj T*\n`;
  }
  flux += 'ET';
  return flux;
}

/** Génère un PDF binaire à partir du HTML document. */
export function htmlVersPdf(html: string, options: OptionsPdf = {}): Uint8Array {
  const o = { ...DEFAUTS, ...options };
  const lignesParPage = Math.max(1, Math.floor((o.hauteur - 2 * o.marge) / o.interligne));

  // découpe logique puis pagination physique
  const pagesTexte: string[][] = [];
  for (const page of decoupePages(html)) {
    const lignes = htmlVersLignes(page, o.largeurLigne);
    for (let i = 0; i < lignes.length; i += lignesParPage) {
      pagesTexte.push(lignes.slice(i, i + lignesParPage));
    }
    if (lignes.length === 0) pagesTexte.push([]);
  }
  if (pagesTexte.length === 0) pagesTexte.push([]);

  // objets PDF : 1=catalog, 2=pages, 3=font, puis 2 objets par page (page+contenu)
  const nbPages = pagesTexte.length;
  const objets: string[] = [];
  const idFont = 3;
  const premierePage = 4;
  const idsPage: number[] = [];
  for (let i = 0; i < nbPages; i++) idsPage.push(premierePage + i * 2);

  objets[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objets[2] = `<< /Type /Pages /Count ${nbPages} /Kids [${idsPage.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objets[idFont] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  for (let i = 0; i < nbPages; i++) {
    const idPage = premierePage + i * 2;
    const idContenu = idPage + 1;
    const flux = fluxPage(pagesTexte[i]!, o);
    objets[idPage] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${o.largeur} ${o.hauteur}] `
      + `/Resources << /Font << /F1 ${idFont} 0 R >> >> /Contents ${idContenu} 0 R >>`;
    objets[idContenu] = `<< /Length ${latin1(flux).length} >>\nstream\n${flux}\nendstream`;
  }

  // assemblage avec table xref (offsets en octets)
  const octets: number[] = [];
  const push = (s: string) => { for (const b of latin1(s)) octets.push(b); };
  const offsets: number[] = [];
  push('%PDF-1.4\n%âãÏÓ\n');
  const nbObjets = objets.length - 1; // index 0 inutilisé
  for (let i = 1; i <= nbObjets; i++) {
    offsets[i] = octets.length;
    push(`${i} 0 obj\n${objets[i]}\nendobj\n`);
  }
  const xrefOffset = octets.length;
  push(`xref\n0 ${nbObjets + 1}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i <= nbObjets; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${nbObjets + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return Uint8Array.from(octets);
}

/** PdfRenderer sans dépendance (génère un PDF texte réel). */
export class SimplePdfRenderer implements PdfRenderer {
  constructor(private options: OptionsPdf = {}) {}
  rendre(html: string): Promise<Uint8Array> {
    return Promise.resolve(htmlVersPdf(html, this.options));
  }
}

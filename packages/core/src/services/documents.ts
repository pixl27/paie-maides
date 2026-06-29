/**
 * Génération de documents / impression (port de generSortieHTMLPDF).
 *
 * Le rendu en mode « document » (lettres 'let') produit du HTML avec les
 * valeurs substituées. La conversion en PDF est déléguée à un `PdfRenderer`
 * injectable (puppeteer, etc.), pour ne pas imposer de dépendance lourde.
 */

import { Runtime } from '../runtime/runtime.js';
import { renderEcran } from '../rendering/render.js';

/** Convertisseur HTML -> PDF (à implémenter avec la lib de votre choix). */
export interface PdfRenderer {
  rendre(html: string): Promise<Uint8Array>;
}

/** Format de document détecté (port de DOC_FORMAT_*). */
export type FormatDoc = 'pdf' | 'png' | 'jpg' | 'empty' | 'inconnu';

/** Détecte le format d'un document par ses octets de tête (port de DOC_getFormat). */
export function detecterFormat(bytes: Uint8Array | null | undefined): FormatDoc {
  if (!bytes || bytes.length === 0) return 'empty';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'; // %PDF
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'; // \x89PNG
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'; // JPEG SOI
  return 'inconnu';
}

export const estPdf = (b: Uint8Array | null | undefined): boolean => detecterFormat(b) === 'pdf';

/** Générateur de vignette (port de DOC_creerThumbnail) — implémentation injectée (Imagick/sharp…). */
export interface Vignetteur {
  creer(source: Uint8Array, options?: { largeur?: number; hauteur?: number; qualite?: number }): Uint8Array;
}

/** Génère le HTML d'un document (lettre) pour une clé donnée. */
export function genererDocumentHtml(runtime: Runtime, nomLettre: string, cle: string[]): string {
  const zzz = runtime.visu(nomLettre, cle, 'let');
  // acces fourni : permet de rendre les widgets-listes (grand livre, journal…) dans le document.
  return renderEcran(zzz, { mode: 'document', acces: runtime.accesDonnees() });
}

/** Génère un PDF d'un document via un PdfRenderer injecté (vérifie que la sortie est bien un PDF). */
export async function genererPdf(renderer: PdfRenderer, runtime: Runtime, nomLettre: string, cle: string[]): Promise<Uint8Array> {
  const html = genererDocumentHtml(runtime, nomLettre, cle);
  const bytes = await renderer.rendre(html);
  // garde MML_NON_PDF : refuse une sortie qui n'est pas un PDF binaire valide.
  if (detecterFormat(bytes) !== 'pdf') {
    throw new Error('genererPdf : la sortie du moteur n\'est pas un PDF valide (MML_NON_PDF)');
  }
  return bytes;
}

/**
 * Impression / document imprimable (port de generSortieHTMLPDF + HTML2PDF).
 *
 * Le rendu en mode « document » produit du HTML (avec, si le compilateur de
 * gabarit est actif, des marqueurs de pagination `</page><page>` et de numéro de
 * page `[[page_cu]]` / `[[page_nb]]`). Cette couche transforme ce HTML en un
 * document imprimable autonome (pages, marges, en-tête/pied), prêt pour
 * l'impression navigateur ou pour un moteur HTML→PDF binaire (PdfRenderer).
 */

import { Runtime } from '../runtime/runtime.js';
import { genererDocumentHtml } from './documents.js';

export interface OptionsImpression {
  titre?: string;
  /** Marges CSS (ex. '2cm'). */
  marges?: string;
  /** En-tête HTML répété (optionnel). */
  entete?: string;
  /** Pied de page HTML répété (optionnel). */
  piedpage?: string;
  /** CSS additionnel. */
  css?: string;
}

/**
 * Transforme le HTML « document » en page imprimable autonome.
 * Gère la pagination `</page><page>` et résout les numéros `[[page_cu]]`/`[[page_nb]]`.
 */
export function documentImprimable(corpsHtml: string, options: OptionsImpression = {}): string {
  // découpe en pages sur le marqueur produit par @sautPage
  const morceaux = corpsHtml.split('</page><page>');
  const total = morceaux.length;
  const pages = morceaux.map((contenu, i) => {
    const num = i + 1;
    const resolu = contenu
      .replace(/\[\[page_cu\]\]/g, String(num))
      .replace(/\[\[page_nb\]\]/g, String(total));
    const entete = options.entete ? `<header class="md-entete">${options.entete}</header>` : '';
    const pied = options.piedpage ? `<footer class="md-pied">${options.piedpage}</footer>` : '';
    return `<section class="md-page">${entete}<div class="md-page-corps">${resolu}</div>${pied}</section>`;
  }).join('\n');

  const marges = options.marges ?? '1.5cm';
  const css = `
    @page { margin: ${marges}; }
    .md-page { page-break-after: always; }
    .md-page:last-child { page-break-after: auto; }
    .arob.affRO { white-space: pre-wrap; }
    ${options.css ?? ''}`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />`
    + `<title>${escape(options.titre ?? 'Document')}</title><style>${css}</style></head>`
    + `<body class="md-document">${pages}</body></html>`;
}

/** Génère le document imprimable d'une lettre pour une clé (compose o13/o14). */
export function genererImpression(runtime: Runtime, nomLettre: string, cle: string[], options: OptionsImpression = {}): string {
  const corps = genererDocumentHtml(runtime, nomLettre, cle);
  return documentImprimable(corps, options);
}

function escape(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

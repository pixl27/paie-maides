/**
 * PdfRenderer haute fidélité via un navigateur sans tête (Puppeteer).
 *
 * Le module `puppeteer` n'est PAS une dépendance dure du noyau : il est importé
 * dynamiquement à l'exécution (l'hôte l'installe s'il veut un PDF parfait). Un
 * lanceur injectable permet de tester l'adaptateur sans Chromium.
 */

import { PdfRenderer } from './documents.js';

/** Page minimale attendue d'un navigateur sans tête. */
export interface PageSansTete {
  setContent(html: string, options?: Record<string, any>): Promise<void>;
  pdf(options?: Record<string, any>): Promise<Uint8Array | { buffer?: ArrayBuffer } | ArrayBuffer>;
}
/** Navigateur sans tête minimal. */
export interface NavigateurSansTete {
  newPage(): Promise<PageSansTete>;
  close(): Promise<void>;
}
/** Lanceur (puppeteer.launch). */
export type LanceurNavigateur = (options?: Record<string, any>) => Promise<NavigateurSansTete>;

export interface OptionsPuppeteer {
  /** Format de page (A4 par défaut). */
  format?: string;
  /** Imprimer les fonds CSS. */
  fonds?: boolean;
  /** Lanceur injecté (sinon import dynamique de puppeteer). */
  lanceur?: LanceurNavigateur;
  /** Options passées au lanceur. */
  optionsLancement?: Record<string, any>;
}

function versUint8(x: Uint8Array | ArrayBuffer | { buffer?: ArrayBuffer }): Uint8Array {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (x && x.buffer instanceof ArrayBuffer) return new Uint8Array(x.buffer);
  return new Uint8Array(0);
}

export class PuppeteerPdfRenderer implements PdfRenderer {
  constructor(private options: OptionsPuppeteer = {}) {}

  private async resoudLanceur(): Promise<LanceurNavigateur> {
    if (this.options.lanceur) return this.options.lanceur;
    // import dynamique (spécifieur non littéral : pas de résolution de type à la compilation)
    const nom = 'puppeteer';
    const mod: any = await import(nom);
    const pptr = mod.default ?? mod;
    return (opts) => pptr.launch(opts);
  }

  async rendre(html: string): Promise<Uint8Array> {
    const lanceur = await this.resoudLanceur();
    const navigateur = await lanceur(this.options.optionsLancement ?? { headless: true, args: ['--no-sandbox'] });
    try {
      const page = await navigateur.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buf = await page.pdf({ format: this.options.format ?? 'A4', printBackground: this.options.fonds ?? true });
      return versUint8(buf);
    } finally {
      await navigateur.close();
    }
  }
}

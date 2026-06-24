/**
 * Comparaison et manipulation des clés (port des conventions de clé du moteur :
 * clé multi-éléments, comparaison typée, _key space-paddé).
 */

import { Patron } from '../metamodel/types.js';

/** Longueur de padding d'un élément de clé pour le tri lexicographique (port de LONGUEUR_ELEMS_CLE). */
export const LONGUEUR_ELEMS_CLE = 20;

function estNumerique(v: any): boolean {
  if (typeof v === 'number') return true;
  const s = String(v).trim();
  return s !== '' && !Number.isNaN(Number(s));
}

/** Compare deux éléments de clé : numérique si les deux le sont, sinon lexicographique. */
export function cmpElem(a: any, b: any): number {
  if (estNumerique(a) && estNumerique(b)) {
    const na = Number(a); const nb = Number(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = String(a); const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Compare deux clés élément par élément (la plus courte d'abord en cas de préfixe). */
export function cmpCle(a: string[], b: string[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = cmpElem(a[i], b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

/** Clé (valeurs ordonnées) d'un enregistrement selon le patron. */
export function cleDeRecord(patron: Patron, rec: Record<string, any>): string[] {
  return patron.is_key.map((nom) => String(rec[nom] ?? ''));
}

/** _key paddé : chaque élément complété à gauche par des espaces (tri séquentiel). */
export function keyPaddee(cle: string[]): string {
  return cle.map((e) => String(e).padStart(LONGUEUR_ELEMS_CLE, ' ')).join('');
}

/** Clé vide (tous éléments vides) ou absente. */
export function cleVide(cle: string[] | null | undefined): boolean {
  if (!cle || cle.length === 0) return true;
  return cle.every((e) => e === '' || e === null || e === undefined);
}

/**
 * Séquences / compteurs de clés (port de derniereCle / prochaineCle /
 * prochaineCleMinimale / incrementeAlpha, accesMySQL.php + functions.php).
 *
 * Travaillent sur l'ensemble des enregistrements d'une table (fournis par la
 * couche de stockage), sans SQL.
 */

import { Patron } from '../metamodel/types.js';
import { cleDeRecord, cmpCle } from './keys.js';

/**
 * Incrémentation « alphabétique » 0-9 puis A-Z avec retenue
 * (port fidèle de incrementeAlpha, functions.php:651).
 */
export function incrementeAlpha(chaineSource: string): string {
  const s = String(chaineSource ?? '').toUpperCase();
  if (s === '') return '1';
  const code0 = '0'.charCodeAt(0);
  const code9 = '9'.charCodeAt(0);
  const codeA = 'A'.charCodeAt(0);
  const codeZ = 'Z'.charCodeAt(0);

  if (s.length === 1) {
    const nv = s.charCodeAt(0) + 1;
    if (nv > code9 && nv < codeA) return 'A';
    if (nv > codeZ) return '10';
    if (nv < code0) return '1';
    return String.fromCharCode(nv);
  }
  const dernier = s.charCodeAt(s.length - 1);
  const debut = s.slice(0, -1);
  const nv = dernier + 1;
  if (nv > code9 && nv < codeA) return debut + 'A';
  if (nv > codeZ) return incrementeAlpha(debut) + '0';
  return debut + String.fromCharCode(nv);
}

/**
 * Dernière clé (la plus élevée) d'un ensemble d'enregistrements.
 * Retourne null si la table est vide.
 */
export function derniereCle(records: Record<string, any>[], patron: Patron): string[] | null {
  if (records.length === 0) return null;
  let max: string[] | null = null;
  for (const rec of records) {
    const cle = cleDeRecord(patron, rec);
    if (max === null || cmpCle(cle, max) > 0) max = cle;
  }
  return max;
}

/**
 * Prochaine clé disponible : dernière clé puis incrément du dernier élément
 * selon son type (integer -> +1, string -> incrementeAlpha). Port de prochaineCle.
 */
export function prochaineCle(records: Record<string, any>[], patron: Patron): string[] {
  if (patron.is_key.length === 0) throw new Error('prochaineCle: patron sans clé');
  const nomDernier = patron.is_key[patron.is_key.length - 1]!;
  const typeCle = patron.champs[nomDernier]?.type_champ;
  const max = derniereCle(records, patron);
  const cle = max ? [...max] : patron.is_key.map(() => '');
  const i = cle.length - 1;
  switch (typeCle) {
    case 'integer':
      cle[i] = String((max ? Number(cle[i]) || 0 : 0) + 1);
      break;
    case 'string':
    case 'clop':
      cle[i] = incrementeAlpha(max ? String(cle[i]) : '');
      break;
    default:
      throw new Error("prochaineCle: seulement pour une clé finale de type 'integer' ou 'string'");
  }
  return cle;
}

/**
 * Première valeur entière LIBRE d'un champ, bornée optionnellement (port de
 * prochaineCleMinimale). Cherche le plus petit `v+1` non utilisé parmi les
 * valeurs existantes du champ dans [borneMin, borneMax]. Null si aucune.
 */
export function prochaineCleMinimale(
  records: Record<string, any>[],
  champ: string,
  borneMin: number | false = false,
  borneMax: number | false = false,
): number | null {
  const toutes = new Set<number>();
  for (const r of records) {
    const v = Number(r[champ]);
    if (!Number.isNaN(v)) toutes.add(v);
  }
  let candidat: number | null = null;
  for (const v of toutes) {
    if (borneMin !== false && v < borneMin) continue;
    if (borneMax !== false && v > borneMax) continue;
    const c = v + 1;
    if (!toutes.has(c) && (candidat === null || c < candidat)) candidat = c;
  }
  return candidat;
}

/**
 * Agrégats sur un ensemble d'enregistrements (port de DB_aggregate,
 * accesDBCommon.php) : SOMME/SUM, COMPTE/COUNT, COMPTEUNIQUE/COUNTDISTINCT,
 * MAX, MIN, MOYENNE/AVG, avec filtre composite (et/ou).
 */

import { filtrer } from './conditions.js';

export type OperationAgregat =
  | 'somme' | 'sum'
  | 'compte' | 'count'
  | 'compteunique' | 'countdistinct'
  | 'max' | 'min'
  | 'moyenne' | 'avg';

/** Calcule un agrégat sur les enregistrements donnés. */
export function agrege(
  records: Record<string, any>[],
  operation: string,
  champ: string,
  filtre = '',
): number {
  const rows = filtre ? filtrer(records, filtre) : records;
  const op = operation.toLowerCase();

  if (op === 'compte' || op === 'count') return rows.length;
  if (op === 'compteunique' || op === 'countdistinct') {
    return new Set(rows.map((r) => String(r[champ]))).size;
  }
  const valeurs = rows.map((r) => Number(r[champ]) || 0);
  switch (op) {
    case 'somme': case 'sum': return valeurs.reduce((a, b) => a + b, 0);
    case 'moyenne': case 'avg': return valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : 0;
    case 'max': return valeurs.length ? Math.max(...valeurs) : 0;
    case 'min': return valeurs.length ? Math.min(...valeurs) : 0;
    default: throw new Error(`agrege: opération '${operation}' inconnue`);
  }
}

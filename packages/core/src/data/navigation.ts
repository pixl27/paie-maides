/**
 * Navigation séquentielle sur la clé (port de up / down / find / findLight,
 * accesMySQL.php). Travaille sur l'ensemble des enregistrements d'une table.
 *
 * Algorithme up/down (« simplifié et bourrin qui fonctionne ») : égalité sur
 * tous les éléments de clé sauf le dernier, et `<` (up) / `>` (down) sur le
 * dernier ; si rien trouvé, on raccourcit la clé d'un cran et on recommence.
 */

import { Patron } from '../metamodel/types.js';
import { cleDeRecord, cmpCle, cmpElem, cleVide } from './keys.js';

function trieParCle(records: Record<string, any>[], patron: Patron, desc = false): Record<string, any>[] {
  return [...records].sort((a, b) => {
    const c = cmpCle(cleDeRecord(patron, a), cleDeRecord(patron, b));
    return desc ? -c : c;
  });
}

/** Enregistrement précédent (port de up). null si premier / aucun. */
export function up(records: Record<string, any>[], patron: Patron, cleCourante: string[] | null): Record<string, any> | null {
  return voisin(records, patron, cleCourante, 'up');
}

/** Enregistrement suivant (port de down). null si dernier / aucun. */
export function down(records: Record<string, any>[], patron: Patron, cleCourante: string[] | null): Record<string, any> | null {
  return voisin(records, patron, cleCourante, 'down');
}

function voisin(
  records: Record<string, any>[],
  patron: Patron,
  cleCourante: string[] | null,
  sens: 'up' | 'down',
): Record<string, any> | null {
  const isKey = patron.is_key;
  const desc = sens === 'up';
  const tries = trieParCle(records, patron, desc);

  // clé vide : premier (down) / dernier (up) enregistrement global
  if (cleVide(cleCourante)) {
    return tries.length > 0 ? { ...tries[0]! } : null;
  }
  const cle = cleCourante as string[];

  for (let taille = isKey.length; taille > 0; taille--) {
    const candidat = tries.find((rec) => {
      for (let i = 0; i < taille; i++) {
        const champ = isKey[i]!;
        const c = cmpElem(rec[champ], cle[i]);
        if (i < taille - 1) {
          if (c !== 0) return false; // égalité requise
        } else {
          if (sens === 'up' ? c >= 0 : c <= 0) return false; // < (up) / > (down)
        }
      }
      return true;
    });
    if (candidat) return { ...candidat };
  }
  return null;
}

/** Recherche par préfixe de clé (port de findLight / findStrict = find(cle, cle)). */
export function findLight(
  records: Record<string, any>[],
  patron: Patron,
  prefixe: string[],
  nbMax = 0,
): Record<string, any>[] {
  const res = trieParCle(records, patron).filter((rec) => {
    const cle = cleDeRecord(patron, rec);
    for (let i = 0; i < prefixe.length; i++) {
      if (cmpElem(cle[i], prefixe[i]) !== 0) return false;
    }
    return true;
  });
  return nbMax > 0 ? res.slice(0, nbMax) : res;
}

export interface FindOptions {
  /** Tri inverse (descendant). */
  inverse?: boolean;
  /** Nombre max de lignes (0 = illimité). */
  nbMax?: number;
}

/**
 * Recherche par plage (port de find) : si debut == fin -> préfixe ; sinon
 * `cle >= debut AND cle < fin`, triée par clé.
 */
export function find(
  records: Record<string, any>[],
  patron: Patron,
  debut: string[],
  fin: string[],
  options: FindOptions = {},
): Record<string, any>[] {
  if (cmpCle(debut, fin) === 0) return findLight(records, patron, debut, options.nbMax);
  const res = trieParCle(records, patron, options.inverse).filter((rec) => {
    const cle = cleDeRecord(patron, rec);
    return cmpCle(cle, debut) >= 0 && cmpCle(cle, fin) < 0;
  });
  return options.nbMax && options.nbMax > 0 ? res.slice(0, options.nbMax) : res;
}

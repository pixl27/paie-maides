/**
 * Gestion des droits (port de gestionDroits.php).
 *
 * Convention héritée : plus le `niveau` de l'utilisateur est BAS, plus il est
 * privilégié (0 = max). Un écran de catégorie 'scr' est autorisé si l'utilisateur
 * est super-admin, si l'écran n'a pas de niveau requis, ou si
 * `niveauUtilisateur <= niveauDroits` de l'écran.
 */

import { UserInfo } from '../expression/env.js';
import { Ecran } from '../runtime/ecran.js';

/** Vrai si l'utilisateur peut accéder à l'écran (port de DRT_ecranEstAutorise). */
export function ecranEstAutorise(ecran: Pick<Ecran, 'niveauDroits'> & { categorie?: string }, user: UserInfo): boolean {
  if (user.superAdmin) return true;
  if (ecran.categorie && ecran.categorie !== 'scr') return true;
  if (ecran.niveauDroits == null || ecran.niveauDroits === ('' as any)) return true;
  return user.niveau <= ecran.niveauDroits;
}

/** Vrai si une entrée de menu (de droit `menuDroit`) est visible pour l'utilisateur. */
export function menuEstVisible(menuDroit: number | undefined, user: UserInfo): boolean {
  if (user.superAdmin) return true;
  if (menuDroit == null) return true;
  return menuDroit >= user.niveau;
}

export const DRT_GENERIQUE = 0;
export const DRT_ACCES_INTERDIT = 1;
export const DRT_NON_AUTHENTIFIE = 2;

/** Erreur de droits (port de DrtException). */
export class DrtException extends Error {
  code: number;
  constructor(code = 0, extra = '') {
    const libelle: Record<number, string> = {
      [DRT_GENERIQUE]: extra,
      [DRT_ACCES_INTERDIT]: 'Droits insuffisants',
      [DRT_NON_AUTHENTIFIE]: 'Non authentifié',
    };
    super(`DRT (${code}) ${libelle[code] ?? ''}`);
    this.name = 'DrtException';
    this.code = code;
  }
}

/**
 * Code « spécifique » : la trappe d'extension pour brancher de la logique métier
 * sur-mesure sur un écran (port de `spe_php` / `demarre()` / `sp_avant_creeZzz`
 * et des ordres spécifiques o41–o90 du moteur PHP).
 *
 * Là où le langage d'expressions ne suffit pas, on enregistre du vrai code
 * (TypeScript) appelé aux moments clés du cycle de vie d'un écran. C'est ce qui
 * permet d'implémenter *n'importe quelle* règle métier.
 */

import { UserInfo, ExpMessage } from '../expression/env.js';
import { Zzz } from './zzz.js';

/** Contexte fourni au code spécifique : accès à l'état, aux droits et aux outils. */
export interface SpecifiqueContexte {
  /** État courant de l'écran (champs, valeurs, clé…). */
  zzz: Zzz;
  /** Utilisateur courant. */
  user: UserInfo;
  /** Évalue une expression maides sur l'état courant et renvoie sa valeur. */
  evaluer(expression: string): any;
  /** Signale une erreur bloquante (empêche la sauvegarde). */
  erreur(message: string): void;
  /** Ajoute un message non bloquant. */
  message(type: ExpMessage['type'], text: string): void;
  /** Accès direct aux valeurs (raccourci de zzz.valeurs). */
  readonly valeurs: Record<string, any>;
}

/** Un point d'extension : reçoit le contexte et agit sur l'état. */
export type HookSpecifique = (ctx: SpecifiqueContexte) => void;

/** Ensemble des points d'extension d'un écran. */
export interface Specifique {
  /** Appelé juste après la création de l'état (port de `demarre`). */
  demarre?: HookSpecifique;
  /** Appelé après chargement du fichier maître et des relations. */
  apresChargement?: HookSpecifique;
  /** Appelé avant la validation/sauvegarde (peut ajuster ou bloquer). */
  avantSauvegarde?: HookSpecifique;
  /** Appelé après une sauvegarde réussie. */
  apresSauvegarde?: HookSpecifique;
  /** Ordres/opérations personnalisés (équiv. o41–o90), par nom. */
  ordres?: Record<string, HookSpecifique>;
}

/** Registre des codes spécifiques, indexés par nom d'écran. */
export class SpecifiqueRegistry {
  private map = new Map<string, Specifique>();

  /** Enregistre le code spécifique d'un écran. */
  enregistrer(nomEcran: string, spec: Specifique): this {
    this.map.set(nomEcran, spec);
    return this;
  }

  /** Récupère le code spécifique d'un écran (ou undefined). */
  pour(nomEcran: string): Specifique | undefined {
    return this.map.get(nomEcran);
  }
}

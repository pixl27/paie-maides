/**
 * Couches de paramétrage R4 (port de R4_gestion.php).
 *
 * 5 couches, de la plus spécifique (paramR4, niveau 4) à la plus générale
 * (paramR1, niveau 1), plus la couche de données d'exploitation (data, niveau 5).
 * La résolution cascade du niveau de départ vers 1 : la première couche qui
 * répond gagne -> le paramétrage spécifique surcharge le général (multi-tenant).
 */

import { Patron } from '../metamodel/types.js';

export type LayerId = 'data' | 'paramR4' | 'paramR3' | 'paramR2' | 'paramR1';

/** Niveau numérique de chaque couche. */
export const LAYER_LEVEL: Record<LayerId, number> = {
  data: 5,
  paramR4: 4,
  paramR3: 3,
  paramR2: 2,
  paramR1: 1,
};

/** Couche correspondant à un niveau. */
export const LEVEL_LAYER: Record<number, LayerId> = {
  5: 'data',
  4: 'paramR4',
  3: 'paramR3',
  2: 'paramR2',
  1: 'paramR1',
};

export const R4_NIVEAU_DEFAUT = 5;       // couche data
export const R4_NIVEAU_PARAMS_MAX = 4;   // couche paramR4

/** Liste ordonnée des couches du niveau `start` vers 1 (port de R4_retourneListeConnLevel). */
export function retourneListeConnLevel(start: number): LayerId[] {
  const list: LayerId[] = [];
  for (let lvl = start; lvl >= 1; lvl--) {
    const id = LEVEL_LAYER[lvl];
    if (id) list.push(id);
  }
  return list;
}

/**
 * Store d'UNE couche : accès aux patrons et aux enregistrements de cette couche.
 * Une implémentation PostgreSQL et une implémentation mémoire sont fournies.
 */
export interface LayerStore {
  /** Charge la définition d'un patron (table) ; null si absent de cette couche. */
  loadPatron(nomTable: string): Patron | null;
  /** Recherche un enregistrement par sa clé ; null si absent. */
  search(nomTable: string, cle: string[]): Record<string, any> | null;
  /** Tous les enregistrements d'une table (pour agrégats / tableInf / tableSup). */
  listAll(nomTable: string): Record<string, any>[];
  /** Insère ou met à jour un enregistrement (clé calculée via le patron local). */
  save(nomTable: string, record: Record<string, any>): void;
  /** Insère ou met à jour un enregistrement avec une clé explicite. */
  saveWithKey?(nomTable: string, cle: string[], record: Record<string, any>): void;
  /** Supprime un enregistrement par sa clé ; vrai si supprimé. */
  delete(nomTable: string, cle: string[]): boolean;
  /** Exécute une requête nommée (optionnel). */
  query?(named: string, vars: Record<string, any>): Record<string, any>[];
  /** Persiste une définition de patron (optionnel ; requis par les designers). */
  savePatron?(patron: Patron): void;
  /** Supprime une définition de patron (optionnel). */
  deletePatron?(nomTable: string): boolean;
  /** Liste les patrons de la couche (optionnel ; utilisé par les designers). */
  listPatrons?(): Patron[];
}

/**
 * `Zzz` : structure d'état d'exécution d'un écran (port de la variable globale
 * `$zzz` du moteur PHP). C'est le pivot du runtime : elle porte la définition
 * de l'écran, les valeurs courantes, la clé, le mode (« ordre ») et les erreurs.
 */

import { Patron } from '../metamodel/types.js';
import { ChampDef, ExpMessage } from '../expression/env.js';
import { Ecran, Widget } from './ecran.js';

export interface Zzz {
  /** Nom de l'écran. */
  e: string;
  /** Ordre courant (mode d'exécution). */
  o: number | string;
  /** Paramètres OBE optionnels : m = mode de rendu, n = séquence, p = paramètre. */
  m?: string;
  n?: string;
  p?: string;
  /** Patron de recherche de l'écran : 'scr' (écran) ou 'let' (lettre). */
  patEcran: 'scr' | 'let';
  /** Clé du document courant. */
  cle: string[];
  /** Nom de la table liée (fichier maître). */
  ficMaitre: string;
  /** Patron du fichier maître. */
  patronMaitre?: Patron;
  /** Écran chargé. */
  ecran?: Ecran;
  /** Dictionnaire des champs (widgets) de l'écran. */
  champs: Record<string, Widget>;
  /** Valeurs courantes des champs. */
  valeurs: Record<string, any>;
  /** Champs additionnels (variables libres injectées). */
  champsExtra: Record<string, Widget>;
  /** Valeurs additionnelles. */
  valeursExtra: Record<string, any>;
  /** Vrai si le document est nouveau (non trouvé en base). */
  nouveauDoc: boolean;
  /** Vrai si une erreur bloquante a été détectée à la validation. */
  erreurBloquante: boolean;
  /** Messages remontés (erreurs, attentions, succès…). */
  messages: ExpMessage[];
  /**
   * Droits par champ résolus pour l'utilisateur (port de appliqueDroits) :
   * `ro` = lecture seule, `masque` = non affiché (droit 'P'). Calculé sans muter
   * les définitions de widgets (partagées entre requêtes).
   */
  droits?: Record<string, { ro?: boolean; masque?: boolean; droit?: string }>;
}

/**
 * Construit le dictionnaire de types attendu par le moteur d'expressions à
 * partir de l'écran et du patron maître (le patron prime pour les types).
 */
export function dicoDeZzz(zzz: Zzz): Record<string, ChampDef> {
  const dico: Record<string, ChampDef> = {};
  if (zzz.patronMaitre) {
    for (const [nom, champ] of Object.entries(zzz.patronMaitre.champs)) {
      dico[nom] = { type_champ: champ.type_champ };
    }
  }
  for (const [nom, widget] of Object.entries(zzz.champs)) {
    const type = widget.type_champ || dico[nom]?.type_champ;
    dico[nom] = { ...(dico[nom] ?? {}), ...widget, ...(type ? { type_champ: type } : {}) };
  }
  for (const [nom, widget] of Object.entries(zzz.champsExtra)) {
    dico[nom] = { ...widget };
  }
  return dico;
}

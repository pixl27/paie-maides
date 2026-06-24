/**
 * Métamodèle « maides » : les `patrons` (définitions de tables) et leurs `champs`.
 *
 * Port fidèle des structures `patrons` / `patrons_champs` du moteur PHP.
 * Les noms d'attributs (nom_table, nom_champ, type_champ, val_def, is_key…) sont
 * conservés afin que les écrans et expressions historiques restent compatibles.
 */

/** Types de champ supportés (colonne `type_champ`). */
export type TypeChamp =
  | 'clop'      // chaine (défaut)
  | 'string'
  | 'blob'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'array';

/** Définition d'un champ (ligne de `patrons_champs`). */
export interface Champ {
  nom_champ: string;
  type_champ: TypeChamp;
  /** Valeur par défaut (chaine, interprétée selon le type). */
  val_def?: string;
  /** Taille du tableau (> 0 => champ de type tableau). */
  taille_tableau?: number;
  /** 1 si auto-incrémenté. */
  est_autoincrement?: number;
  /** 1 si le champ fait partie de la clé. */
  est_cle?: number;
  /** Position du champ dans la clé (1-based). */
  ordre_cle?: number;
  /** Libellé d'affichage. */
  libelle?: string;
  /** Masque de format. */
  format?: string;
  /** Attributs additionnels (widgets d'écran, formules, etc.). */
  [k: string]: any;
}

/**
 * Relation entre patrons (port du système de relations / azxRelation).
 *  - `enfants` : relation un-à-plusieurs (maître -> enregistrements liés) ;
 *  - `parent`  : relation plusieurs-à-un (lookup d'un enregistrement parent).
 */
export interface Relation {
  /** Nom sous lequel les données liées sont exposées dans l'enregistrement. */
  nom: string;
  type: 'enfants' | 'parent';
  /** Table liée. */
  table: string;
  /** Champs locaux composant la clé de jointure. */
  cle_locale: string[];
  /** Champs distants composant la clé de jointure. */
  cle_distante: string[];
}

/** Définition d'un patron (ligne de `patrons` + ses champs). */
export interface Patron {
  nom_table: string;
  /** Dictionnaire des champs, indexé par nom_champ. */
  champs: Record<string, Champ>;
  /** Noms des champs composant la clé, dans l'ordre. */
  is_key: string[];
  /** Noms des champs de type tableau (cache). */
  champsTableau?: string[];
  /** Emplacement des données : 'D' (couche data) ou 'P' (couche paramètres). */
  emplacement?: 'D' | 'P';
  /** Vrai s'il s'agit d'une vue. */
  est_vue?: boolean;
  /** Pour les vues : patrons composant la vue. */
  liste_patrons?: string[];
  /** Relations vers d'autres patrons (enfants / parents). */
  relations?: Relation[];
  /** Attributs additionnels. */
  [k: string]: any;
}

/** Construit un patron à partir d'une liste de champs (calcule is_key et champsTableau). */
export function creerPatron(
  nomTable: string,
  champs: Champ[],
  options: { emplacement?: 'D' | 'P'; est_vue?: boolean; relations?: Relation[] } = {},
): Patron {
  const champsMap: Record<string, Champ> = {};
  const champsTableau: string[] = [];
  const cleAvecOrdre: { nom: string; ordre: number }[] = [];

  for (const champ of champs) {
    champsMap[champ.nom_champ] = champ;
    if ((champ.taille_tableau ?? 0) > 0 || champ.type_champ === 'array') {
      champsTableau.push(champ.nom_champ);
    }
    if (champ.est_cle) {
      cleAvecOrdre.push({ nom: champ.nom_champ, ordre: champ.ordre_cle ?? cleAvecOrdre.length + 1 });
    }
  }

  const is_key = cleAvecOrdre.sort((a, b) => a.ordre - b.ordre).map((c) => c.nom);

  return {
    nom_table: nomTable,
    champs: champsMap,
    is_key,
    champsTableau,
    emplacement: options.emplacement ?? 'D',
    est_vue: options.est_vue ?? false,
    ...(options.relations ? { relations: options.relations } : {}),
  };
}

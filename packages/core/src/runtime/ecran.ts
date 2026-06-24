/**
 * Écrans (« scr ») et lettres (« let ») : définitions d'interface pilotées par
 * données. Un écran est un document portant un `template`, une table liée et un
 * dictionnaire de `champs` (widgets). Port des structures manipulées par
 * creeZzz()/genereSortieWidgets() (jyFonctions.php).
 */

/** Définition d'un champ d'écran (widget). */
export interface Widget {
  /** Nom du champ (clé dans le dictionnaire). */
  nom_champ?: string;
  /** Type de widget : text, decimal, integer, date, select, array, execScreen, ordreBoutonObe… */
  type_widget?: string;
  /** Type de donnée (sinon déduit du widget / patron). */
  type_champ?: string;
  /** Valeur par défaut. */
  val_def?: any;
  /** Formule de calcul (langage d'expressions). */
  formule_calcul?: string;
  /** '1' = recalculé systématiquement ; '0' = uniquement si nouveau document. */
  calcul_systematique?: '0' | '1' | string;
  /** 1 si obligatoire (NOT NULL). */
  est_notnull?: number;
  /** Bornes de validation. */
  val_min?: string;
  val_max?: string;
  /** Longueur max (type string). */
  option_type_champ?: any;
  /** Formule de validation (doit renvoyer vrai). */
  validation?: string;
  /** Message d'erreur de validation. */
  mess_validation?: string;
  /** Libellé. */
  libelle?: string;
  /** 1 si lecture seule. */
  est_lecture_seule?: number;
  /** Type de variable ('lbr' = variable libre, non persistée). */
  type_var?: string;
  [k: string]: any;
}

/** Définition d'un écran (document de patron 'scr' ou 'let'). */
export interface Ecran {
  nom_ecran: string;
  /** Table de données liée (fichier maître). */
  table_liee?: string;
  /** Gabarit HTML (placeholders $champ). */
  template?: string;
  /** Dictionnaire des widgets. */
  champs: Record<string, Widget>;
  /** Niveau de droit requis. */
  niveauDroits?: number;
  /** Compilation activée. */
  compiler?: number | boolean;
  [k: string]: any;
}

/** Largeur de chaine par défaut (port de DB_DEFAULT_STRING_LENGTH). */
export const DB_DEFAULT_STRING_LENGTH = 255;

/** Types de widget exclus de la validation (port de validationSaisie). */
export const WIDGETS_EXCLUS_VALIDATION = ['array', 'execScreen', 'ordreBoutonObe'];

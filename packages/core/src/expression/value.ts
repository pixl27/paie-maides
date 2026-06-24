/**
 * Modèle de valeurs du langage d'expressions « maides ».
 *
 * Port fidèle des « jetons » typés du moteur PHP d'origine (mdExpression.php),
 * où chaque valeur était un tuple `[type, valeur]` (ex: `['nbr', 12]`).
 * On utilise ici une union discriminée, plus sûre et idiomatique en TypeScript.
 */

export type MdType = 'nbr' | 'str' | 'dte' | 'arr' | 'void' | 'rec' | 'col';

export interface MdValue {
  /** Type du jeton : nombre, chaine, date, tableau, void, enregistrement, collection. */
  type: MdType;
  /** Valeur portée. */
  value: any;
}

/* ------------------------------------------------------------------ */
/* Constructeurs                                                        */
/* ------------------------------------------------------------------ */

/** Construit un jeton nombre. Les chaines numériques sont converties en `number`. */
export function nbr(value: number | string): MdValue {
  if (typeof value === 'string' && value !== '' && isNumericString(value)) {
    return { type: 'nbr', value: Number(value) };
  }
  return { type: 'nbr', value };
}

/** Construit un jeton chaine. */
export function str(value: string | number): MdValue {
  return { type: 'str', value: String(value) };
}

/** Construit un jeton date (format interne littéral `JJ-MM-AAAA`). */
export function dte(value: string): MdValue {
  return { type: 'dte', value };
}

/** Construit un jeton tableau (liste indexée ou enregistrement associatif, comme les tableaux PHP). */
export function arr(value: any[] | Record<string, any>): MdValue {
  return { type: 'arr', value };
}

/** Construit le jeton `void` (absence de résultat). */
export function voidVal(): MdValue {
  return { type: 'void', value: 0 };
}

/* ------------------------------------------------------------------ */
/* Tests de type (équivalents des __varEst* du moteur PHP)             */
/* ------------------------------------------------------------------ */

export const isNbr = (v: MdValue): boolean => v.type === 'nbr';
export const isStr = (v: MdValue): boolean => v.type === 'str';
export const isDte = (v: MdValue): boolean => v.type === 'dte';
export const isArr = (v: MdValue): boolean => v.type === 'arr';
export const isVoid = (v: MdValue): boolean => v.type === 'void';

/* ------------------------------------------------------------------ */
/* Coercition                                                          */
/* ------------------------------------------------------------------ */

/** Vrai si la chaine représente un nombre (équivalent souple de is_numeric en PHP). */
export function isNumericString(s: string): boolean {
  if (typeof s === 'number') return true;
  const t = s.trim();
  if (t === '') return false;
  return !Number.isNaN(Number(t));
}

/**
 * Transforme une chaine en nombre (équivalent de __strToNum).
 * - chaine vide  -> nombre 0
 * - chaine numérique -> nombre
 * - sinon -> valeur inchangée
 */
export function strToNum(v: MdValue): MdValue {
  if (isStr(v)) {
    if (v.value === '' || v.value === null || v.value === undefined) return nbr(0);
    if (isNumericString(v.value)) return nbr(Number(v.value));
    return v;
  }
  return v;
}

/** Renvoie la valeur numérique d'un jeton (tolérant), 0 si non convertible. */
export function asNumber(v: MdValue): number {
  const n = strToNum(v);
  const x = Number(n.value);
  return Number.isNaN(x) ? 0 : x;
}

/**
 * Récupère la valeur « brute » d'un jeton (équivalent de retVal()).
 * Les dates littérales `JJ-MM-AAAA` sont converties au format MySQL `AAAA-MM-JJ`.
 */
export function retVal(v: MdValue): any {
  switch (v.type) {
    case 'dte': {
      const m = /(\d{2})-(\d{2})-(\d{4})/.exec(String(v.value));
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return v.value;
    }
    default:
      return v.value;
  }
}

/** Évalue la « vérité » d'une valeur, façon PHP (0, '', '0', null => faux). */
export function truthy(v: MdValue): boolean {
  const raw = retVal(v);
  if (raw === 0 || raw === '0' || raw === '' || raw === null || raw === undefined || raw === false) {
    return false;
  }
  return true;
}

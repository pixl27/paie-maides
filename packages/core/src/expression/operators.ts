/**
 * Opérateurs du langage d'expressions (port fidèle des op_* de mdExpression.php).
 *
 * Corrections de bugs latents par rapport à l'original (documentées) :
 *  - `^` (puissance) : déclaré dans l'original mais absent de l'évaluateur -> implémenté.
 *  - `~~` (contient) : jamais tokenisé dans l'original (bug de regex) -> rendu fonctionnel.
 *  - `u-` (moins unaire) : ne marchait que sur les littéraux -> généralisé.
 */

import { MdValue, nbr, str, dte, strToNum, isNbr, isDte, isNumericString } from './value.js';
import { nbJourFromLiteral, literalFromDays } from './dates.js';
import { ExpCriticalException } from './errors.js';

function toDays(v: MdValue): number {
  return nbJourFromLiteral(String(v.value));
}

function numericLike(x: any): boolean {
  return typeof x === 'number' || (typeof x === 'string' && isNumericString(x));
}

/** Comparaison « souple » façon PHP : numérique si possible, sinon lexicographique. */
function cmp(a: any, b: any): number {
  if (numericLike(a) && numericLike(b)) {
    const na = Number(a);
    const nb = Number(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function looseEq(a: any, b: any): boolean {
  if (numericLike(a) && numericLike(b)) return Number(a) === Number(b);
  return String(a) === String(b);
}

function phpTruthy(raw: any): boolean {
  return !(raw === 0 || raw === '0' || raw === '' || raw === null || raw === undefined || raw === false);
}

/* ------------------------- arithmétique ------------------------- */

export function op_plus(val1: MdValue, val2: MdValue): MdValue {
  const a = strToNum(val1);
  const b = strToNum(val2);
  if (isNbr(a) && isNbr(b)) {
    return nbr(Number(a.value) + Number(b.value));
  }
  if (isDte(a) && (isDte(b) || isNbr(b))) {
    const bd = isDte(b) ? toDays(b) : Number(b.value);
    return dte(literalFromDays(toDays(a) + bd));
  }
  // sinon concaténation
  return str(String(a.value) + String(b.value));
}

export function op_moins(val1: MdValue, val2: MdValue): MdValue {
  let a = strToNum(val1);
  let b = strToNum(val2);
  if (isDte(a)) a = nbr(toDays(a));
  if (isDte(b)) b = nbr(toDays(b));
  if (isNbr(a) && isNbr(b)) {
    return nbr(Number(a.value) - Number(b.value));
  }
  throw new ExpCriticalException(`Tentative de soustraction sur des valeurs non numeric: ${val1.value} - ${val2.value}`);
}

export function op_mult(val1: MdValue, val2: MdValue): MdValue {
  const a = strToNum(val1);
  const b = strToNum(val2);
  if (isNbr(a) && isNbr(b)) {
    return nbr(Number(a.value) * Number(b.value));
  }
  throw new ExpCriticalException(`Tentative de multiplication sur des valeurs non numeric: ${val1.value} * ${val2.value}`);
}

export function op_div(val1: MdValue, val2: MdValue): MdValue {
  const a = strToNum(val1);
  const b = strToNum(val2);
  if (isNbr(a) && isNbr(b)) {
    if (Number(b.value) === 0) {
      throw new ExpCriticalException('Division par zéro');
    }
    return nbr(Number(a.value) / Number(b.value));
  }
  throw new ExpCriticalException(`Tentative de division sur des valeurs non numeric: ${val1.value} / ${val2.value}`);
}

/** Puissance (corrige un opérateur déclaré mais non implémenté dans l'original). */
export function op_pow(val1: MdValue, val2: MdValue): MdValue {
  const a = strToNum(val1);
  const b = strToNum(val2);
  if (isNbr(a) && isNbr(b)) {
    return nbr(Number(a.value) ** Number(b.value));
  }
  throw new ExpCriticalException(`Tentative de puissance sur des valeurs non numeric: ${val1.value} ^ ${val2.value}`);
}

/* ------------------------- logique ------------------------- */

export function op_et(val1: MdValue, val2: MdValue): MdValue {
  return nbr(phpTruthy(val1.value) && phpTruthy(val2.value) ? 1 : 0);
}

export function op_ou(val1: MdValue, val2: MdValue): MdValue {
  return nbr(phpTruthy(val1.value) || phpTruthy(val2.value) ? 1 : 0);
}

export function op_not(val: MdValue): MdValue {
  if (!isNbr(val)) {
    throw new ExpCriticalException("l'opérateur NON n'accepte que des nombre");
  }
  return nbr(!phpTruthy(val.value) ? 1 : 0);
}

/** Moins unaire (généralisé : littéraux, variables, sous-expressions). */
export function op_neg(val: MdValue): MdValue {
  const a = strToNum(val);
  if (!isNbr(a)) {
    throw new ExpCriticalException(`Négation impossible sur une valeur non numérique : ${val.value}`);
  }
  return nbr(-Number(a.value));
}

/* ------------------------- comparaison ------------------------- */

function prepCompare(v: MdValue): MdValue {
  return isDte(v) ? nbr(toDays(v)) : v;
}

export function op_eqt(val1: MdValue, val2: MdValue): MdValue {
  const a = prepCompare(val1);
  const b = prepCompare(val2);
  return nbr(looseEq(a.value, b.value) ? 1 : 0);
}

export function op_dif(val1: MdValue, val2: MdValue): MdValue {
  // Symétrique de op_eqt (l'original comparait `!=` brut : asymétrie corrigée) :
  // dates ramenées en jours, comparaison souple numérique/lexicale.
  const a = prepCompare(val1);
  const b = prepCompare(val2);
  return nbr(looseEq(a.value, b.value) ? 0 : 1);
}

export function op_lt(val1: MdValue, val2: MdValue): MdValue {
  return nbr(cmp(prepCompare(val1).value, prepCompare(val2).value) < 0 ? 1 : 0);
}

export function op_let(val1: MdValue, val2: MdValue): MdValue {
  return nbr(cmp(prepCompare(val1).value, prepCompare(val2).value) <= 0 ? 1 : 0);
}

export function op_gt(val1: MdValue, val2: MdValue): MdValue {
  return nbr(cmp(prepCompare(val1).value, prepCompare(val2).value) > 0 ? 1 : 0);
}

export function op_get(val1: MdValue, val2: MdValue): MdValue {
  return nbr(cmp(prepCompare(val1).value, prepCompare(val2).value) >= 0 ? 1 : 0);
}

/* ------------------------- chaines (~= ~~ =~) ------------------------- */

/** `a ~= b` : a commence par b. */
export function op_startBy(val1: MdValue, val2: MdValue): MdValue {
  return nbr(String(val1.value).indexOf(String(val2.value)) === 0 ? 1 : 0);
}

/** `a ~~ b` : a est contenu dans b. */
export function op_has(val1: MdValue, val2: MdValue): MdValue {
  return nbr(String(val2.value).indexOf(String(val1.value)) !== -1 ? 1 : 0);
}

/** `a =~ b` : b se termine par a (port fidèle via inversion de chaines). */
export function op_endBy(val1: MdValue, val2: MdValue): MdValue {
  const g = String(val1.value).split('').reverse().join('');
  const d = String(val2.value).split('').reverse().join('');
  return nbr(d.indexOf(g) === 0 ? 1 : 0);
}

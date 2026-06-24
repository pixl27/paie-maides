/** Moteur d'expressions « maides » — API publique. */
export * from './value.js';
export * from './errors.js';
export * from './dates.js';
export * from './operators.js';
export * from './env.js';
export {
  standardFunctions, hasFunction, getFunction, registerFunction, unregisterFunction,
} from './functions.js';
export { MdExpression, type MdExpressionOptions } from './mdExpression.js';

import { MdExpression, type MdExpressionOptions } from './mdExpression.js';
import { retVal, type MdValue } from './value.js';

/**
 * Raccourci : évalue une expression et renvoie le jeton résultat.
 */
export function evaluer(expression: string, options?: MdExpressionOptions): MdValue {
  return new MdExpression(expression, options).calcul();
}

/**
 * Raccourci : évalue une expression et renvoie la valeur brute (retVal).
 */
export function evaluerValeur(expression: string, options?: MdExpressionOptions): any {
  return retVal(new MdExpression(expression, options).calcul());
}

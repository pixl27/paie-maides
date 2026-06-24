/** Erreurs du moteur d'expressions (port de mdExpression.php). */

/** Erreur critique et bloquante dans le solveur de formule. */
export class ExpCriticalException extends Error {
  code: number;
  constructor(message = '', code = 0) {
    super(`Erreur critique EXP-${code} : ${message}`);
    this.name = 'ExpCriticalException';
    this.code = code;
  }
}

/** Erreur non critique (avertissement) dans le solveur de formule. */
export class ExpWarningException extends Error {
  code: number;
  constructor(message = '', code = 0) {
    super(message);
    this.name = 'ExpWarningException';
    this.code = code;
  }
}

/**
 * Gestion des dates du langage d'expressions.
 *
 * Format interne littéral : `JJ-MM-AAAA`.
 * Format MySQL : `AAAA-MM-JJ`.
 *
 * NB de portage : le moteur PHP utilisait mktime()/time() (fuseau du serveur).
 * Ici tout est calculé en UTC pour être déterministe et indépendant du fuseau
 * (différence documentée et sans incidence sur les écarts de jours).
 */

const MS_PER_DAY = 86_400_000;
const SEC_PER_DAY = 86_400;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Détecte une date au format MySQL `AAAA-MM-JJ` dans une chaine. */
export function matchMysqlDate(s: string): { y: string; m: string; d: string } | null {
  const r = /(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return r ? { y: r[1]!, m: r[2]!, d: r[3]! } : null;
}

/** Détecte une date au format littéral `JJ-MM-AAAA`. */
export function matchLiteralDate(s: string): { d: string; m: string; y: string } | null {
  const r = /(\d{2})-(\d{2})-(\d{4})/.exec(String(s));
  return r ? { d: r[1]!, m: r[2]!, y: r[3]! } : null;
}

/** `AAAA-MM-JJ` -> `JJ-MM-AAAA`. */
export function mysqlToLiteral(s: string): string {
  const m = matchMysqlDate(s);
  return m ? `${m.d}-${m.m}-${m.y}` : s;
}

/** `JJ-MM-AAAA` -> `AAAA-MM-JJ`. */
export function literalToMysql(s: string): string {
  const m = matchLiteralDate(s);
  return m ? `${m.y}-${m.m}-${m.d}` : s;
}

/**
 * Nombre de jours depuis l'époque (01-01-1970) pour une date littérale `JJ-MM-AAAA`.
 * Port de fFunc_nbJour : utilise ceil(secondes/86400) ; les dates nulles valent 1970-01-01.
 */
export function nbJourFromLiteral(literal: string): number {
  let d: number, m: number, y: number;
  if (literal === '00-00-0000' || literal === '' || literal == null) {
    d = 1;
    m = 1;
    y = 1970;
  } else {
    const parsed = matchLiteralDate(literal);
    if (!parsed) {
      // tolérant comme l'original : composants extraits par position
      d = Number(literal.slice(0, 2)) || 1;
      m = Number(literal.slice(3, 5)) || 1;
      y = Number(literal.slice(6)) || 1970;
    } else {
      d = Number(parsed.d);
      m = Number(parsed.m);
      y = Number(parsed.y);
    }
  }
  const seconds = Date.UTC(y, m - 1, d) / 1000;
  return Math.ceil(seconds / SEC_PER_DAY);
}

/** Date littérale `JJ-MM-AAAA` à partir d'un nombre de jours depuis l'époque (port de fFunc_date(nbr)). */
export function literalFromDays(days: number): string {
  const date = new Date(days * MS_PER_DAY);
  return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}

/** Date littérale du jour courant (port de fFunc_date() sans argument). */
export function todayLiteral(): string {
  const now = new Date();
  return `${pad2(now.getUTCDate())}-${pad2(now.getUTCMonth() + 1)}-${now.getUTCFullYear()}`;
}

/** Nombre de jours écoulés depuis l'époque pour aujourd'hui (constante JOUR : floor). */
export function jourConstant(): number {
  return Math.floor(Date.now() / MS_PER_DAY);
}

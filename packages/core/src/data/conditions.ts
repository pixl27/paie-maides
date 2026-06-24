/**
 * Évaluateur de conditions de filtre (port de la sémantique WHERE utilisée par
 * les vues et les agrégats : PRS_parseDbCondition + clauses AND/OR).
 *
 * Grammaire simple : des comparaisons `gauche OP droite` reliées par `et`/`ou`
 * (ou `and`/`or`). OP ∈ = <> != <= >= < > ~~. Un opérande est un nom de champ
 * (résolu dans l'enregistrement), une chaine quotée, un nombre, ou un littéral.
 */

import { cmpElem } from './keys.js';

const OPERATEURS = ['<=', '>=', '<>', '!=', '~~', '=', '<', '>'];

function resoudOperande(token: string, rec: Record<string, any>): any {
  const t = token.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  if (Object.prototype.hasOwnProperty.call(rec, t)) return rec[t];
  return t; // littéral (nombre ou chaine nue)
}

function evalAtome(atome: string, rec: Record<string, any>): boolean {
  for (const op of OPERATEURS) {
    const idx = atome.indexOf(op);
    if (idx === -1) continue;
    // éviter de couper '<' dans '<=' / '<>' : on a trié OPERATEURS longueur d'abord
    const g = resoudOperande(atome.slice(0, idx), rec);
    const d = resoudOperande(atome.slice(idx + op.length), rec);
    const c = cmpElem(g, d);
    switch (op) {
      case '=': return c === 0;
      case '<>': case '!=': return c !== 0;
      case '<': return c < 0;
      case '<=': return c <= 0;
      case '>': return c > 0;
      case '>=': return c >= 0;
      case '~~': return String(g).includes(String(d));
    }
  }
  // pas d'opérateur : vrai si le champ/littéral est « vrai »
  const v = resoudOperande(atome, rec);
  return !(v === '' || v === '0' || v === 0 || v == null || v === false);
}

/** Évalue une condition (avec et/ou) contre un enregistrement. */
export function evalCondition(condition: string, rec: Record<string, any>): boolean {
  const cond = condition.trim();
  if (cond === '' || cond === '1') return true;
  // OU (précédence basse)
  const groupesOu = cond.split(/\s+(?:ou|or)\s+/i);
  return groupesOu.some((groupe) => {
    const atomes = groupe.split(/\s+(?:et|and)\s+/i);
    return atomes.every((a) => evalAtome(a, rec));
  });
}

/** Filtre une liste d'enregistrements selon une condition. */
export function filtrer(records: Record<string, any>[], condition: string): Record<string, any>[] {
  if (!condition || condition.trim() === '') return records;
  return records.filter((r) => evalCondition(condition, r));
}

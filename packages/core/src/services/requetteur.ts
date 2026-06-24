/**
 * Requetteur (port de gestionRequetteur.php) : résolution des requêtes nommées
 * `[nom]` (table 'requete', champ req_requete), substitution des variables `$x`,
 * et validation SQL défensive (REQ_valideSQL).
 *
 * L'EXÉCUTION est déléguée à un exécuteur injecté (le noyau ne lie aucun SGBD) :
 * le requetteur fournit la résolution + la validation, qui sont la partie
 * sensible et fidèlement portée.
 */

/** Source des requêtes nommées (table 'requete'). */
export interface RequeteStore {
  /** Corps SQL d'une requête nommée (null si absente). */
  charge(nom: string): string | null;
}

/** Exécuteur SQL injecté (pg, mysql, mémoire…). */
export type ExecuteurSQL = (sql: string) => Record<string, any>[];

// Liste complète des mots-clés interdits (port fidèle de REQ_valideSQL, gestionRequetteur.php)
// + `replace` en protection supplémentaire.
const MOTS_INTERDITS = /\b(insert|update|delete|rename|drop|create|truncate|alter|commit|rollback|merge|call|explain|lock|grant|revoke|savepoint|transaction|set|replace)\b/i;

export class Requetteur {
  constructor(private store?: RequeteStore, private executeur?: ExecuteurSQL) {}

  /**
   * Résout une requête : si `[nom]`, charge le corps depuis la table 'requete' ;
   * puis substitue les variables `$x` (port de PRS_valeurVariables, simplifié).
   */
  resoudre(requete: string, variables: Record<string, any> = {}): string {
    let sql = String(requete ?? '').trim();
    const m = /^\[(\w+)\]$/.exec(sql);
    if (m) {
      const corps = this.store?.charge(m[1]!);
      if (corps == null) throw new Error(`Requête nommée introuvable : ${m[1]}`);
      sql = corps.trim();
    }
    return sql.replace(/\$(\w+)/g, (_, k: string) =>
      Object.prototype.hasOwnProperty.call(variables, k) ? String(variables[k]) : `$${k}`);
  }

  /**
   * Validation SQL (port de REQ_valideSQL) : rejette les commentaires `--` ;
   * hors mode « trusted », exige un SELECT sans mot-clé d'écriture/DDL.
   */
  static valideSQL(sql: string, trusted = false): boolean {
    if (sql.includes('--')) return false;
    if (trusted) return true;
    const s = sql.trim().toLowerCase();
    if (!s.startsWith('select')) return false;
    return !MOTS_INTERDITS.test(s);
  }

  /** Résout, valide puis exécute une requête (REQ_executeRequete). */
  executeRequete(requete: string, variables: Record<string, any> = {}, trusted = false): Record<string, any>[] {
    const sql = this.resoudre(requete, variables);
    if (!Requetteur.valideSQL(sql, trusted)) throw new Error(`Requête SQL refusée : ${sql}`);
    if (!this.executeur) throw new Error('Requetteur : aucun exécuteur SQL configuré');
    return this.executeur(sql);
  }
}

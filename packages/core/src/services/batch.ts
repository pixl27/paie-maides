/**
 * Exécution batch / console (port du pattern des scripts `commande_console`
 * du legacy : do_prelevements, do_renouvellement, do_masseMailing…).
 *
 * Parcourt les enregistrements d'une table et applique un traitement. Le
 * traitement dispose d'aides : évaluer une expression sur l'enregistrement et
 * sauvegarder l'enregistrement modifié.
 */

import { R4 } from '../r4/r4.js';
import { r4Providers } from '../r4/expression-provider.js';
import { MdExpression } from '../expression/mdExpression.js';
import { retVal } from '../expression/value.js';
import { UserInfo } from '../expression/env.js';

export interface BatchAides {
  /** Évalue une expression avec l'enregistrement comme variables. */
  evaluer(expression: string): any;
  /** Sauvegarde l'enregistrement (dans sa couche). */
  sauver(record: Record<string, any>): void;
}

export type BatchTraitement = (record: Record<string, any>, aides: BatchAides) => void | { message?: string };

export interface BatchResultat {
  total: number;
  traites: number;
  erreurs: { cle?: string; message: string }[];
  messages: string[];
}

export interface BatchOptions {
  user?: UserInfo;
  /** Filtre simple `champ=valeur` ou prédicat. */
  filtre?: string | ((record: Record<string, any>) => boolean);
}

export class BatchRunner {
  private user: UserInfo;
  constructor(private r4: R4, options: BatchOptions = {}) {
    this.user = options.user ?? { login: 'batch', superAdmin: true, niveau: 0 };
  }

  /** Exécute un traitement sur tous les enregistrements d'une table. */
  run(table: string, traitement: BatchTraitement, options: BatchOptions = {}): BatchResultat {
    const store = this.r4.dataLayer();
    if (!store) throw new Error('BatchRunner : couche data indisponible');

    let records = store.listAll(table);
    if (options.filtre) records = records.filter(predicat(options.filtre));

    const res: BatchResultat = { total: records.length, traites: 0, erreurs: [], messages: [] };
    const providers = r4Providers(this.r4);

    for (const record of records) {
      const aides: BatchAides = {
        evaluer: (expr) => retVal(new MdExpression(expr, { variables: record, providers, user: this.user, isConsole: true }).calcul()),
        sauver: (rec) => this.r4.save(table, rec),
      };
      try {
        const r = traitement(record, aides);
        res.traites++;
        if (r?.message) res.messages.push(r.message);
      } catch (e: any) {
        res.erreurs.push({ message: e?.message ?? String(e) });
      }
    }
    return res;
  }
}

function predicat(filtre: string | ((r: Record<string, any>) => boolean)): (r: Record<string, any>) => boolean {
  if (typeof filtre === 'function') return filtre;
  const m = /^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(filtre);
  if (!m) return () => true;
  const [, champ, valeur] = m;
  const v = valeur!.replace(/^['"]|['"]$/g, '');
  return (r) => String(r[champ!]) === v;
}

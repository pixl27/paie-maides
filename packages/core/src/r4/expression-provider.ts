/**
 * Pont entre les couches R4 et le moteur d'expressions : expose un R4 sous la
 * forme des fournisseurs (ParamProvider / DataProvider) attendus par MdExpression,
 * de sorte que `[formule]`, `table()`, `requete()`, `aggregate()`, etc. fonctionnent.
 */

import { ParamProvider, DataProvider, Providers } from '../expression/env.js';
import { R4 } from './r4.js';

export function r4ParamProvider(r4: R4): ParamProvider {
  return {
    loadFormula: (name) => r4.loadFormula(name),
    table: (name, key) => r4.table(name, key),
    tableInf: (name, key) => r4.tableInf(name, key),
    tableSup: (name, key) => r4.tableSup(name, key),
    indice: () => false,
  };
}

export function r4DataProvider(r4: R4): DataProvider {
  return {
    aggregate: (op, table, champ, filtre, fusion) => r4.aggregate(op, table, champ, filtre, fusion),
    query: (named, vars) => {
      const store = r4.dataLayer();
      if (!store?.query) throw new Error('requete(): aucune requête nommée disponible');
      return store.query(named, vars);
    },
    loadRecord: (table, key) => r4.loadRecord(table, key),
    documentExists: (patron, key) => r4.documentExists(patron, key),
  };
}

/** Construit l'ensemble des fournisseurs d'expression à partir d'un R4. */
export function r4Providers(r4: R4): Providers {
  return {
    params: r4ParamProvider(r4),
    data: r4DataProvider(r4),
  };
}

/**
 * Exécution des vues (port de la sémantique de o_genererVue.php : vue mono-table
 * filtrée par OR, ou multi-table en UNION ALL). Chaque ligne de la vue produit
 * des enregistrements d'une table source, avec les colonnes système calculées
 * (_id, _key, _type_doc, __tag__).
 *
 * NB : l'original générait des VUES SQL ; ici on EXÉCUTE la définition de vue
 * directement sur les enregistrements (modèle document JSONB / mémoire).
 */

import { keyPaddee } from './keys.js';
import { evalCondition } from './conditions.js';

/** Une ligne de définition de vue : une table source, sa clé et ses conditions. */
export interface VueLigne {
  /** Patron (table) source. */
  patron: string;
  /** Spécification de clé (champs pointés), ex. "con_1.con_2.con_3". */
  cle: string;
  /** Clé pour le _id (par défaut = cle). */
  clePatron?: string;
  /** Conditions WHERE (reliées par AND ; chacune peut contenir et/ou). */
  conditions?: string[];
}

/** Définition d'une vue. */
export interface VueDef {
  nom_vue: string;
  lignes: VueLigne[];
  /** Champs sélectionnés (sinon tous). */
  champs?: string[] | false;
}

/** Calcule la colonne système _id : "table.val1.val2". */
function genereId(nomTable: string, cleSpec: string, rec: Record<string, any>): string {
  const frags = cleSpec.split('.').map((c) => String(rec[c] ?? ''));
  return `${nomTable}.${frags.join('.')}`;
}

/** Calcule la colonne système _key (chaque élément paddé à gauche). */
function genereKey(cleSpec: string, rec: Record<string, any>): string {
  const frags = cleSpec.split('.').map((c) => String(rec[c] ?? ''));
  return keyPaddee(frags);
}

/**
 * Exécute une vue : renvoie les enregistrements combinés de toutes ses lignes.
 * @param getRecords fournit les enregistrements d'une table source.
 */
export function executeVue(
  vue: VueDef,
  getRecords: (nomTable: string) => Record<string, any>[],
): Record<string, any>[] {
  const resultat: Record<string, any>[] = [];

  vue.lignes.forEach((ligne, posLigne) => {
    const clePatron = ligne.clePatron ?? ligne.cle;
    let rows = getRecords(ligne.patron);

    // conditions de la ligne (reliées par AND)
    if (ligne.conditions && ligne.conditions.length > 0) {
      rows = rows.filter((rec) => ligne.conditions!.every((cond) => evalCondition(cond, rec)));
    }

    for (const rec of rows) {
      const base: Record<string, any> = Array.isArray(vue.champs)
        ? Object.fromEntries(vue.champs.map((c) => [c, rec[c] ?? '']))
        : { ...rec };
      base['_id'] = genereId(ligne.patron, clePatron, rec);
      base['_key'] = genereKey(ligne.cle, rec);
      base['_type_doc'] = ligne.patron;
      base['__tag__'] = posLigne;
      resultat.push(base);
    }
  });

  // tri par _key (ordre séquentiel, comme une vue triée)
  resultat.sort((a, b) => (a['_key'] < b['_key'] ? -1 : a['_key'] > b['_key'] ? 1 : 0));
  return resultat;
}

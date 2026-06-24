/**
 * Outil d'import / migration (port des outils tools/import_*.php).
 *
 * Importe des définitions (patrons + champs) et des documents dans une couche.
 * Fournit un mapper depuis le format legacy (lignes MySQL `patrons` /
 * `patrons_champs`, documents CouchDB) vers le métamodèle moderne. C'est l'outil
 * qui permettra de rejouer une application existante (ex. assurance) à partir
 * d'un export de sa base.
 */

import { Champ, Relation, TypeChamp, creerPatron, keyFromRecord } from '../metamodel/index.js';
import { LayerStore } from '../r4/layers.js';

/** Patron à importer (forme normalisée). */
export interface PatronImport {
  nom_table: string;
  emplacement?: 'D' | 'P';
  champs: Champ[];
  relations?: Relation[];
}

/** Document à importer (forme normalisée). */
export interface DocumentImport {
  type_doc: string;
  cle?: string[];
  data: Record<string, any>;
}

export interface Dump {
  patrons: PatronImport[];
  documents?: DocumentImport[];
}

export interface ResultatImport {
  patrons: number;
  documents: number;
}

/** Importe un dump normalisé dans une couche. */
export function importerDefinitions(store: LayerStore, dump: Dump): ResultatImport {
  if (!store.savePatron) throw new Error('import : la couche ne supporte pas savePatron.');
  let nbPatrons = 0;
  for (const p of dump.patrons) {
    store.savePatron(creerPatron(p.nom_table, p.champs, { emplacement: p.emplacement, relations: p.relations }));
    nbPatrons++;
  }
  let nbDocs = 0;
  for (const d of dump.documents ?? []) {
    importerDocument(store, d);
    nbDocs++;
  }
  return { patrons: nbPatrons, documents: nbDocs };
}

/** Importe un document, en calculant sa clé via le patron si elle n'est pas fournie. */
export function importerDocument(store: LayerStore, doc: DocumentImport): void {
  let cle = doc.cle;
  if (!cle) {
    const patron = store.loadPatron(doc.type_doc);
    cle = patron && patron.is_key.length ? keyFromRecord(patron, doc.data) : [String(doc.data['_id'] ?? '')];
  }
  if (store.saveWithKey) store.saveWithKey(doc.type_doc, cle, doc.data);
  else store.save(doc.type_doc, doc.data);
}

/* ------------------------------------------------------------------ */
/* Mappers depuis le format legacy                                     */
/* ------------------------------------------------------------------ */

/** Ligne legacy de la table `patrons`. */
export interface LignePatronLegacy {
  nom_table: string;
  emplacement?: string;
  [k: string]: any;
}

/** Ligne legacy de la table `patrons_champs`. */
export interface LigneChampLegacy {
  nom_table: string;
  nom_champ: string;
  type_champ?: string;
  val_def?: string;
  taille_tableau?: string | number;
  est_autoincrement?: string | number;
  est_cle?: string | number;
  ordre_cle?: string | number;
  [k: string]: any;
}

/**
 * Convertit des lignes MySQL `patrons` + `patrons_champs` en patrons normalisés.
 */
export function depuisLignesLegacy(patrons: LignePatronLegacy[], champs: LigneChampLegacy[]): PatronImport[] {
  const champsParTable = new Map<string, Champ[]>();
  for (const c of champs) {
    const champ: Champ = {
      nom_champ: c.nom_champ,
      type_champ: (c.type_champ || 'clop') as TypeChamp,
      val_def: c.val_def ?? '',
      taille_tableau: Number(c.taille_tableau) || 0,
      est_autoincrement: Number(c.est_autoincrement) || 0,
    };
    if (Number(c.est_cle)) { champ.est_cle = 1; champ.ordre_cle = Number(c.ordre_cle) || 0; }
    if (!champsParTable.has(c.nom_table)) champsParTable.set(c.nom_table, []);
    champsParTable.get(c.nom_table)!.push(champ);
  }
  return patrons.map((p) => ({
    nom_table: p.nom_table,
    emplacement: p.emplacement === 'P' ? 'P' : 'D',
    champs: champsParTable.get(p.nom_table) ?? [],
  }));
}

/**
 * Convertit des documents CouchDB (objets JSON) en documents normalisés pour un
 * type donné. La clé est calculée à l'import via le patron de la couche.
 */
export function documentsDepuisCouch(typeDoc: string, docs: Record<string, any>[]): DocumentImport[] {
  return docs.map((data) => ({ type_doc: typeDoc, data }));
}

/** Importe un export legacy complet (patrons MySQL + documents CouchDB par type). */
export function importerLegacy(
  store: LayerStore,
  legacy: {
    patrons: LignePatronLegacy[];
    champs: LigneChampLegacy[];
    documents?: { type_doc: string; docs: Record<string, any>[] }[];
  },
): ResultatImport {
  const patronsImport = depuisLignesLegacy(legacy.patrons, legacy.champs);
  const res = importerDefinitions(store, { patrons: patronsImport });
  for (const groupe of legacy.documents ?? []) {
    for (const doc of documentsDepuisCouch(groupe.type_doc, groupe.docs)) {
      importerDocument(store, doc);
      res.documents++;
    }
  }
  return res;
}

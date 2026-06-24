/**
 * Résolveur R4 : effectue les recherches en cascade sur les couches de
 * paramétrage (port des fonctions R4_chargePatron / R4_chargeEcran / R4_search /
 * R4_chargeVue et de l'accès aux formules et tables de paramètres).
 */

import { Patron } from '../metamodel/types.js';
import { cleToString, keyFromRecord } from '../metamodel/record.js';
import {
  LayerId, LayerStore, LAYER_LEVEL, R4_NIVEAU_DEFAUT, R4_NIVEAU_PARAMS_MAX,
  retourneListeConnLevel,
} from './layers.js';
import { cleDeRecord } from '../data/keys.js';
import { agrege } from '../data/aggregate.js';
import { up as navUp, down as navDown, find as navFind, findLight as navFindLight, type FindOptions } from '../data/navigation.js';
import { prochaineCle as seqProchaineCle, prochaineCleMinimale as seqProchaineCleMinimale } from '../data/sequences.js';
import { executeVue, type VueDef } from '../data/views.js';

export interface R4Options {
  /** Niveau de départ pour la résolution des paramètres (défaut 4, borné à 4). */
  niveauParametres?: number;
}

export interface SearchResult {
  record: Record<string, any>;
  layer: LayerId;
}

export class R4 {
  private layers: Map<LayerId, LayerStore>;
  readonly niveauParametres: number;

  constructor(layers: Partial<Record<LayerId, LayerStore>>, options: R4Options = {}) {
    this.layers = new Map(Object.entries(layers) as [LayerId, LayerStore][]);
    this.niveauParametres = Math.min(options.niveauParametres ?? R4_NIVEAU_PARAMS_MAX, R4_NIVEAU_PARAMS_MAX);
  }

  /** Couche pour un identifiant donné (ou undefined). */
  layer(id: LayerId): LayerStore | undefined {
    return this.layers.get(id);
  }

  /** Couche de données d'exploitation. */
  dataLayer(): LayerStore | undefined {
    return this.layers.get('data');
  }

  /** Liste des couches configurées du niveau `start` vers 1. */
  private cascade(start: number): { id: LayerId; store: LayerStore }[] {
    const result: { id: LayerId; store: LayerStore }[] = [];
    for (const id of retourneListeConnLevel(start)) {
      const store = this.layers.get(id);
      if (store) result.push({ id, store });
    }
    return result;
  }

  /** Charge un patron en cascade (port de R4_chargePatron). */
  chargePatron(nomTable: string, start = R4_NIVEAU_DEFAUT): Patron | null {
    for (const { store } of this.cascade(start)) {
      const patron = store.loadPatron(nomTable);
      if (patron) return patron;
    }
    return null;
  }

  /** Recherche un enregistrement en cascade (port de R4_search). */
  search(nomTable: string, cle: string[], start = R4_NIVEAU_DEFAUT): SearchResult | null {
    for (const { id, store } of this.cascade(start)) {
      const record = store.search(nomTable, cle);
      if (record !== null) return { record, layer: id };
    }
    return null;
  }

  /** Charge un écran (ou une lettre) en cascade (port de R4_chargeEcran). */
  chargeEcran(nomEcran: string, patronRecherche: 'scr' | 'let' = 'scr', start = this.niveauParametres): Record<string, any> | null {
    const r = this.search(patronRecherche, [nomEcran], start);
    return r ? r.record : null;
  }

  /** Charge une vue en cascade (port de R4_chargeVue). */
  chargeVue(nomVue: string, start = this.niveauParametres): Record<string, any> | null {
    const r = this.search('vue', [nomVue], start);
    return r ? r.record : null;
  }

  /** Corps d'une formule nommée (table 'frm', champ pf03). */
  loadFormula(nomFormule: string): string | null {
    const r = this.search('frm', [nomFormule], this.niveauParametres);
    if (!r) return null;
    return r.record['pf03'] ?? null;
  }

  /** Recherche stricte dans une table de paramètres (table 'tab', champ tab3). */
  table(nomTable: string, cle: string): string | number | null {
    const r = this.search('tab', [nomTable, cle], this.niveauParametres);
    if (!r) return null;
    return r.record['tab3'] ?? null;
  }

  /** Table de paramètres : valeur inférieure la plus proche (port de tableInf). */
  tableInf(nomTable: string, cle: string): string | number | null {
    return this.tableProche(nomTable, cle, 'inf');
  }

  /** Table de paramètres : valeur supérieure la plus proche (port de tableSup). */
  tableSup(nomTable: string, cle: string): string | number | null {
    return this.tableProche(nomTable, cle, 'sup');
  }

  private tableProche(nomTable: string, cle: string, sens: 'inf' | 'sup'): string | number | null {
    for (const { store } of this.cascade(this.niveauParametres)) {
      const rows = store.listAll('tab').filter((r) => String(r['tab1']) === nomTable);
      const candidats = rows
        .filter((r) => (sens === 'inf' ? cmpKey(r['tab2'], cle) <= 0 : cmpKey(r['tab2'], cle) >= 0))
        .sort((a, b) => (sens === 'inf' ? cmpKey(b['tab2'], a['tab2']) : cmpKey(a['tab2'], b['tab2'])));
      if (candidats.length > 0) {
        return candidats[0]!['tab3'] ?? null;
      }
    }
    return null;
  }

  /** Charge un enregistrement de production par table + clé chaine (port partiel de chargeEnregistrement). */
  loadRecord(nomTable: string, cleChaine: string): Record<string, any> | null {
    const r = this.search(nomTable, cleChaine.split('.'), R4_NIVEAU_DEFAUT);
    return r ? r.record : null;
  }

  /** Vrai si un document existe (port de documentExiste). */
  documentExists(nomTable: string, cleChaine: string): boolean {
    return this.loadRecord(nomTable, cleChaine) !== null;
  }

  /** Sauvegarde un enregistrement dans la couche appropriée (data si emplacement 'D'). */
  save(nomTable: string, record: Record<string, any>): void {
    const patron = this.chargePatron(nomTable);
    const layerId: LayerId = patron?.emplacement === 'P' ? 'paramR4' : 'data';
    const store = this.layers.get(layerId) ?? this.dataLayer();
    if (!store) throw new Error(`R4.save: aucune couche disponible pour ${nomTable}`);
    // On dispose du patron résolu : on calcule la clé et on persiste par clé,
    // car la couche cible (ex. data) ne connaît pas forcément ce patron.
    if (patron && patron.is_key.length > 0 && store.saveWithKey) {
      store.saveWithKey(nomTable, keyFromRecord(patron, record), record);
    } else {
      store.save(nomTable, record);
    }
  }

  /**
   * Agrégat (port de DB_aggregate) : SOMME/COMPTE/COMPTEUNIQUE/MAX/MIN/MOYENNE,
   * filtre composite (et/ou). `fusion` agrège sur toutes les couches (paramètres).
   */
  aggregate(op: string, nomTable: string, champ: string, filtre: string, fusion = false): number {
    const rows = fusion ? this.listAllFusion(nomTable) : this.recordsDe(nomTable);
    return agrege(rows, op, champ, filtre);
  }

  /* ------------------------------------------------------------------ */
  /* Enregistrements : résolution couche, fusion multi-niveaux           */
  /* ------------------------------------------------------------------ */

  /** Enregistrements d'une table : couche data (D), fusion paramètres (P) ou exécution de vue. */
  recordsDe(nomTable: string): Record<string, any>[] {
    const patron = this.chargePatron(nomTable);
    if (patron?.emplacement === 'P') return this.listAllFusion(nomTable);
    if (!patron && this.chargeVue(nomTable)) return this.executeVueParNom(nomTable); // c'est une vue
    const store = this.dataLayer();
    return store ? store.listAll(nomTable) : [];
  }

  /**
   * Emplacement d'une table (port de R4_getEmplacement) : 'P' (paramètres) /
   * 'D' (données). Repli : une vue est traitée comme 'D'. null si inconnue.
   */
  getEmplacement(nomTable: string): 'P' | 'D' | null {
    const patron = this.chargePatron(nomTable);
    if (patron) return patron.emplacement === 'P' ? 'P' : 'D';
    if (this.chargeVue(nomTable)) return 'D';
    return null;
  }

  /**
   * Fusion des enregistrements sur toutes les couches du niveau paramètres vers 1
   * (port de R4_executeRequeteFusion) : « le plus spécifique gagne » (dédup par clé).
   */
  listAllFusion(nomTable: string): Record<string, any>[] {
    const patron = this.chargePatron(nomTable);
    const parCle = new Map<string, Record<string, any>>();
    // du plus général (1) vers le plus spécifique : le spécifique écrase
    const cascade = [...this.cascade(this.niveauParametres)].reverse();
    for (const { store } of cascade) {
      for (const rec of store.listAll(nomTable)) {
        const cle = patron ? cleDeRecord(patron, rec) : [String(rec['_id'] ?? JSON.stringify(rec))];
        parCle.set(cle.join(''), rec);
      }
    }
    return [...parCle.values()];
  }

  /* ------------------------------------------------------------------ */
  /* Séquences / compteurs                                                */
  /* ------------------------------------------------------------------ */

  /** Prochaine clé disponible d'une table (port de prochaineCle). */
  prochaineCle(nomTable: string): string[] {
    const patron = this.chargePatron(nomTable);
    if (!patron) throw new Error(`prochaineCle: patron ${nomTable} introuvable`);
    return seqProchaineCle(this.recordsDe(nomTable), patron);
  }

  /** Première valeur entière libre d'un champ, bornée (port de prochaineCleMinimale). */
  prochaineCleMinimale(nomTable: string, champ: string, borneMin: number | false = false, borneMax: number | false = false): number | null {
    return seqProchaineCleMinimale(this.recordsDe(nomTable), champ, borneMin, borneMax);
  }

  /**
   * Insère un enregistrement en générant la valeur d'un champ-clé auto-incrémenté
   * (port du AUTO_INCREMENT). Renvoie la clé attribuée.
   */
  insert(nomTable: string, record: Record<string, any>): string[] {
    const patron = this.chargePatron(nomTable);
    if (patron) {
      const dernier = patron.is_key[patron.is_key.length - 1];
      const champCle = dernier ? patron.champs[dernier] : undefined;
      const estAuto = champCle?.est_autoincrement === 1
        || (dernier !== undefined && (record[dernier] === '' || record[dernier] === undefined || record[dernier] === null));
      if (dernier && champCle?.est_autoincrement === 1 && estAuto) {
        const cle = seqProchaineCle(this.recordsDe(nomTable), patron);
        record[dernier] = cle[cle.length - 1];
      }
    }
    this.save(nomTable, record);
    return patron ? keyFromRecord(patron, record) : [];
  }

  /* ------------------------------------------------------------------ */
  /* Navigation séquentielle                                             */
  /* ------------------------------------------------------------------ */

  /** Enregistrement précédent (port de up). */
  up(nomTable: string, cle: string[] | null): Record<string, any> | null {
    const patron = this.chargePatron(nomTable);
    if (!patron) return null;
    return navUp(this.recordsDe(nomTable), patron, cle);
  }

  /** Enregistrement suivant (port de down). */
  down(nomTable: string, cle: string[] | null): Record<string, any> | null {
    const patron = this.chargePatron(nomTable);
    if (!patron) return null;
    return navDown(this.recordsDe(nomTable), patron, cle);
  }

  /** Recherche par préfixe de clé (port de findLight). */
  findLight(nomTable: string, prefixe: string[], nbMax = 0): Record<string, any>[] {
    const patron = this.chargePatron(nomTable);
    if (!patron) return [];
    return navFindLight(this.recordsDe(nomTable), patron, prefixe, nbMax);
  }

  /** Recherche par plage (port de find). */
  find(nomTable: string, debut: string[], fin: string[], options: FindOptions = {}): Record<string, any>[] {
    const patron = this.chargePatron(nomTable);
    if (!patron) return [];
    return navFind(this.recordsDe(nomTable), patron, debut, fin, options);
  }

  /* ------------------------------------------------------------------ */
  /* Vues                                                                */
  /* ------------------------------------------------------------------ */

  /** Exécute une définition de vue sur les données (port de o_genererVue + lecture de vue). */
  executeVue(vue: VueDef): Record<string, any>[] {
    return executeVue(vue, (table) => this.recordsDe(table));
  }

  /** Charge une vue par son nom (table 'vue') et l'exécute. */
  executeVueParNom(nomVue: string): Record<string, any>[] {
    const rec = this.chargeVue(nomVue);
    if (!rec) return [];
    const def: VueDef = { nom_vue: nomVue, lignes: rec['lignes'] ?? [], champs: rec['champs'] ?? false };
    return this.executeVue(def);
  }
}

/** Comparaison de clés : numérique si possible, sinon lexicographique. */
function cmpKey(a: any, b: any): number {
  const na = Number(a); const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export { LAYER_LEVEL, cleToString };

/**
 * Éditeurs de paramétrage du constructeur (le cœur « low-code ») :
 *  - MenuEditor       (table 'menu', port de mdMenu + écran de menu)
 *  - DroitEditor      (table 'drt', port de pDroitTable : table × champ × 9 groupes)
 *  - FormuleEditor    (table 'frm', formules nommées, champ pf03)
 *  - TableParamEditor (table 'tab', paramètres clé/valeur tab1/tab2/tab3)
 *  - VueEditor        (table 'vue', définitions de vues)
 *  - SequenceEcranEditor (table 'sq_ecran', séquences d'écrans)
 *  - RelationEditor   (relations portées par les patrons)
 *
 * Tous persistent dans une couche (LayerStore). Ce sont les briques sur
 * lesquelles s'appuie le designer visuel web.
 */

import { LayerStore } from '../r4/layers.js';
import { Patron, Relation } from '../metamodel/types.js';
import { MenuEntry } from '../menu/menu.js';
import { VueDef } from '../data/views.js';

/** Sauvegarde un enregistrement avec clé explicite (robuste même sans patron défini). */
function sauve(store: LayerStore, table: string, cle: string[], rec: Record<string, any>): void {
  if (store.saveWithKey) store.saveWithKey(table, cle, rec);
  else store.save(table, rec);
}

/* ============================ Menus ============================ */

export class MenuEditor {
  constructor(private store: LayerStore) {}

  /** Ajoute ou remplace une entrée de menu (clé = menu_position). */
  definitEntree(entree: MenuEntry): void {
    sauve(this.store, 'menu', [entree.menu_position], { ...entree });
  }

  supprimeEntree(position: string): boolean {
    return this.store.delete('menu', [position]);
  }

  liste(): MenuEntry[] {
    return this.store.listAll('menu')
      .map((r) => ({
        menu_position: String(r['menu_position']),
        menu_libelle: String(r['menu_libelle'] ?? ''),
        menu_script: r['menu_script'],
        menu_droit: r['menu_droit'] !== undefined ? Number(r['menu_droit']) : undefined,
      }))
      .sort((a, b) => a.menu_position.localeCompare(b.menu_position));
  }
}

/* ============================ Droits champ ============================ */

export type ValeurDroit = 'C' | 'N' | 'L' | 'P' | '';

export class DroitEditor {
  constructor(private store: LayerStore) {}

  private cle(table: string, champ: string): string[] { return [table, champ]; }

  /** Définit le droit d'un champ pour un groupe (niveau 1..9). */
  definitDroit(table: string, champ: string, niveau: number, valeur: ValeurDroit): void {
    if (niveau < 1 || niveau > 9) throw new Error('DroitEditor: niveau hors [1,9]');
    const existant = this.store.search('drt', this.cle(table, champ)) ?? { drt_table: table, drt_champ: champ };
    existant[`drt_grp_${niveau}`] = valeur;
    sauve(this.store, 'drt', this.cle(table, champ), existant);
  }

  /** Droit effectif d'un champ pour un niveau ('' => 'C' par défaut, comme l'original). */
  getDroit(table: string, champ: string, niveau: number): ValeurDroit {
    const rec = this.store.search('drt', this.cle(table, champ));
    const v = rec?.[`drt_grp_${niveau}`];
    return (v === undefined || v === '') ? 'C' : (v as ValeurDroit);
  }

  /** Grille des droits d'une table : { champ: { niveau: valeur } }. */
  grille(table: string): Record<string, Record<number, ValeurDroit>> {
    const out: Record<string, Record<number, ValeurDroit>> = {};
    for (const rec of this.store.listAll('drt')) {
      if (String(rec['drt_table']) !== table) continue;
      const champ = String(rec['drt_champ']);
      out[champ] = {};
      for (let n = 1; n <= 9; n++) out[champ]![n] = (rec[`drt_grp_${n}`] ?? '') as ValeurDroit;
    }
    return out;
  }
}

/* ============================ Formules nommées ============================ */

export class FormuleEditor {
  constructor(private store: LayerStore) {}

  /** Définit une formule nommée (corps stocké dans pf03, comme R4.loadFormula). */
  definitFormule(nom: string, corps: string): void {
    sauve(this.store, 'frm', [nom], { pf01: nom, pf03: corps });
  }

  getFormule(nom: string): string | null {
    const rec = this.store.search('frm', [nom]);
    return rec ? (rec['pf03'] ?? null) : null;
  }

  supprime(nom: string): boolean { return this.store.delete('frm', [nom]); }

  liste(): { nom: string; corps: string }[] {
    return this.store.listAll('frm').map((r) => ({ nom: String(r['pf01'] ?? ''), corps: String(r['pf03'] ?? '') }));
  }
}

/* ============================ Tables de paramètres ============================ */

export class TableParamEditor {
  constructor(private store: LayerStore) {}

  /** Définit une valeur de paramètre tab1=table, tab2=cle, tab3=valeur. */
  definit(table: string, cle: string, valeur: string | number): void {
    sauve(this.store, 'tab', [table, cle], { tab1: table, tab2: cle, tab3: valeur });
  }

  get(table: string, cle: string): string | number | null {
    const rec = this.store.search('tab', [table, cle]);
    return rec ? (rec['tab3'] ?? null) : null;
  }

  supprime(table: string, cle: string): boolean { return this.store.delete('tab', [table, cle]); }

  /** Liste les couples (cle, valeur) d'une table de paramètres, triés. */
  liste(table: string): { cle: string; valeur: any }[] {
    return this.store.listAll('tab')
      .filter((r) => String(r['tab1']) === table)
      .map((r) => ({ cle: String(r['tab2']), valeur: r['tab3'] }))
      .sort((a, b) => a.cle.localeCompare(b.cle));
  }
}

/* ============================ Vues ============================ */

export class VueEditor {
  constructor(private store: LayerStore) {}

  /** Définit une vue (clé = nom_vue). */
  definitVue(vue: VueDef): void {
    sauve(this.store, 'vue', [vue.nom_vue], { vueCle: vue.nom_vue, ...vue });
  }

  getVue(nom: string): VueDef | null {
    const rec = this.store.search('vue', [nom]);
    if (!rec) return null;
    return { nom_vue: nom, lignes: rec['lignes'] ?? [], champs: rec['champs'] ?? false };
  }

  supprime(nom: string): boolean { return this.store.delete('vue', [nom]); }

  liste(): string[] {
    return this.store.listAll('vue').map((r) => String(r['vueCle'] ?? r['nom_vue'] ?? '')).filter(Boolean).sort();
  }
}

/* ============================ Séquences d'écran ============================ */

export class SequenceEcranEditor {
  constructor(private store: LayerStore) {}

  /** Définit une séquence d'écrans (clé = nom). */
  definitSequence(nom: string, ecrans: string[]): void {
    sauve(this.store, 'sq_ecran', [nom], { sq_nom: nom, sq_ecrans: ecrans });
  }

  getSequence(nom: string): string[] {
    const rec = this.store.search('sq_ecran', [nom]);
    return rec ? (rec['sq_ecrans'] ?? []) : [];
  }

  /** Écran suivant / précédent dans une séquence. */
  voisin(nom: string, ecranCourant: string, sens: 'suivant' | 'precedent'): string | null {
    const seq = this.getSequence(nom);
    const i = seq.indexOf(ecranCourant);
    if (i === -1) return null;
    const j = sens === 'suivant' ? i + 1 : i - 1;
    return j >= 0 && j < seq.length ? seq[j]! : null;
  }

  supprime(nom: string): boolean { return this.store.delete('sq_ecran', [nom]); }

  /** Liste les séquences définies. */
  liste(): { nom: string; ecrans: string[] }[] {
    return this.store.listAll('sq_ecran')
      .map((r) => ({ nom: String(r['sq_nom'] ?? ''), ecrans: (r['sq_ecrans'] ?? []) as string[] }))
      .filter((s) => s.nom)
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }
}

/* ============================ Relations ============================ */

export class RelationEditor {
  constructor(private store: LayerStore) {
    if (!store.savePatron) throw new Error('RelationEditor: la couche ne persiste pas les patrons.');
  }

  private getPatron(nomTable: string): Patron {
    const p = this.store.loadPatron(nomTable);
    if (!p) throw new Error(`Patron ${nomTable} introuvable.`);
    return p;
  }

  /** Ajoute (ou remplace) une relation sur un patron. */
  ajouteRelation(nomTable: string, relation: Relation): void {
    const patron = this.getPatron(nomTable);
    const relations = (patron.relations ?? []).filter((r) => r.nom !== relation.nom);
    relations.push(relation);
    this.store.savePatron!({ ...patron, relations });
  }

  supprimeRelation(nomTable: string, nomRelation: string): void {
    const patron = this.getPatron(nomTable);
    const relations = (patron.relations ?? []).filter((r) => r.nom !== nomRelation);
    this.store.savePatron!({ ...patron, relations });
  }

  liste(nomTable: string): Relation[] {
    return this.getPatron(nomTable).relations ?? [];
  }
}

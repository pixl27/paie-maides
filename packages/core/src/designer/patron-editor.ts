/**
 * Éditeur de structures de données (port du cœur fonctionnel de pStructure.php).
 *
 * Crée et modifie des `patrons` (tables) et leurs `champs` programmatiquement,
 * en les persistant dans une couche. C'est la brique sur laquelle un designer
 * visuel (lui-même un écran maides) viendra s'appuyer.
 */

import { Champ, Patron, creerPatron } from '../metamodel/types.js';
import { LayerStore } from '../r4/layers.js';

export class PatronEditor {
  constructor(private store: LayerStore) {
    if (!store.savePatron) {
      throw new Error('PatronEditor : la couche ne supporte pas la persistance de patrons (savePatron).');
    }
  }

  /** Recalcule is_key (ordonné) et champsTableau d'un patron. */
  private recompose(patron: Patron): Patron {
    return creerPatron(patron.nom_table, Object.values(patron.champs), {
      emplacement: patron.emplacement,
      est_vue: patron.est_vue,
    });
  }

  /** Crée une table (port de pstr_creerTable / NouvelleTable). */
  creerTable(nomTable: string, options: { emplacement?: 'D' | 'P' } = {}): Patron {
    if (this.store.loadPatron(nomTable)) {
      throw new Error(`Le patron ${nomTable} existe déjà.`);
    }
    const patron = creerPatron(nomTable, [], { emplacement: options.emplacement ?? 'D' });
    this.store.savePatron!(patron);
    return patron;
  }

  /** Récupère un patron. */
  getPatron(nomTable: string): Patron {
    const p = this.store.loadPatron(nomTable);
    if (!p) throw new Error(`Patron ${nomTable} introuvable.`);
    return p;
  }

  /** Ajoute (ou remplace) un champ (port de pstr_majTable côté champ). */
  ajouteChamp(nomTable: string, champ: Champ): Patron {
    const patron = this.getPatron(nomTable);
    patron.champs[champ.nom_champ] = { ...champ, type_champ: champ.type_champ ?? 'clop' };
    const maj = this.recompose(patron);
    this.store.savePatron!(maj);
    return maj;
  }

  /** Modifie un champ existant. */
  modifieChamp(nomTable: string, nomChamp: string, patch: Partial<Champ>): Patron {
    const patron = this.getPatron(nomTable);
    if (!patron.champs[nomChamp]) throw new Error(`Champ ${nomChamp} inconnu dans ${nomTable}.`);
    patron.champs[nomChamp] = { ...patron.champs[nomChamp], ...patch } as Champ;
    const maj = this.recompose(patron);
    this.store.savePatron!(maj);
    return maj;
  }

  /** Supprime un champ. */
  supprimeChamp(nomTable: string, nomChamp: string): Patron {
    const patron = this.getPatron(nomTable);
    delete patron.champs[nomChamp];
    const maj = this.recompose(patron);
    this.store.savePatron!(maj);
    return maj;
  }

  /** Définit la clé : marque est_cle/ordre_cle selon l'ordre fourni. */
  definitCle(nomTable: string, nomsChamps: string[]): Patron {
    const patron = this.getPatron(nomTable);
    for (const champ of Object.values(patron.champs)) {
      delete champ.est_cle;
      delete champ.ordre_cle;
    }
    nomsChamps.forEach((nom, i) => {
      const champ = patron.champs[nom];
      if (!champ) throw new Error(`Champ clé ${nom} inconnu dans ${nomTable}.`);
      champ.est_cle = 1;
      champ.ordre_cle = i + 1;
    });
    const maj = this.recompose(patron);
    this.store.savePatron!(maj);
    return maj;
  }

  /** Duplique une table (port de pstr clone). */
  cloneTable(source: string, cible: string): Patron {
    const src = this.getPatron(source);
    if (this.store.loadPatron(cible)) throw new Error(`Le patron ${cible} existe déjà.`);
    const copie = creerPatron(cible, Object.values(structuredClone(src.champs)), {
      emplacement: src.emplacement,
      est_vue: src.est_vue,
    });
    this.store.savePatron!(copie);
    return copie;
  }

  /** Supprime une table (port de pstr_supprimeTable). */
  supprimeTable(nomTable: string): boolean {
    return this.store.deletePatron ? this.store.deletePatron(nomTable) : false;
  }
}

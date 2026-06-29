/**
 * Application de COMPTABILITÉ (en partie double) reconstruite EN LOW-CODE avec le
 * constructeur Maxima (ex-maides). Tout est PARAMÉTRÉ DANS LES DONNÉES :
 *  - tables (jal, cpt, trs, ecr, lig, res, fac, reg) via PatronEditor → `tables.ts` ;
 *  - écrans + listes via EcranEditor → `ecrans/*` (un fichier par domaine) ;
 *  - LES TOTAUX sont exprimés EN FORMULES nommées (`frm`) → `formules.ts`, qui
 *    AGRÈGENT les lignes (`aggregate`) — équilibre d'une écriture, solde d'un
 *    compte, résultat (produits − charges), bilan, TVA, facturation.
 *
 * Cette `index.ts` ne fait qu'ORCHESTRER ces modules dans l'ordre attendu (tables →
 * paramètres → formules → écrans → données d'exemple). Comptabilité = pièces
 * (écritures) composées de lignes débit/crédit imputées à des comptes du plan
 * comptable ; une écriture est équilibrée si Σ débit = Σ crédit ; le solde d'un
 * compte = Σ débit − Σ crédit de ses lignes. Tout est recalculé à l'affichage.
 */

import { join } from 'node:path';
import {
  R4, MemoryLayerStore, creerPatron,
  PatronEditor, EcranEditor, TableParamEditor, FormuleEditor,
  type MenuEntry,
} from '@maides/core';
import { FileLayerStore } from '../file-store.js';
import { menusCompta } from './menu.js';
import { definitTables } from './tables.js';
import { definitFormules } from './formules.js';
import { definitEcrans } from './ecrans/index.js';
import { seedDonnees } from './seed.js';

/**
 * Construit l'application de comptabilité. Si `dossier` est fourni, données et
 * paramétrage sont PERSISTÉS (JSON) et rechargés au démarrage ; sinon tout est en
 * mémoire (tests/démo). Le référentiel et les exemples ne sont créés qu'au PREMIER
 * lancement (ensuite on recharge le disque).
 */
export function construitCompta(dossier?: string): { r4: R4; params: MemoryLayerStore; menuEntries: MenuEntry[] } {
  const data: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'compta-data.json')) : new MemoryLayerStore();
  const params: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'compta-params.json')) : new MemoryLayerStore();
  if (!params.loadPatron('scr')) params.definePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));
  if (!params.loadPatron('let')) params.definePatron(creerPatron('let', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));

  const r4 = new R4({ data, paramR4: params });
  const menuEntries = menusCompta;

  // Déjà installé (relance avec persistance) ? on recharge sans rien reconstruire.
  if (data.loadPatron('lig')) return { r4, params, menuEntries };

  // 1) Tables de données.
  definitTables(new PatronEditor(data));
  // 2) Paramètres éditables au Designer (taux de TVA par défaut).
  new TableParamEditor(params).definit('tx', 'TVA', 20);
  // 3) Formules nommées (totaux, soldes, équilibre, bilan, TVA, facturation).
  definitFormules(new FormuleEditor(params));
  // 4) Écrans (fiches + listes) applicatifs (scr) + documents imprimables (let).
  definitEcrans(new EcranEditor(params, 'scr'), new EcranEditor(params, 'let'));
  // 5) Référentiel + exemples (1er lancement uniquement).
  seedDonnees(r4);

  return { r4, params, menuEntries };
}

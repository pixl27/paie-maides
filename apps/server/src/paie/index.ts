/**
 * Application de PAIE reconstruite EN LOW-CODE avec le constructeur maides-v2.
 *
 * Tout est PARAMÉTRÉ DANS MAIDES (aucune logique métier en TypeScript) :
 *  - tables (emp, sal, rub, bul) → `tables.ts` ;
 *  - barème + catalogue de cotisations → `bareme.ts` (seedé dans `rub`) ;
 *  - paramètres (PMSS, abattement CSG) via la table `tx` ;
 *  - LE CALCUL est exprimé EN FORMULES MAIDES nommées → `formules.ts` ;
 *  - écrans (saisie + bulletin imprimable) → `ecrans/*`.
 *
 * Cette `index.ts` ne fait qu'ORCHESTRER ces modules (tables → paramètres →
 * formules → écrans → droits → données d'exemple). Le bulletin est entièrement
 * dérivé de données + formules : modifier un taux, une rubrique, un paramètre ou
 * une formule change le résultat — sans toucher au code.
 */

import { join } from 'node:path';
import {
  R4, MemoryLayerStore, creerPatron,
  PatronEditor, EcranEditor, TableParamEditor, FormuleEditor,
  type MenuEntry,
} from '@maides/core';
import { FileLayerStore } from '../file-store.js';
import { menusPaie } from './menu.js';
import { TAUX } from './bareme.js';
import { definitTables } from './tables.js';
import { definitFormules } from './formules.js';
import { definitEcrans } from './ecrans/index.js';
import { definitDroits } from './droits.js';
import { seedDonnees } from './seed.js';

/**
 * Construit l'application de paie. Si `dossier` est fourni, les données et le
 * paramétrage sont PERSISTÉS sur disque (JSON) et rechargés au démarrage ; sinon
 * tout est en mémoire (tests/démo). Le paramétrage et les données d'exemple ne
 * sont créés qu'au PREMIER lancement (ensuite on recharge ce qui est sur disque).
 */
export function construitPaie(dossier?: string): { r4: R4; params: MemoryLayerStore; menuEntries: MenuEntry[] } {
  const data: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'paie-data.json')) : new MemoryLayerStore();
  const params: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'paie-params.json')) : new MemoryLayerStore();
  if (!params.loadPatron('scr')) params.definePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));
  if (!params.loadPatron('let')) params.definePatron(creerPatron('let', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));

  const r4 = new R4({ data, paramR4: params });
  const menuEntries = menusPaie;

  // Déjà installé (relance avec persistance) ? on recharge sans rien reconstruire.
  if (data.loadPatron('bul')) return { r4, params, menuEntries };

  // 1) Tables de données.
  definitTables(new PatronEditor(data));
  // 2) Paramètres globaux (éditables au Designer > Tables de paramètres).
  const tx = new TableParamEditor(params);
  tx.definit('tx', 'PMSS', TAUX.PMSS);
  tx.definit('tx', 'ABATT_CSG', TAUX.ABATT_CSG);
  // 3) Formules nommées (calcul complet du bulletin).
  definitFormules(new FormuleEditor(params));
  // 4) Écrans : applicatifs (scr) + bulletin imprimable (let).
  definitEcrans(new EcranEditor(params, 'scr'), new EcranEditor(params, 'let'));
  // 5) Droits spécifiques (coût employeur réservé aux niveaux privilégiés).
  definitDroits(data);
  // 6) Référentiel + exemples (1er lancement uniquement).
  seedDonnees(r4);

  return { r4, params, menuEntries };
}

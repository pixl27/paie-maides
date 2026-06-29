/**
 * Application d'ASSURANCE reconstruite EN LOW-CODE : tiers, quittance calculée
 * (prime nette → taxe → TTC → commission) et renouvellement bonus-malus (CRM).
 *
 * Tout est défini par DONNÉES via les éditeurs du constructeur (tables, écrans,
 * formules, tables de paramètres, droits), puis exécuté par le runtime générique.
 * Cette `index.ts` ne fait qu'ORCHESTRER les modules (tables → paramètres →
 * formules → écrans → droits → exemples). Application en mémoire (démo / lanceur).
 */
import {
  R4, MemoryLayerStore, creerPatron,
  PatronEditor, EcranEditor, TableParamEditor, FormuleEditor,
  type MenuEntry,
} from '@maides/core';
import { menusAssurance } from './menu.js';
import { definitTables } from './tables.js';
import { definitFormules } from './formules.js';
import { definitEcrans } from './ecrans/index.js';
import { definitDroits } from './droits.js';
import { seedDonnees } from './seed.js';

/** Construit l'application d'assurance (en mémoire) : données + paramétrage + menu. */
export function construitAssurance(): { r4: R4; params: MemoryLayerStore; menuEntries: MenuEntry[] } {
  const data = new MemoryLayerStore();
  const params = new MemoryLayerStore().definePatron(
    creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }),
  );

  // 1) Tables de données.
  definitTables(new PatronEditor(data));
  // 2) Paramètres : taux de taxe par branche (éditables au Designer).
  const tax = new TableParamEditor(params);
  tax.definit('tax', 'AUTO', 18);
  tax.definit('tax', 'MRH', 9);
  // 3) Formules nommées (prime nette, bonus-malus).
  definitFormules(new FormuleEditor(params));
  // 4) Écrans (un module par domaine).
  definitEcrans(new EcranEditor(params, 'scr'));
  // 5) Droits spécifiques (commission réservée aux niveaux privilégiés).
  definitDroits(data);

  const r4 = new R4({ data, paramR4: params });

  // 6) Données d'exemple (via le runtime générique).
  seedDonnees(r4);

  return { r4, params, menuEntries: menusAssurance };
}

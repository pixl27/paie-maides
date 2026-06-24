/**
 * Scaffold d'une nouvelle application (port de MODE_INSTALL + blueprints).
 *
 * Met en place les patrons « système » dont une application a besoin pour être
 * pilotable par les designers et le runtime : écrans (scr), lettres (let),
 * formules (frm), tables de paramètres (tab), menus (menu) et vues (vue).
 */

import { Champ, Patron, creerPatron } from '../metamodel/types.js';
import { LayerStore } from '../r4/layers.js';

function cle(nom: string, ordre = 1): Champ {
  return { nom_champ: nom, type_champ: 'string', est_cle: 1, ordre_cle: ordre };
}

/** Définitions des patrons système d'une application maides. */
export const PATRONS_SYSTEME: Patron[] = [
  creerPatron('scr', [cle('nom_ecran'), { nom_champ: 'table_liee', type_champ: 'string' }, { nom_champ: 'template', type_champ: 'clop' }, { nom_champ: 'niveauDroits', type_champ: 'integer' }], { emplacement: 'P' }),
  creerPatron('let', [cle('nom_ecran'), { nom_champ: 'table_liee', type_champ: 'string' }, { nom_champ: 'template', type_champ: 'clop' }], { emplacement: 'P' }),
  creerPatron('frm', [cle('pf01'), { nom_champ: 'pf02', type_champ: 'string' }, { nom_champ: 'pf03', type_champ: 'clop' }], { emplacement: 'P' }),
  creerPatron('tab', [cle('tab1', 1), cle('tab2', 2), { nom_champ: 'tab3', type_champ: 'string' }], { emplacement: 'P' }),
  creerPatron('menu', [cle('menu_position'), { nom_champ: 'menu_libelle', type_champ: 'string' }, { nom_champ: 'menu_script', type_champ: 'string' }, { nom_champ: 'menu_droit', type_champ: 'integer' }], { emplacement: 'P' }),
  creerPatron('vue', [cle('nom_vue'), { nom_champ: 'requete', type_champ: 'clop' }], { emplacement: 'P' }),
];

/** Installe les patrons système dans une couche de paramétrage. */
export function initialiserApplication(store: LayerStore): void {
  if (!store.savePatron) throw new Error('scaffold : la couche ne supporte pas savePatron.');
  for (const patron of PATRONS_SYSTEME) store.savePatron(patron);
}

/**
 * Crée une application de démarrage : patrons système + un écran d'accueil et une
 * entrée de menu, pour disposer immédiatement d'une appli pilotable.
 */
export function creerApplicationDeBase(store: LayerStore): void {
  initialiserApplication(store);
  store.save('scr', { nom_ecran: 'accueil', table_liee: '', template: '<h2>Bienvenue</h2>', champs: {} });
  store.save('menu', { menu_position: '1000', menu_libelle: 'Accueil', menu_script: '/accueil?o=1', menu_droit: 9 });
}

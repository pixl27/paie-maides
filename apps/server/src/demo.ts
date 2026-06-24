/**
 * Application de démonstration : appli « facture » définie par DONNÉES, plus un
 * utilisateur et un menu — pour montrer le shell complet (login -> menu -> écran).
 */

import {
  R4, MemoryLayerStore, MemoryUserStore, creerPatron, SpecifiqueRegistry,
  type Ecran, type MenuEntry,
} from '@maides/core';
import { MaidesApp } from './app.js';

export function creerAppDemo(): MaidesApp {
  const patFacture = creerPatron('facture', [
    { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
    { nom_champ: 'client', type_champ: 'string', val_def: '' },
    { nom_champ: 'qte', type_champ: 'integer', val_def: '0' },
    { nom_champ: 'pu', type_champ: 'decimal', val_def: '0' },
    { nom_champ: 'total', type_champ: 'decimal', val_def: '0' },
  ], { emplacement: 'D' });

  const patScr = creerPatron('scr', [
    { nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
  ], { emplacement: 'P' });
  const patLet = creerPatron('let', [
    { nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
  ], { emplacement: 'P' });

  const ecran: Ecran & { nom_ecran: string } = {
    nom_ecran: 'factureSaisie',
    table_liee: 'facture',
    template: 'N° $num<br/>Client $client<br/>Quantité $qte<br/>Prix unitaire $pu<br/>Total $total',
    champs: {
      num: { type_widget: 'integer', type_champ: 'integer', libelle: 'N°' },
      client: { type_widget: 'text', type_champ: 'string', libelle: 'Client', est_notnull: 1 },
      qte: { type_widget: 'integer', type_champ: 'integer', libelle: 'Quantité', val_min: '1', est_notnull: 1 },
      pu: { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Prix unitaire' },
      total: {
        type_widget: 'decimal', type_champ: 'decimal', libelle: 'Total',
        formule_calcul: '$qte * $pu', calcul_systematique: '1', est_lecture_seule: 1,
      },
    },
  };

  const data = new MemoryLayerStore().definePatron(patFacture);
  const params = new MemoryLayerStore().definePatron(patScr).definePatron(patLet).definePatron(patFacture);
  params.putWithKey('scr', ['factureSaisie'], ecran);

  const r4 = new R4({ data, paramR4: params });

  const userStore = new MemoryUserStore();
  userStore.creer('admin', 'admin', { super_admin: 'O', niveau: 0 });

  const menuEntries: MenuEntry[] = [
    { menu_position: '1000', menu_libelle: 'Factures', menu_script: '' },
    { menu_position: '1100', menu_libelle: 'Nouvelle facture', menu_script: '/factureSaisie?o=8&b=1' },
    { menu_position: '9000', menu_libelle: 'Designer', menu_script: '/designer' },
  ];

  // OBE : ordres personnalisés `o=<nom>` (port des programmes o_<nom>.php du legacy).
  const specifiques = new SpecifiqueRegistry();
  specifiques.enregistrer('factureSaisie', {
    ordres: {
      // o=doubler : double la quantité (démonstration d'un ordre non-numérique)
      doubler: (ctx) => {
        ctx.valeurs['qte'] = Number(ctx.valeurs['qte'] ?? 0) * 2;
        ctx.message('succes', 'Quantité doublée (ordre personnalisé « doubler »).');
      },
    },
  });

  return new MaidesApp(r4, { titre: 'Démo maides', userStore, menuEntries, designerStore: params, specifiques });
}

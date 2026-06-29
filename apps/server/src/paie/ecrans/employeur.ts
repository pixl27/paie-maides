/** Écran employeur : fiche `paie_emp`. */
import type { EcranEditor } from '@maides/core';

export function definitEcranEmployeur(scr: EcranEditor): void {
  scr.creerEcran('paie_emp', { table_liee: 'emp', template: 'Raison sociale $raison_sociale<br/>SIRET $siret<br/>Adresse $adresse<br/>$cp $ville<br/>Convention $conv_collective' });
  scr.placeWidget('paie_emp', 'raison_sociale', { type_widget: 'text', type_champ: 'string', libelle: 'Raison sociale', est_notnull: 1 });
  scr.placeWidget('paie_emp', 'siret', { type_widget: 'text', type_champ: 'string', libelle: 'SIRET' });
  scr.placeWidget('paie_emp', 'adresse', { type_widget: 'text', type_champ: 'string', libelle: 'Adresse' });
  scr.placeWidget('paie_emp', 'cp', { type_widget: 'text', type_champ: 'string', libelle: 'Code postal' });
  scr.placeWidget('paie_emp', 'ville', { type_widget: 'text', type_champ: 'string', libelle: 'Ville' });
  scr.placeWidget('paie_emp', 'conv_collective', { type_widget: 'text', type_champ: 'string', libelle: 'Convention collective' });
}

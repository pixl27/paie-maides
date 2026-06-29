/** Écran tiers d'assurance : fiche `aax_adr`. */
import type { EcranEditor } from '@maides/core';

export function definitEcranTiers(scr: EcranEditor): void {
  scr.creerEcran('aax_adr', { table_liee: 'adr', template: 'Nom $adr_12<br/>Email $adr_email' });
  scr.placeWidget('aax_adr', 'adr_12', { type_widget: 'text', type_champ: 'string', libelle: 'Nom', est_notnull: 1 });
  scr.placeWidget('aax_adr', 'adr_email', { type_widget: 'email', type_champ: 'string', libelle: 'Email' });
}

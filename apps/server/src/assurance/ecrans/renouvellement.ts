/** Écran renouvellement : fiche `aax_renouv`. Le nouveau CRM (bonus-malus) est calculé. */
import type { EcranEditor } from '@maides/core';

export function definitEcranRenouvellement(scr: EcranEditor): void {
  scr.creerEcran('aax_renouv', { table_liee: 'renouv', template: 'CRM précédent $crm_prec<br/>Sinistre responsable (0/1) $responsable<br/><hr/>Nouveau CRM $crm' });
  scr.placeWidget('aax_renouv', 'crm_prec', { type_widget: 'integer', type_champ: 'integer', libelle: 'CRM précédent (ex. 1000)' });
  scr.placeWidget('aax_renouv', 'responsable', { type_widget: 'integer', type_champ: 'integer', libelle: 'Sinistre responsable (0/1)' });
  scr.placeWidget('aax_renouv', 'crm', { type_widget: 'integer', type_champ: 'integer', libelle: 'Nouveau CRM', formule_calcul: '[bonus_malus]', calcul_systematique: '1', est_lecture_seule: 1 });
}

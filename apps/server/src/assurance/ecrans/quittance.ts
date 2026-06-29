/**
 * Écran quittance : fiche `aax_qit`. Saisie de la base/prorata/bonus ; prime nette,
 * taxe (selon le code AUTO/MRH), TTC et commission sont calculés par formules.
 */
import type { EcranEditor } from '@maides/core';

export function definitEcranQuittance(scr: EcranEditor): void {
  scr.creerEcran('aax_qit', {
    table_liee: 'qit',
    template: 'Base prime $base<br/>Prorata $prorata<br/>Bonus (‰) $bonus<br/>Code taxe $taux_code<br/>Taux commission $com_taux<br/><hr/>Prime nette $pnet<br/>Taxe $taxe<br/>TTC $ttc<br/>Commission $commission',
  });
  scr.placeWidget('aax_qit', 'base', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Base prime' });
  scr.placeWidget('aax_qit', 'prorata', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Prorata (0..1)' });
  scr.placeWidget('aax_qit', 'bonus', { type_widget: 'integer', type_champ: 'integer', libelle: 'Bonus (millièmes)' });
  scr.placeWidget('aax_qit', 'taux_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code taxe (AUTO/MRH)' });
  scr.placeWidget('aax_qit', 'com_taux', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux commission %' });
  scr.placeWidget('aax_qit', 'pnet', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Prime nette', formule_calcul: '[prime_nette]', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'taxe', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taxe', formule_calcul: 'rn(0.01, $pnet * table("tax", $taux_code) / 100)', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'ttc', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'TTC', formule_calcul: '$pnet + $taxe', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'commission', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Commission', formule_calcul: 'rn(0.01, $pnet * $com_taux / 100)', calcul_systematique: '1', est_lecture_seule: 1 });
}

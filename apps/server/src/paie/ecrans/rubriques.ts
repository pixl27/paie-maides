/** Écrans rubriques de cotisation : fiche `paie_rub` + liste `paie_rubs`. */
import type { EcranEditor } from '@maides/core';

export function definitEcransRubriques(scr: EcranEditor): void {
  scr.creerEcran('paie_rub', { table_liee: 'rub', template: 'Code $rub_code<br/>Libellé $libelle<br/>Base $base_type<br/>Taux salarial $tx_sal Taux patronal $tx_pat<br/>Non déductible $non_deductible' });
  scr.placeWidget('paie_rub', 'rub_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code', est_notnull: 1 });
  scr.placeWidget('paie_rub', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('paie_rub', 'base_type', { type_widget: 'text', type_champ: 'clop', libelle: 'Base (brut/plafond/base_csg)' });
  scr.placeWidget('paie_rub', 'tx_sal', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux salarial %' });
  scr.placeWidget('paie_rub', 'tx_pat', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux patronal %' });
  scr.placeWidget('paie_rub', 'non_deductible', { type_widget: 'integer', type_champ: 'integer', libelle: 'Réintégré au net imposable (0/1)' });

  scr.creerEcran('paie_rubs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/paie_rub?o=8&b=">+ Nouvelle rubrique</a></div>$liste' });
  scr.placeWidget('paie_rubs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=rub\necran=paie_rub\ncols=rub_code:Code;libelle:Libellé;base_type:Base;tx_sal:Taux salarial;tx_pat:Taux patronal' });
}

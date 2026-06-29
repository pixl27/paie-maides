/** Écrans des journaux comptables : fiche `compta_jal` + liste `compta_jals`. */
import type { EcranEditor } from '@maides/core';

export function definitEcransJournaux(scr: EcranEditor): void {
  // Journaux : fiche + liste
  scr.creerEcran('compta_jal', { table_liee: 'jal', template: 'Code $jal_code<br/>Libellé $libelle<br/>Type $type' });
  scr.placeWidget('compta_jal', 'jal_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code journal', est_notnull: 1 });
  scr.placeWidget('compta_jal', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_jal', 'type', { type_widget: 'select', type_champ: 'clop', libelle: 'Type', options: [{ value: 'achat', libelle: 'Achats' }, { value: 'vente', libelle: 'Ventes' }, { value: 'tresorerie', libelle: 'Trésorerie' }, { value: 'od', libelle: 'Opérations diverses' }] });
  scr.creerEcran('compta_jals', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_jal?o=8&b=">+ Nouveau journal</a></div>$liste' });
  scr.placeWidget('compta_jals', 'liste', { type_widget: 'selectList', option_type_widget: 'table=jal\necran=compta_jal\ncols=jal_code:Code;libelle:Libellé;type:Type' });
}

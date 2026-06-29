/** Écrans des tiers (clients/fournisseurs) : fiche `compta_trs` + liste `compta_trss`. */
import type { EcranEditor } from '@maides/core';

export function definitEcransTiers(scr: EcranEditor): void {
  // Tiers : fiche + liste
  scr.creerEcran('compta_trs', { table_liee: 'trs', template: 'Code $trs_code<br/>Nom $nom<br/>Type $type<br/>Compte de rattachement $compte' });
  scr.placeWidget('compta_trs', 'trs_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code tiers', est_notnull: 1 });
  scr.placeWidget('compta_trs', 'nom', { type_widget: 'text', type_champ: 'string', libelle: 'Nom / raison sociale' });
  scr.placeWidget('compta_trs', 'type', { type_widget: 'select', type_champ: 'clop', libelle: 'Type', options: [{ value: 'client', libelle: 'Client' }, { value: 'fournisseur', libelle: 'Fournisseur' }] });
  scr.placeWidget('compta_trs', 'compte', { type_widget: 'querabilitePopup', type_champ: 'clop', libelle: 'Compte de rattachement', option_type_widget: 'table=cpt\ncle=cpt_num\naffichage=libelle' });
  scr.creerEcran('compta_trss', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_trs?o=8&b=">+ Nouveau tiers</a></div>$liste' });
  scr.placeWidget('compta_trss', 'liste', { type_widget: 'selectList', option_type_widget: 'table=trs\necran=compta_trs\ncols=trs_code:Code;nom:Nom;type:Type;compte:Compte' });
}

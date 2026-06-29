/**
 * Journal général : fiche de saisie d'une ligne `compta_lig` (compte choisi par
 * BOUTON CONTEXTUEL de recherche, journal/tiers en LISTE DÉROULANTE, classe PCG
 * auto-calculée) + liste `compta_ligs` de toutes les lignes.
 */
import type { EcranEditor } from '@maides/core';

export function definitEcransLignes(scr: EcranEditor): void {
  // Journal général : toutes les lignes ; saisie d'une ligne
  scr.creerEcran('compta_lig', { table_liee: 'lig', template: 'N° écriture (pièce) $ecr_id<br/>Date $date_ecr<br/>Journal $jal_code<br/>Compte $compte<br/>Tiers $trs_code<br/>Libellé $libelle<br/>Débit $debit — Crédit $credit' });
  scr.placeWidget('compta_lig', 'ecr_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'N° écriture', est_notnull: 1 });
  scr.placeWidget('compta_lig', 'date_ecr', { type_widget: 'date', type_champ: 'date', libelle: 'Date' });
  scr.placeWidget('compta_lig', 'jal_code', { type_widget: 'selectFic', type_champ: 'clop', libelle: 'Journal', option_type_widget: 'table=jal\ncle=jal_code\nlibelle=libelle' });
  // Compte : bouton contextuel « … » qui ouvre la recherche dans le plan comptable.
  scr.placeWidget('compta_lig', 'compte', { type_widget: 'querabilitePopup', type_champ: 'clop', libelle: 'Compte', est_notnull: 1, option_type_widget: 'table=cpt\ncle=cpt_num\naffichage=libelle' });
  scr.placeWidget('compta_lig', 'trs_code', { type_widget: 'selectFic', type_champ: 'clop', libelle: 'Tiers (facultatif)', option_type_widget: 'table=trs\ncle=trs_code\nlibelle=nom\neditable=1' });
  scr.placeWidget('compta_lig', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_lig', 'debit', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Débit' });
  scr.placeWidget('compta_lig', 'credit', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Crédit' });
  scr.placeWidget('compta_lig', 'classe', { type_widget: 'integer', type_champ: 'integer', libelle: 'Classe (auto)', formule_calcul: '[lig_classe]', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.creerEcran('compta_ligs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_lig?o=8&b=">+ Nouvelle ligne</a> <a class="btn secondaire" target="_blank" href="/compta_journal_pdf?o=14&b=">🖨 Journal général (PDF)</a></div>$liste' });
  scr.placeWidget('compta_ligs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=lig\necran=compta_lig\ntri=ecr_id desc\ncols=ecr_id:Pièce;date_ecr:Date;jal_code:Jal;compte:Compte;libelle:Libellé;debit:Débit;credit:Crédit' });
}

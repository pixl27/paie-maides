/**
 * Écritures (pièces comptables) : fiche `compta_ecr` (totaux et équilibre calculés,
 * SAISIE MULTI-LIGNE via une grille éditable) + liste `compta_ecrs`.
 */
import type { EcranEditor } from '@maides/core';
import { calc } from '../widgets.js';

export function definitEcransEcritures(scr: EcranEditor): void {
  // Écritures : fiche (équilibre calculé) + grille de saisie des lignes
  scr.creerEcran('compta_ecr', { table_liee: 'ecr', template:
    'Écriture n° $ecr_1 — Statut $statut<br/>Date $date_ecr — Journal $jal_code<br/>Pièce $piece — $libelle<hr/>'
    + 'Total débit $total_debit — Total crédit $total_credit<br/><b>Équilibre (doit être 0) $equilibre</b>'
    + '<div class="md-toolbar"><a class="btn secondaire" target="_blank" href="/compta_ecriture_pdf?o=14&b=$ecr_1">🖨 Imprimer l’écriture (PDF)</a></div><hr/>'
    + '<h2>Lignes (saisie multi-ligne)</h2>'
    + '<p class="md-aide">Enregistrez d’abord l’en-tête, puis « + Ajouter une ligne » : saisissez compte / libellé / débit / crédit puis ✓.</p>$lignes' });
  scr.placeWidget('compta_ecr', 'date_ecr', { type_widget: 'date', type_champ: 'date', libelle: 'Date' });
  scr.placeWidget('compta_ecr', 'jal_code', { type_widget: 'selectFic', type_champ: 'clop', libelle: 'Journal', option_type_widget: 'table=jal\ncle=jal_code\nlibelle=libelle' });
  scr.placeWidget('compta_ecr', 'piece', { type_widget: 'text', type_champ: 'string', libelle: 'N° de pièce' });
  scr.placeWidget('compta_ecr', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_ecr', 'statut', { type_widget: 'select', type_champ: 'clop', libelle: 'Statut', options: [{ value: 'brouillard', libelle: 'Brouillard' }, { value: 'validé', libelle: 'Validé' }] });
  scr.placeWidget('compta_ecr', 'total_debit', calc('ecr_tdeb', 'Total débit'));
  scr.placeWidget('compta_ecr', 'total_credit', calc('ecr_tcred', 'Total crédit'));
  scr.placeWidget('compta_ecr', 'equilibre', calc('ecr_eq', 'Équilibre (0 = équilibrée)'));
  // Grille éditable des lignes de CETTE écriture : filtre dynamique ecr_id = $ecr_1 ;
  // chaque nouvelle ligne reçoit automatiquement ecr_id = clé de l'écriture (lien).
  scr.placeWidget('compta_ecr', 'lignes', { type_widget: 'editableArray', option_type_widget: 'secran=compta_lig\ntable=lig\nlien=ecr_id\nliencopie=date_ecr,jal_code\nfiltre=ecr_id = $ecr_1\ncols=compte:Compte;libelle:Libellé;debit:Débit;credit:Crédit' });
  scr.creerEcran('compta_ecrs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_ecr?o=8&b=">+ Nouvelle écriture</a></div>$liste' });
  scr.placeWidget('compta_ecrs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=ecr\necran=compta_ecr\ntri=ecr_1 desc\ncols=ecr_1:N°;date_ecr:Date;jal_code:Jal;piece:Pièce;libelle:Libellé;equilibre:Équilibre' });
}

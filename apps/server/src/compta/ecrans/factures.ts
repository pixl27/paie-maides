/**
 * Facturation, règlements, lettrage et échéancier :
 *  - `compta_fac` / `compta_facs` : factures (TVA/TTC/réglé/solde calculés, détail
 *    des règlements) ;
 *  - `compta_reg` / `compta_regs` : règlements rattachés à une facture ;
 *  - `compta_echeancier` : factures triées par échéance avec leur solde restant dû.
 */
import type { EcranEditor } from '@maides/core';
import { calc } from '../widgets.js';

export function definitEcransFactures(scr: EcranEditor): void {
  // --- Factures + règlements + lettrage + échéancier ---
  scr.creerEcran('compta_fac', { table_liee: 'fac', template:
    'Facture n° $fac_1 ($type) — $numero<br/>Tiers $trs_code<br/>Date $date_fac — Échéance $date_ech<hr/>'
    + 'Montant HT $ht<br/>TVA ($tva_taux %) $tva<br/><b>TTC $ttc</b><hr/>'
    + 'Déjà réglé $regle<br/><b>Solde restant dû (0 = lettrée/soldée) $solde</b><hr/>'
    + '<div class="md-toolbar"><a class="btn secondaire" target="_blank" href="/compta_facture_pdf?o=14&b=$fac_1">🖨 Imprimer la facture (PDF)</a></div>'
    + '<h2>Règlements</h2>$reglements<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_reg?o=8&b=">+ Nouveau règlement</a></div>' });
  scr.placeWidget('compta_fac', 'type', { type_widget: 'select', type_champ: 'clop', libelle: 'Type', options: [{ value: 'vente', libelle: 'Vente (client)' }, { value: 'achat', libelle: 'Achat (fournisseur)' }] });
  scr.placeWidget('compta_fac', 'trs_code', { type_widget: 'selectFic', type_champ: 'clop', libelle: 'Tiers', option_type_widget: 'table=trs\ncle=trs_code\nlibelle=nom\neditable=1' });
  scr.placeWidget('compta_fac', 'numero', { type_widget: 'text', type_champ: 'string', libelle: 'N° de facture' });
  scr.placeWidget('compta_fac', 'date_fac', { type_widget: 'date', type_champ: 'date', libelle: 'Date facture' });
  scr.placeWidget('compta_fac', 'date_ech', { type_widget: 'date', type_champ: 'date', libelle: 'Échéance' });
  scr.placeWidget('compta_fac', 'ht', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Montant HT', est_notnull: 1 });
  scr.placeWidget('compta_fac', 'tva_taux', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux de TVA %' });
  scr.placeWidget('compta_fac', 'tva', calc('fac_tva', 'TVA'));
  scr.placeWidget('compta_fac', 'ttc', calc('fac_ttc', 'Montant TTC'));
  scr.placeWidget('compta_fac', 'regle', calc('fac_regle', 'Déjà réglé'));
  scr.placeWidget('compta_fac', 'solde', calc('fac_solde', 'Solde restant dû'));
  scr.placeWidget('compta_fac', 'reglements', { type_widget: 'selectList', option_type_widget: 'table=reg\nfiltre=fac_id = $fac_1\necran=compta_reg\ncols=date_reg:Date;montant:Montant;mode:Mode' });

  scr.creerEcran('compta_facs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_fac?o=8&b=">+ Nouvelle facture</a></div>$liste' });
  scr.placeWidget('compta_facs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=fac\necran=compta_fac\ncols=fac_1:N°;type:Type;numero:Numéro;trs_code:Tiers;date_ech:Échéance;ttc:TTC;solde:Solde' });

  scr.creerEcran('compta_reg', { table_liee: 'reg', template: 'Règlement n° $reg_1<br/>Facture n° $fac_id<br/>Date $date_reg<br/>Montant $montant<br/>Mode $mode' });
  scr.placeWidget('compta_reg', 'fac_id', { type_widget: 'selectFic', type_champ: 'integer', libelle: 'Facture', est_notnull: 1, option_type_widget: 'table=fac\ncle=fac_1\nlibelle=numero' });
  scr.placeWidget('compta_reg', 'date_reg', { type_widget: 'date', type_champ: 'date', libelle: 'Date du règlement' });
  scr.placeWidget('compta_reg', 'montant', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Montant', est_notnull: 1 });
  scr.placeWidget('compta_reg', 'mode', { type_widget: 'select', type_champ: 'clop', libelle: 'Mode de règlement', options: [{ value: 'virement', libelle: 'Virement' }, { value: 'cheque', libelle: 'Chèque' }, { value: 'especes', libelle: 'Espèces' }, { value: 'cb', libelle: 'Carte bancaire' }] });

  scr.creerEcran('compta_regs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_reg?o=8&b=">+ Nouveau règlement</a></div>$liste' });
  scr.placeWidget('compta_regs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=reg\necran=compta_reg\ncols=reg_1:N°;fac_id:Facture;date_reg:Date;montant:Montant;mode:Mode' });

  scr.creerEcran('compta_echeancier', { table_liee: '', template: '<h2>Échéancier — factures et soldes</h2>$liste<p class="md-aide">Cliquez une facture pour voir/saisir ses règlements ; son solde y est recalculé.</p>' });
  scr.placeWidget('compta_echeancier', 'liste', { type_widget: 'selectList', option_type_widget: 'table=fac\necran=compta_fac\ntri=date_ech\ncols=numero:Facture;type:Type;trs_code:Tiers;date_ech:Échéance;ttc:TTC;regle:Réglé;solde:Solde' });
}

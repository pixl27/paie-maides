/**
 * États comptables imprimables (lettres `let`, rendus en PDF via o=14) :
 * écriture, grand livre d'un compte, journal général, compte de résultat, bilan.
 * Les widgets-listes sont rendus en lecture seule dans le document (tableaux).
 */
import type { EcranEditor } from '@maides/core';
import { calc } from '../widgets.js';

export function definitLettresEtats(lettres: EcranEditor): void {
  // Écriture imprimable : en-tête + lignes + totaux recalculés.
  lettres.creerEcran('compta_ecriture_pdf', { table_liee: 'ecr', template:
    '<h1>Écriture n° $ecr_1</h1><p>Date $date_ecr — Journal $jal_code — Pièce $piece<br/>$libelle</p>'
    + '<h3>Lignes</h3>$lignes<hr/><p>Total débit <b>$total_debit</b> — Total crédit <b>$total_credit</b> — Équilibre $equilibre</p>' });
  lettres.placeWidget('compta_ecriture_pdf', 'total_debit', calc('ecr_tdeb', 'Total débit'));
  lettres.placeWidget('compta_ecriture_pdf', 'total_credit', calc('ecr_tcred', 'Total crédit'));
  lettres.placeWidget('compta_ecriture_pdf', 'equilibre', calc('ecr_eq', 'Équilibre'));
  lettres.placeWidget('compta_ecriture_pdf', 'lignes', { type_widget: 'selectList', option_type_widget: 'table=lig\nfiltre=ecr_id = $ecr_1\ncols=compte:Compte;libelle:Libellé;debit:Débit;credit:Crédit' });

  // Grand livre d'un compte : mouvements + solde.
  lettres.creerEcran('compta_grandlivre_pdf', { table_liee: 'cpt', template:
    '<h1>Grand livre — compte $cpt_num</h1><p>$libelle</p>'
    + '<h3>Mouvements</h3>$mouvements<hr/><p>Total débit $total_debit — Total crédit $total_credit — Solde <b>$solde</b></p>' });
  lettres.placeWidget('compta_grandlivre_pdf', 'total_debit', calc('cpt_deb', 'Total débit'));
  lettres.placeWidget('compta_grandlivre_pdf', 'total_credit', calc('cpt_cred', 'Total crédit'));
  lettres.placeWidget('compta_grandlivre_pdf', 'solde', calc('cpt_sld', 'Solde'));
  lettres.placeWidget('compta_grandlivre_pdf', 'mouvements', { type_widget: 'selectList', option_type_widget: 'table=lig\nfiltre=compte = $cpt_num\ntri=ecr_id\ncols=ecr_id:Pièce;date_ecr:Date;jal_code:Jal;libelle:Libellé;debit:Débit;credit:Crédit' });

  // Journal général : toutes les lignes.
  lettres.creerEcran('compta_journal_pdf', { table_liee: '', template: '<h1>Journal général</h1>$lignes' });
  lettres.placeWidget('compta_journal_pdf', 'lignes', { type_widget: 'selectList', option_type_widget: 'table=lig\ntri=ecr_id\ncols=ecr_id:Pièce;date_ecr:Date;jal_code:Jal;compte:Compte;libelle:Libellé;debit:Débit;credit:Crédit' });

  // Compte de résultat.
  lettres.creerEcran('compta_resultat_pdf', { table_liee: 'res', template:
    '<h1>Compte de résultat — exercice $exercice</h1><p>Produits (classe 7) : $produits<br/>Charges (classe 6) : $charges</p><hr/><p>Résultat net : <b>$resultat</b></p>' });
  lettres.placeWidget('compta_resultat_pdf', 'produits', calc('res_pr', 'Produits'));
  lettres.placeWidget('compta_resultat_pdf', 'charges', calc('res_ch', 'Charges'));
  lettres.placeWidget('compta_resultat_pdf', 'resultat', calc('res_net', 'Résultat'));

  // Bilan simplifié.
  lettres.creerEcran('compta_bilan_pdf', { table_liee: 'res', template:
    '<h1>Bilan simplifié — exercice $exercice</h1>'
    + '<p><b>ACTIF</b><br/>Immobilisations (cl.2) $b_immo<br/>Stocks (cl.3) $b_stocks<br/>Tiers débiteurs (cl.4) $b_tiers<br/>Trésorerie (cl.5) $b_treso<br/><b>TOTAL ACTIF $b_actif</b></p>'
    + '<p><b>PASSIF</b><br/>Capitaux propres (cl.1) $b_capx<br/>Résultat $resultat<br/><b>TOTAL PASSIF $b_passif</b></p>' });
  lettres.placeWidget('compta_bilan_pdf', 'b_immo', calc('bil_immo', 'Immobilisations'));
  lettres.placeWidget('compta_bilan_pdf', 'b_stocks', calc('bil_stocks', 'Stocks'));
  lettres.placeWidget('compta_bilan_pdf', 'b_tiers', calc('bil_tiers', 'Tiers débiteurs'));
  lettres.placeWidget('compta_bilan_pdf', 'b_treso', calc('bil_treso', 'Trésorerie'));
  lettres.placeWidget('compta_bilan_pdf', 'b_actif', calc('bil_actif', 'Total actif'));
  lettres.placeWidget('compta_bilan_pdf', 'b_capx', calc('bil_capx', 'Capitaux propres'));
  lettres.placeWidget('compta_bilan_pdf', 'resultat', calc('res_net', 'Résultat'));
  lettres.placeWidget('compta_bilan_pdf', 'b_passif', calc('bil_passif', 'Total passif'));
}

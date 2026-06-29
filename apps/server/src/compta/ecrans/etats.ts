/**
 * États de synthèse (tous adossés à la fiche unique `res`) :
 *  - `compta_resultat` : compte de résultat (produits cl.7 − charges cl.6) ;
 *  - `compta_bilan`    : bilan simplifié par masses (actif = passif) ;
 *  - `compta_tva`      : déclaration de TVA (collectée − déductible).
 */
import type { EcranEditor } from '@maides/core';
import { calc } from '../widgets.js';

export function definitEcransEtats(scr: EcranEditor): void {
  // Compte de résultat (charges classe 6, produits classe 7, résultat)
  scr.creerEcran('compta_resultat', { table_liee: 'res', template: 'COMPTE DE RÉSULTAT — exercice $exercice<hr/>Total produits (classe 7) $produits<br/>Total charges (classe 6) $charges<hr/><b>Résultat (produits − charges) $resultat</b><div class="md-toolbar"><a class="btn secondaire" target="_blank" href="/compta_resultat_pdf?o=14&b=1">🖨 PDF</a></div>' });
  scr.placeWidget('compta_resultat', 'exercice', { type_widget: 'text', type_champ: 'string', libelle: 'Exercice' });
  scr.placeWidget('compta_resultat', 'charges', calc('res_ch', 'Total charges (classe 6)'));
  scr.placeWidget('compta_resultat', 'produits', calc('res_pr', 'Total produits (classe 7)'));
  scr.placeWidget('compta_resultat', 'resultat', calc('res_net', 'Résultat net'));

  // Bilan simplifié par masses (net par classe) — actif = passif quoi qu'il arrive
  scr.creerEcran('compta_bilan', { table_liee: 'res', template:
    'BILAN SIMPLIFIÉ — exercice $exercice<hr/>'
    + '<b>ACTIF</b><br/>Actif immobilisé (cl.2) $b_immo<br/>Stocks (cl.3) $b_stocks<br/>Créances &amp; tiers débiteurs nets (cl.4) $b_tiers<br/>Trésorerie nette (cl.5) $b_treso<br/><b>TOTAL ACTIF $b_actif</b><hr/>'
    + '<b>PASSIF</b><br/>Capitaux propres (cl.1) $b_capx<br/>Résultat de l’exercice $resultat<br/><b>TOTAL PASSIF $b_passif</b><div class="md-toolbar"><a class="btn secondaire" target="_blank" href="/compta_bilan_pdf?o=14&b=1">🖨 PDF</a></div>' });
  scr.placeWidget('compta_bilan', 'exercice', { type_widget: 'text', type_champ: 'string', libelle: 'Exercice' });
  scr.placeWidget('compta_bilan', 'b_immo', calc('bil_immo', 'Actif immobilisé (cl.2)'));
  scr.placeWidget('compta_bilan', 'b_stocks', calc('bil_stocks', 'Stocks (cl.3)'));
  scr.placeWidget('compta_bilan', 'b_tiers', calc('bil_tiers', 'Créances & tiers nets (cl.4)'));
  scr.placeWidget('compta_bilan', 'b_treso', calc('bil_treso', 'Trésorerie nette (cl.5)'));
  scr.placeWidget('compta_bilan', 'b_actif', calc('bil_actif', 'TOTAL ACTIF'));
  scr.placeWidget('compta_bilan', 'b_capx', calc('bil_capx', 'Capitaux propres (cl.1)'));
  scr.placeWidget('compta_bilan', 'resultat', calc('res_net', 'Résultat'));
  scr.placeWidget('compta_bilan', 'b_passif', calc('bil_passif', 'TOTAL PASSIF'));

  // Déclaration de TVA (CA3 simplifiée)
  scr.creerEcran('compta_tva', { table_liee: 'res', template:
    'DÉCLARATION DE TVA — exercice $exercice<hr/>TVA collectée (ventes) $t_col<br/>TVA déductible (achats) $t_ded<hr/><b>TVA à décaisser (collectée − déductible) $t_due</b>' });
  scr.placeWidget('compta_tva', 'exercice', { type_widget: 'text', type_champ: 'string', libelle: 'Exercice' });
  scr.placeWidget('compta_tva', 't_col', calc('tva_col', 'TVA collectée'));
  scr.placeWidget('compta_tva', 't_ded', calc('tva_ded', 'TVA déductible'));
  scr.placeWidget('compta_tva', 't_due', calc('tva_due', 'TVA à décaisser'));
}

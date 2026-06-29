/**
 * Plan comptable / balance : fiche `compta_cpt` (avec solde et grand livre du
 * compte calculés) + liste `compta_cpts` (la balance — cliquer un compte = son solde).
 */
import type { EcranEditor } from '@maides/core';
import { calc } from '../widgets.js';

export function definitEcransComptes(scr: EcranEditor): void {
  // Plan comptable : fiche (avec SOLDE calculé) + liste = balance (cliquer un compte montre son solde)
  scr.creerEcran('compta_cpt', { table_liee: 'cpt', template: 'Compte $cpt_num<br/>Libellé $libelle<br/>Classe $classe<hr/>Total débit $total_debit — Total crédit $total_credit<br/><b>Solde $solde</b><div class="md-toolbar"><a class="btn secondaire" target="_blank" href="/compta_grandlivre_pdf?o=14&b=$cpt_num">🖨 Grand livre (PDF)</a></div><hr/><h2>Grand livre du compte</h2>$grandlivre' });
  scr.placeWidget('compta_cpt', 'cpt_num', { type_widget: 'text', type_champ: 'clop', libelle: 'N° de compte', est_notnull: 1 });
  scr.placeWidget('compta_cpt', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_cpt', 'classe', { type_widget: 'select', type_champ: 'integer', libelle: 'Classe', options: [
    { value: '1', libelle: '1 — Capitaux' }, { value: '2', libelle: '2 — Immobilisations' }, { value: '3', libelle: '3 — Stocks' },
    { value: '4', libelle: '4 — Tiers' }, { value: '5', libelle: '5 — Financier' }, { value: '6', libelle: '6 — Charges' }, { value: '7', libelle: '7 — Produits' },
  ] });
  scr.placeWidget('compta_cpt', 'total_debit', calc('cpt_deb', 'Total débit'));
  scr.placeWidget('compta_cpt', 'total_credit', calc('cpt_cred', 'Total crédit'));
  scr.placeWidget('compta_cpt', 'solde', calc('cpt_sld', 'Solde (débiteur si > 0)'));
  // Grand livre : mouvements de CE compte (filtre dynamique compte = $cpt_num)
  scr.placeWidget('compta_cpt', 'grandlivre', { type_widget: 'selectList', option_type_widget: 'table=lig\nfiltre=compte = $cpt_num\necran=compta_lig\ncols=ecr_id:Pièce;date_ecr:Date;jal_code:Jal;libelle:Libellé;debit:Débit;credit:Crédit' });
  scr.creerEcran('compta_cpts', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_cpt?o=8&b=">+ Nouveau compte</a> <a class="btn secondaire" data-md-ajax href="/compta_resultat?o=1&b=1">Compte de résultat</a></div>$liste' });
  scr.placeWidget('compta_cpts', 'liste', { type_widget: 'selectList', option_type_widget: 'table=cpt\necran=compta_cpt\ncols=cpt_num:Compte;libelle:Libellé;classe:Classe' });
}

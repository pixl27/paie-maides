/**
 * Facture imprimable (lettre / PDF) : écran du patron `let` (≠ `scr`), rendu en
 * document imprimable via o=14. Reçoit l'éditeur de LETTRES.
 */
import type { EcranEditor } from '@maides/core';

export function definitLettreFacture(lettres: EcranEditor): void {
  lettres.creerEcran('compta_facture_pdf', {
    table_liee: 'fac',
    template:
      '<h1>FACTURE $numero</h1>'
      + '<p>Type : $type<br/>Tiers : $trs_code<br/>Date : $date_fac — Échéance : $date_ech</p><hr/>'
      + '<p>Montant HT : <b>$ht</b><br/>TVA ($tva_taux %) : $tva<br/>Total TTC : <b>$ttc</b></p><hr/>'
      + '<p>Déjà réglé : $regle<br/>Solde restant dû : <b>$solde</b></p>',
  });
}

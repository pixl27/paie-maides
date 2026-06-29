/**
 * Bulletin imprimable (lettre / PDF) : écran du patron `let` (≠ `scr`), rendu en
 * document imprimable. Reçoit donc l'éditeur de LETTRES, pas l'éditeur d'écrans.
 */
import type { EcranEditor } from '@maides/core';

export function definitLettreBulletin(lettres: EcranEditor): void {
  lettres.creerEcran('paie_bulletin_pdf', {
    table_liee: 'bul',
    template:
      'BULLETIN DE PAIE<br/>Salarié n° $sal_id — Période $periode<br/><hr/>'
      + 'Salaire brut : $brut<br/>Plafond SS : $plafond<br/>Base CSG : $base_csg<br/><hr/>'
      + 'Total cotisations salariales : $total_cot_sal<br/>'
      + '<b>Net à payer : $net_a_payer</b><br/>Net imposable : $net_imposable<br/><hr/>'
      + 'Total cotisations patronales : $total_cot_pat<br/>Coût total employeur : $cout_employeur',
  });
}

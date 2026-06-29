/**
 * Formules nommées de l'assurance : prime nette (base × prorata × bonus‰) et
 * recalcul du coefficient bonus-malus (CRM) au renouvellement.
 */
import { FormuleEditor } from '@maides/core';

export function definitFormules(frm: FormuleEditor): void {
  frm.definitFormule('prime_nette', 'rn(0.01, $base * $prorata * ($bonus / 1000))');
  frm.definitFormule('bonus_malus', 'SI($responsable > 0 ? rn(10, $crm_prec * 1.25) : rn(10, $crm_prec * 0.95))');
}

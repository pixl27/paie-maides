/**
 * Calcul du bulletin, 100% EN FORMULES MAIDES nommées (éditables au Designer).
 *
 * Les cotisations sont AGRÉGÉES depuis le catalogue `rub` par base (aggregate),
 * et les paramètres (PMSS, abattement CSG) lus via table("tx", …). Modifier un
 * taux, une rubrique ou un paramètre change le résultat sans toucher au code.
 */
import { FormuleEditor } from '@maides/core';

/** Σ des taux (salarial/patronal) du catalogue pour une base donnée. */
const aggSal = (base: string) => `aggregate("somme","rub","tx_sal","base_type = '${base}'")`;
const aggPat = (base: string) => `aggregate("somme","rub","tx_pat","base_type = '${base}'")`;

export function definitFormules(frm: FormuleEditor): void {
  frm.definitFormule('brut', 'rn(0.01, $salaire_base + $heures_sup * $taux_hs + $primes)'); // GAINS (éditable)
  frm.definitFormule('plafond', 'min([brut], table("tx","PMSS"))');
  frm.definitFormule('base_csg', 'rn(0.01, [brut] * table("tx","ABATT_CSG"))');
  frm.definitFormule('cot_sal', `rn(0.01, [brut] * ${aggSal('brut')} / 100 + [plafond] * ${aggSal('plafond')} / 100 + [base_csg] * ${aggSal('base_csg')} / 100)`);
  frm.definitFormule('cot_pat', `rn(0.01, [brut] * ${aggPat('brut')} / 100 + [plafond] * ${aggPat('plafond')} / 100 + [base_csg] * ${aggPat('base_csg')} / 100)`);
  frm.definitFormule('net_ap', '[brut] - [cot_sal]');
  frm.definitFormule('reintegre', 'rn(0.01, [base_csg] * aggregate("somme","rub","tx_sal","non_deductible = 1") / 100)');
  frm.definitFormule('net_imp', '[net_ap] + [reintegre]');
  frm.definitFormule('cout_emp', '[brut] + [cot_pat]');
}

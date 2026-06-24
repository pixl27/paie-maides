/**
 * Démonstration exécutable : une PAIE complète reconstruite EN LOW-CODE.
 * Lancer :  npx tsx apps/server/src/demo-paie.ts
 */
import { Runtime } from '@maides/core';
import { construitPaie } from './paie.js';

const { r4 } = construitPaie();
const admin = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });
const ln = (s: string) => process.stdout.write(s + '\n');

ln('=== PAIE reconstruite EN LOW-CODE (tables + formules, zéro code métier) ===\n');

const b = admin.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202406', salaire_base: '3000', heures_sup: '0', taux_hs: '0', primes: '0' }).zzz;
const v = b.valeurs;
ln(`Bulletin Dupont — salaire de base 3000 € (barème simplifié 2024) :`);
ln(`  Salaire brut .................. ${v.brut}`);
ln(`  Total cotisations salariales .. ${v.total_cot_sal}`);
ln(`  Net à payer .................. ${v.net_a_payer}`);
ln(`  Net imposable ................ ${v.net_imposable}`);
ln(`  Total cotisations patronales . ${v.total_cot_pat}`);
ln(`  Coût total employeur ......... ${v.cout_employeur}`);

const plafonne = admin.sauvegarde('paie_bul', [], { sal_id: '2', periode: '202406', salaire_base: '5000', heures_sup: '0', taux_hs: '0', primes: '0' }).zzz;
ln(`\nSalaire 5000 € : plafond SS écrêté à ${plafonne.valeurs.plafond} (PMSS), net à payer ${plafonne.valeurs.net_a_payer}.`);

const gest = new Runtime(r4, { user: { login: 'gestionnaire', superAdmin: false, niveau: 5 } });
const vueGest = gest.visu('paie_bul', ['1']);
ln(`\nDroits : le coût employeur est ${vueGest.droits?.cout_employeur?.masque ? 'MASQUÉ' : 'visible'} pour le gestionnaire (niveau 5).`);

const ok = v.brut === 3000 && v.total_cot_sal === 625.21 && v.net_a_payer === 2374.79
  && v.net_imposable === 2460.27 && v.total_cot_pat === 984.9 && v.cout_employeur === 3984.9
  && plafonne.valeurs.plafond === 3864 && vueGest.droits?.cout_employeur?.masque === true;
ln(`\n${ok ? '✅ CONFIRMÉ' : '❌ ÉCHEC'} : le constructeur maides-v2 fait tourner une paie complète en low-code.`);
process.exit(ok ? 0 : 1);

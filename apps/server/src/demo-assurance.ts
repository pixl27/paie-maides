/**
 * Démonstration exécutable : l'application d'ASSURANCE reconstruite EN LOW-CODE.
 *
 * L'application est définie par DONNÉES dans `./assurance/` (tables, écrans,
 * formules, paramètres, droits) et exécutée par le runtime générique. Ce script ne
 * fait que l'instancier et VÉRIFIER que tout se calcule comme attendu (zéro code
 * métier ici).
 *
 * Lancer :  npx tsx apps/server/src/demo-assurance.ts
 */

import { Runtime } from '@maides/core';
import { construitAssurance } from './assurance/index.js';

const { r4 } = construitAssurance();
const admin = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });

const ln = (s: string) => process.stdout.write(s + '\n');
ln('=== Assurance reconstruite EN LOW-CODE (données + formules, zéro code métier) ===\n');

const q = admin.sauvegarde('aax_qit', [], { base: '1000', prorata: '0.5', bonus: '950', taux_code: 'AUTO', com_taux: '10' }).zzz;
ln(`Quittance AUTO  #${q.cle.join('.')} (base 1000, prorata 0.5, bonus 950/1000, taxe AUTO 18%) :`);
ln(`  prime nette = ${q.valeurs.pnet}  | taxe = ${q.valeurs.taxe}  | TTC = ${q.valeurs.ttc}  | commission = ${q.valeurs.commission}`);

const crmM = admin.postageSeul('aax_renouv', [], { crm_prec: '1000', responsable: '1' }).zzz;
const crmB = admin.postageSeul('aax_renouv', [], { crm_prec: '1000', responsable: '0' }).zzz;
ln(`\nBonus-malus (CRM départ 1000) :  sinistre responsable -> ${crmM.valeurs.crm} (+25%)   sans sinistre -> ${crmB.valeurs.crm} (-5%)`);

const agent = new Runtime(r4, { user: { login: 'agent', superAdmin: false, niveau: 5 } });
const vueAgent = agent.visu('aax_qit', ['1']);
ln(`\nDroits par champ : la commission est ${vueAgent.droits?.commission?.masque ? 'MASQUÉE' : 'visible'} pour l'agent (niveau 5), visible pour l'admin.`);

const ok = q.valeurs.pnet === 475 && q.valeurs.taxe === 85.5 && q.valeurs.ttc === 560.5
  && q.valeurs.commission === 47.5 && crmM.valeurs.crm === 1250 && crmB.valeurs.crm === 950
  && vueAgent.droits?.commission?.masque === true;
ln(`\n${ok ? '✅ CONFIRMÉ' : '❌ ÉCHEC'} : le constructeur maides-v2 reconstruit l'assurance en low-code.`);
process.exit(ok ? 0 : 1);

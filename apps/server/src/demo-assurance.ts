/**
 * Démonstration exécutable : reconstruire l'application d'ASSURANCE en LOW-CODE.
 *
 * Tout est défini par DONNÉES via les éditeurs du constructeur (tables, écrans,
 * formules, tables de paramètres, droits), puis exécuté par le runtime générique.
 * Aucune ligne de logique métier n'est écrite ici — seulement de la configuration.
 *
 * Lancer :  npx tsx apps/server/src/demo-assurance.ts
 */

import {
  R4, MemoryLayerStore, Runtime, creerPatron,
  PatronEditor, EcranEditor, FormuleEditor, TableParamEditor, DroitEditor,
} from '@maides/core';

function construitAssurance(): R4 {
  const data = new MemoryLayerStore();
  const params = new MemoryLayerStore().definePatron(
    creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }),
  );

  const pat = new PatronEditor(data);
  pat.creerTable('qit', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'qit_1', type_champ: 'integer' as const, est_autoincrement: 1 },
    { nom_champ: 'base', type_champ: 'decimal' as const },
    { nom_champ: 'prorata', type_champ: 'decimal' as const },
    { nom_champ: 'bonus', type_champ: 'integer' as const },
    { nom_champ: 'taux_code', type_champ: 'clop' as const },
    { nom_champ: 'com_taux', type_champ: 'decimal' as const },
    { nom_champ: 'pnet', type_champ: 'decimal' as const },
    { nom_champ: 'taxe', type_champ: 'decimal' as const },
    { nom_champ: 'ttc', type_champ: 'decimal' as const },
    { nom_champ: 'commission', type_champ: 'decimal' as const },
  ]) pat.ajouteChamp('qit', c);
  pat.definitCle('qit', ['qit_1']);

  new TableParamEditor(params).definit('tax', 'AUTO', 18);

  const frm = new FormuleEditor(params);
  frm.definitFormule('prime_nette', 'rn(0.01, $base * $prorata * ($bonus / 1000))');
  frm.definitFormule('bonus_malus', 'SI($responsable > 0 ? rn(10, $crm_prec * 1.25) : rn(10, $crm_prec * 0.95))');

  const scr = new EcranEditor(params, 'scr');
  scr.creerEcran('aax_qit', { table_liee: 'qit', template: '' });
  scr.placeWidget('aax_qit', 'base', { type_widget: 'decimal', type_champ: 'decimal' });
  scr.placeWidget('aax_qit', 'prorata', { type_widget: 'decimal', type_champ: 'decimal' });
  scr.placeWidget('aax_qit', 'bonus', { type_widget: 'integer', type_champ: 'integer' });
  scr.placeWidget('aax_qit', 'taux_code', { type_widget: 'text', type_champ: 'clop' });
  scr.placeWidget('aax_qit', 'com_taux', { type_widget: 'decimal', type_champ: 'decimal' });
  scr.placeWidget('aax_qit', 'pnet', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: '[prime_nette]', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'taxe', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: 'rn(0.01, $pnet * table("tax", $taux_code) / 100)', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'ttc', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: '$pnet + $taxe', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'commission', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: 'rn(0.01, $pnet * $com_taux / 100)', calcul_systematique: '1', est_lecture_seule: 1 });

  scr.creerEcran('aax_renouv', { table_liee: '', template: '' });
  scr.placeWidget('aax_renouv', 'crm_prec', { type_widget: 'integer', type_champ: 'integer' });
  scr.placeWidget('aax_renouv', 'responsable', { type_widget: 'integer', type_champ: 'integer' });
  scr.placeWidget('aax_renouv', 'crm', { type_widget: 'integer', type_champ: 'integer', formule_calcul: '[bonus_malus]', calcul_systematique: '1', est_lecture_seule: 1 });

  new DroitEditor(data).definitDroit('qit', 'commission', 5, 'P');
  return new R4({ data, paramR4: params });
}

const r4 = construitAssurance();
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

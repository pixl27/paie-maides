/**
 * PREUVE : on peut reconstruire l'application d'assurance EN LOW-CODE,
 * c'est-à-dire uniquement par des DONNÉES (patrons, écrans, formules, tables de
 * paramètres, droits) montées via les éditeurs du constructeur, puis exécutées
 * par le runtime générique — SANS écrire la moindre ligne de logique métier.
 *
 * Couvre : tiers (adr) + auto-incrément, contrat (con), CALCUL DE QUITTANCE
 * (prime nette bonus/malus + taxe via table de paramètres + commission), règle
 * de BONUS-MALUS (CRM), droits par champ, recherche « votre demande ».
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import { PatronEditor, EcranEditor, FormuleEditor, TableParamEditor, DroitEditor } from '../src/designer/index.js';

/** Monte une appli d'assurance uniquement avec les éditeurs low-code (aucun code métier). */
function construitAssuranceEnLowCode() {
  const data = new MemoryLayerStore();
  const params = new MemoryLayerStore().definePatron(
    creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }),
  );

  // --- 1) STRUCTURES (tables) définies à la souris (PatronEditor) ---
  const pat = new PatronEditor(data);
  pat.creerTable('adr', { emplacement: 'D' }); // tiers
  pat.ajouteChamp('adr', { nom_champ: 'adr_1', type_champ: 'integer', est_autoincrement: 1 });
  pat.ajouteChamp('adr', { nom_champ: 'adr_12', type_champ: 'string' }); // nom
  pat.ajouteChamp('adr', { nom_champ: 'adr_email', type_champ: 'string' });
  pat.definitCle('adr', ['adr_1']);

  pat.creerTable('qit', { emplacement: 'D' }); // quittance
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

  // --- 2) TABLES DE PARAMÈTRES (taux de taxe) : données, pas code ---
  const tab = new TableParamEditor(params);
  tab.definit('tax', 'AUTO', 18);
  tab.definit('tax', 'MRH', 9);

  // --- 3) FORMULES NOMMÉES (règles métier déclaratives) ---
  const frm = new FormuleEditor(params);
  // prime nette = base × prorata × (bonus/1000), arrondie au centime
  frm.definitFormule('prime_nette', 'rn(0.01, $base * $prorata * ($bonus / 1000))');
  // bonus-malus (CRM) : +25 % si sinistre responsable, sinon −5 %, arrondi à la dizaine
  frm.definitFormule('bonus_malus', 'SI($responsable > 0 ? rn(10, $crm_prec * 1.25) : rn(10, $crm_prec * 0.95))');

  // --- 4) ÉCRANS + WIDGETS avec FORMULES (le calcul de quittance, en données) ---
  const scr = new EcranEditor(params, 'scr');
  scr.creerEcran('aax_qit', { table_liee: 'qit', template: '$base $prorata $bonus $pnet $taxe $ttc $commission' });
  scr.placeWidget('aax_qit', 'base', { type_widget: 'decimal', type_champ: 'decimal' });
  scr.placeWidget('aax_qit', 'prorata', { type_widget: 'decimal', type_champ: 'decimal' });
  scr.placeWidget('aax_qit', 'bonus', { type_widget: 'integer', type_champ: 'integer' });
  scr.placeWidget('aax_qit', 'taux_code', { type_widget: 'text', type_champ: 'clop' });
  scr.placeWidget('aax_qit', 'com_taux', { type_widget: 'decimal', type_champ: 'decimal' });
  scr.placeWidget('aax_qit', 'pnet', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: '[prime_nette]', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'taxe', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: 'rn(0.01, $pnet * table("tax", $taux_code) / 100)', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'ttc', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: '$pnet + $taxe', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'commission', { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: 'rn(0.01, $pnet * $com_taux / 100)', calcul_systematique: '1', est_lecture_seule: 1 });

  // écran tiers (CRUD simple)
  scr.creerEcran('aax_adr', { table_liee: 'adr', template: '$adr_12 $adr_email' });
  scr.placeWidget('aax_adr', 'adr_12', { type_widget: 'text', type_champ: 'string', est_notnull: 1 });
  scr.placeWidget('aax_adr', 'adr_email', { type_widget: 'email', type_champ: 'string' });

  // écran renouvellement (bonus-malus) sans table : calcul pur
  scr.creerEcran('aax_renouv', { table_liee: '', template: '$crm' });
  scr.placeWidget('aax_renouv', 'crm_prec', { type_widget: 'integer', type_champ: 'integer' });
  scr.placeWidget('aax_renouv', 'responsable', { type_widget: 'integer', type_champ: 'integer' });
  scr.placeWidget('aax_renouv', 'crm', { type_widget: 'integer', type_champ: 'integer', formule_calcul: '[bonus_malus]', calcul_systematique: '1', est_lecture_seule: 1 });

  // --- 5) DROITS PAR CHAMP : la commission est masquée pour le niveau 5 ---
  const drt = new DroitEditor(data); // table 'drt' lue en couche data par appliqueDroits
  drt.definitDroit('qit', 'commission', 5, 'P');

  const r4 = new R4({ data, paramR4: params });
  return r4;
}

describe('PREUVE — reconstruction de l’assurance en low-code (données + formules, zéro code métier)', () => {
  let r4: R4;
  let admin: Runtime;
  beforeAll(() => {
    r4 = construitAssuranceEnLowCode();
    admin = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });
  });

  it('tiers : création avec auto-incrément (CRUD low-code)', () => {
    const a = admin.sauvegarde('aax_adr', [], { adr_12: 'Dupont', adr_email: 'dupont@x.fr' });
    const b = admin.sauvegarde('aax_adr', [], { adr_12: 'Martin', adr_email: 'martin@x.fr' });
    expect(a.zzz.cle).toEqual(['1']);
    expect(b.zzz.cle).toEqual(['2']);
    expect(admin.rechercheComplete('adr', 'dupont').map((r) => r.adr_12)).toEqual(['Dupont']);
  });

  it('QUITTANCE : prime nette (bonus/malus) + taxe (table param) + commission, calculées par formules', () => {
    const { zzz } = admin.sauvegarde('aax_qit', [], {
      base: '1000', prorata: '0.5', bonus: '950', taux_code: 'AUTO', com_taux: '10',
    });
    // prime nette = 1000 × 0,5 × 0,95 = 475
    expect(zzz.valeurs.pnet).toBe(475);
    // taxe AUTO = 18 % de 475 = 85,50  (taux lu dans la table de paramètres)
    expect(zzz.valeurs.taxe).toBe(85.5);
    // TTC = 475 + 85,50 = 560,50
    expect(zzz.valeurs.ttc).toBe(560.5);
    // commission = 10 % de 475 = 47,50
    expect(zzz.valeurs.commission).toBe(47.5);

    // persistance + relecture : les montants calculés sont bien stockés
    const relu = admin.visu('aax_qit', ['1']);
    expect(relu.valeurs.ttc).toBe(560.5);
  });

  it('produit MRH : la même définition donne une taxe différente (paramétrage, pas code)', () => {
    const { zzz } = admin.sauvegarde('aax_qit', [], { base: '200', prorata: '1', bonus: '1000', taux_code: 'MRH', com_taux: '5' });
    expect(zzz.valeurs.pnet).toBe(200); // 200 × 1 × 1
    expect(zzz.valeurs.taxe).toBe(18); // 9 % de 200
    expect(zzz.valeurs.ttc).toBe(218);
  });

  it('BONUS-MALUS (CRM) : règle réglementaire exprimée en formule low-code', () => {
    const malus = admin.postageSeul('aax_renouv', [], { crm_prec: '1000', responsable: '1' });
    expect(malus.zzz.valeurs.crm).toBe(1250); // +25 % après sinistre responsable
    const bonus = admin.postageSeul('aax_renouv', [], { crm_prec: '1000', responsable: '0' });
    expect(bonus.zzz.valeurs.crm).toBe(950); // −5 % sans sinistre
  });

  it('DROITS PAR CHAMP : la commission est masquée pour un agent (niveau 5)', () => {
    const agent = new Runtime(r4, { user: { login: 'agent', superAdmin: false, niveau: 5 } });
    const zzz = agent.visu('aax_qit', ['1']);
    expect(zzz.droits!.commission).toEqual({ ro: true, masque: true, droit: 'P' });
    // … alors qu'un admin la voit
    expect(admin.visu('aax_qit', ['1']).droits!.commission).toBeUndefined();
  });
});

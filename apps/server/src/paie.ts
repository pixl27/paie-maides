/**
 * Application de PAIE reconstruite EN LOW-CODE avec le constructeur maides-v2.
 *
 * Tout est PARAMÉTRÉ DANS MAIDES (aucune logique métier en TypeScript) :
 *  - tables (emp, sal, rub, bul) via PatronEditor ;
 *  - paramètres (PMSS, abattement CSG) via la table de paramètres `tx` ;
 *  - rubriques de cotisation via le catalogue `rub` (base, taux, déductibilité) ;
 *  - LE CALCUL est exprimé EN FORMULES MAIDES nommées (`frm`, éditables au Designer)
 *    qui AGRÈGENT le catalogue (`aggregate`) et lisent les paramètres (`table`).
 *
 * Le bulletin est donc entièrement dérivé de données + formules : modifier un taux,
 * une rubrique, un paramètre ou une formule change le résultat — sans toucher au code.
 */

import { join } from 'node:path';
import {
  R4, MemoryLayerStore, Runtime, creerPatron,
  PatronEditor, EcranEditor, TableParamEditor, FormuleEditor, DroitEditor,
  type MenuEntry, type TypeChamp,
} from '@maides/core';
import { FileLayerStore } from './file-store.js';

/** Une rubrique de cotisation : base (brut|plafond|base_csg) + taux + code de seed. */
interface Cotisation { base: 'brut' | 'plafond' | 'base_csg'; code: string; libelle: string; }

const COT_SAL: Cotisation[] = [
  { base: 'plafond', code: 'VIP_SAL', libelle: 'Assurance vieillesse plafonnée' },
  { base: 'brut', code: 'VID_SAL', libelle: 'Assurance vieillesse déplafonnée' },
  { base: 'plafond', code: 'RCT1_SAL', libelle: 'Retraite complémentaire T1' },
  { base: 'plafond', code: 'CEG_SAL', libelle: 'Contribution équilibre général' },
  { base: 'base_csg', code: 'CSGD_SAL', libelle: 'CSG déductible' },
  { base: 'base_csg', code: 'CSGND_SAL', libelle: 'CSG/CRDS non déductible' },
];
const COT_PAT: Cotisation[] = [
  { base: 'brut', code: 'MAL_PAT', libelle: 'Maladie' },
  { base: 'plafond', code: 'VIP_PAT', libelle: 'Vieillesse plafonnée' },
  { base: 'brut', code: 'VID_PAT', libelle: 'Vieillesse déplafonnée' },
  { base: 'brut', code: 'ALLOC_PAT', libelle: 'Allocations familiales' },
  { base: 'brut', code: 'CHOM_PAT', libelle: 'Assurance chômage' },
  { base: 'brut', code: 'AGS_PAT', libelle: 'AGS' },
  { base: 'plafond', code: 'RCT1_PAT', libelle: 'Retraite complémentaire T1' },
  { base: 'plafond', code: 'CEG_PAT', libelle: 'Contribution équilibre général' },
  { base: 'brut', code: 'AT_PAT', libelle: 'Accident du travail' },
];

/** Barème simplifié 2024 (taux en %, PMSS €, abattement CSG). */
const TAUX: Record<string, number> = {
  PMSS: 3864, ABATT_CSG: 0.9825,
  VIP_SAL: 6.90, VIP_PAT: 8.55, VID_SAL: 0.40, VID_PAT: 2.02,
  MAL_PAT: 7.00, ALLOC_PAT: 3.45, CHOM_PAT: 4.05, AGS_PAT: 0.25,
  RCT1_SAL: 3.15, RCT1_PAT: 4.72, CEG_SAL: 0.86, CEG_PAT: 1.29,
  CSGD_SAL: 6.80, CSGND_SAL: 2.90, AT_PAT: 1.50,
};

/**
 * Construit l'application de paie. Si `dossier` est fourni, les données et le
 * paramétrage sont PERSISTÉS sur disque (JSON) et rechargés au démarrage ; sinon
 * tout est en mémoire (tests/démo). Le paramétrage et les données d'exemple ne
 * sont créés qu'au PREMIER lancement (ensuite on recharge ce qui est sur disque).
 */
export function construitPaie(dossier?: string): { r4: R4; params: MemoryLayerStore; menuEntries: MenuEntry[] } {
  const data: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'paie-data.json')) : new MemoryLayerStore();
  const params: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'paie-params.json')) : new MemoryLayerStore();
  if (!params.loadPatron('scr')) params.definePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));
  if (!params.loadPatron('let')) params.definePatron(creerPatron('let', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));

  const r4 = new R4({ data, paramR4: params });
  const menus: MenuEntry[] = [
    { menu_position: 'p000', menu_libelle: 'Paie' },
    { menu_position: 'p100', menu_libelle: 'Salariés', menu_script: '/paie_sals?o=1&b=' },
    { menu_position: 'p200', menu_libelle: 'Rubriques', menu_script: '/paie_rubs?o=1&b=' },
    { menu_position: 'p300', menu_libelle: 'Bulletins de paie', menu_script: '/paie_buls?o=1&b=' },
  ];

  // Déjà installé (relance avec persistance) ? on recharge sans rien reconstruire.
  if (data.loadPatron('bul')) return { r4, params, menuEntries: menus };

  const pat = new PatronEditor(data);

  // --- Employeur (client) ---
  pat.creerTable('emp', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'emp_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'raison_sociale', type_champ: 'string' as TypeChamp },
    { nom_champ: 'siret', type_champ: 'string' as TypeChamp },
    { nom_champ: 'adresse', type_champ: 'string' as TypeChamp },
    { nom_champ: 'cp', type_champ: 'string' as TypeChamp },
    { nom_champ: 'ville', type_champ: 'string' as TypeChamp },
    { nom_champ: 'conv_collective', type_champ: 'string' as TypeChamp },
  ]) pat.ajouteChamp('emp', c);
  pat.definitCle('emp', ['emp_1']);

  // --- Salarié ---
  pat.creerTable('sal', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'sal_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'emp_id', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'matricule', type_champ: 'string' as TypeChamp },
    { nom_champ: 'nom', type_champ: 'string' as TypeChamp },
    { nom_champ: 'prenom', type_champ: 'string' as TypeChamp },
    { nom_champ: 'nir', type_champ: 'string' as TypeChamp },
    { nom_champ: 'date_embauche', type_champ: 'date' as TypeChamp },
    { nom_champ: 'statut', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'contrat', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'salaire_base', type_champ: 'decimal' as TypeChamp },
  ]) pat.ajouteChamp('sal', c);
  pat.definitCle('sal', ['sal_1']);

  // --- Catalogue de rubriques de cotisation (PARAMÉTRABLE) ---
  pat.creerTable('rub', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'rub_code', type_champ: 'clop' as TypeChamp, est_cle: 1, ordre_cle: 1 },
    { nom_champ: 'libelle', type_champ: 'string' as TypeChamp },
    { nom_champ: 'base_type', type_champ: 'clop' as TypeChamp },      // brut | plafond | base_csg
    { nom_champ: 'tx_sal', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'tx_pat', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'non_deductible', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'ordre', type_champ: 'integer' as TypeChamp },
  ]) pat.ajouteChamp('rub', c);
  pat.definitCle('rub', ['rub_code']);

  // --- Bulletin de paie ---
  pat.creerTable('bul', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'bul_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'sal_id', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'periode', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'salaire_base', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'heures_sup', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'taux_hs', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'primes', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'brut', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'plafond', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'base_csg', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'total_cot_sal', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'net_a_payer', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'net_imposable', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'total_cot_pat', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'cout_employeur', type_champ: 'decimal' as TypeChamp },
  ]) pat.ajouteChamp('bul', c);
  pat.definitCle('bul', ['bul_1']);

  // --- Paramètres globaux (éditables au Designer > Tables de paramètres) ---
  const tx = new TableParamEditor(params);
  tx.definit('tx', 'PMSS', TAUX.PMSS);
  tx.definit('tx', 'ABATT_CSG', TAUX.ABATT_CSG);

  // --- LE CALCUL, EN FORMULES MAIDES NOMMÉES (éditables au Designer > Formules) ---
  // Les cotisations sont AGRÉGÉES depuis le catalogue `rub` par base (aggregate).
  const aggSal = (base: string) => `aggregate("somme","rub","tx_sal","base_type = '${base}'")`;
  const aggPat = (base: string) => `aggregate("somme","rub","tx_pat","base_type = '${base}'")`;
  const frm = new FormuleEditor(params);
  frm.definitFormule('brut', 'rn(0.01, $salaire_base + $heures_sup * $taux_hs + $primes)'); // GAINS (éditable)
  frm.definitFormule('plafond', 'min([brut], table("tx","PMSS"))');
  frm.definitFormule('base_csg', 'rn(0.01, [brut] * table("tx","ABATT_CSG"))');
  frm.definitFormule('cot_sal', `rn(0.01, [brut] * ${aggSal('brut')} / 100 + [plafond] * ${aggSal('plafond')} / 100 + [base_csg] * ${aggSal('base_csg')} / 100)`);
  frm.definitFormule('cot_pat', `rn(0.01, [brut] * ${aggPat('brut')} / 100 + [plafond] * ${aggPat('plafond')} / 100 + [base_csg] * ${aggPat('base_csg')} / 100)`);
  frm.definitFormule('net_ap', '[brut] - [cot_sal]');
  frm.definitFormule('reintegre', 'rn(0.01, [base_csg] * aggregate("somme","rub","tx_sal","non_deductible = 1") / 100)');
  frm.definitFormule('net_imp', '[net_ap] + [reintegre]');
  frm.definitFormule('cout_emp', '[brut] + [cot_pat]');

  // --- Écrans ---
  const scr = new EcranEditor(params, 'scr');

  scr.creerEcran('paie_emp', { table_liee: 'emp', template: 'Raison sociale $raison_sociale<br/>SIRET $siret<br/>Adresse $adresse<br/>$cp $ville<br/>Convention $conv_collective' });
  scr.placeWidget('paie_emp', 'raison_sociale', { type_widget: 'text', type_champ: 'string', libelle: 'Raison sociale', est_notnull: 1 });
  scr.placeWidget('paie_emp', 'siret', { type_widget: 'text', type_champ: 'string', libelle: 'SIRET' });
  scr.placeWidget('paie_emp', 'adresse', { type_widget: 'text', type_champ: 'string', libelle: 'Adresse' });
  scr.placeWidget('paie_emp', 'cp', { type_widget: 'text', type_champ: 'string', libelle: 'Code postal' });
  scr.placeWidget('paie_emp', 'ville', { type_widget: 'text', type_champ: 'string', libelle: 'Ville' });
  scr.placeWidget('paie_emp', 'conv_collective', { type_widget: 'text', type_champ: 'string', libelle: 'Convention collective' });

  scr.creerEcran('paie_sal', { table_liee: 'sal', template: 'Employeur n° $emp_id<br/>Matricule $matricule<br/>Nom $nom Prénom $prenom<br/>NIR $nir<br/>Embauche $date_embauche<br/>Statut $statut Contrat $contrat<br/>Salaire de base $salaire_base' });
  scr.placeWidget('paie_sal', 'emp_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'Employeur (n°)' });
  scr.placeWidget('paie_sal', 'matricule', { type_widget: 'text', type_champ: 'string', libelle: 'Matricule' });
  scr.placeWidget('paie_sal', 'nom', { type_widget: 'text', type_champ: 'string', libelle: 'Nom', est_notnull: 1 });
  scr.placeWidget('paie_sal', 'prenom', { type_widget: 'text', type_champ: 'string', libelle: 'Prénom' });
  scr.placeWidget('paie_sal', 'nir', { type_widget: 'text', type_champ: 'string', libelle: 'N° sécurité sociale' });
  scr.placeWidget('paie_sal', 'date_embauche', { type_widget: 'date', type_champ: 'date', libelle: 'Date d’embauche' });
  scr.placeWidget('paie_sal', 'statut', { type_widget: 'text', type_champ: 'clop', libelle: 'Statut (cadre/non-cadre)' });
  scr.placeWidget('paie_sal', 'contrat', { type_widget: 'text', type_champ: 'clop', libelle: 'Contrat (CDI/CDD)' });
  scr.placeWidget('paie_sal', 'salaire_base', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Salaire de base mensuel (brut)' });

  scr.creerEcran('paie_rub', { table_liee: 'rub', template: 'Code $rub_code<br/>Libellé $libelle<br/>Base $base_type<br/>Taux salarial $tx_sal Taux patronal $tx_pat<br/>Non déductible $non_deductible' });
  scr.placeWidget('paie_rub', 'rub_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code', est_notnull: 1 });
  scr.placeWidget('paie_rub', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('paie_rub', 'base_type', { type_widget: 'text', type_champ: 'clop', libelle: 'Base (brut/plafond/base_csg)' });
  scr.placeWidget('paie_rub', 'tx_sal', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux salarial %' });
  scr.placeWidget('paie_rub', 'tx_pat', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux patronal %' });
  scr.placeWidget('paie_rub', 'non_deductible', { type_widget: 'integer', type_champ: 'integer', libelle: 'Réintégré au net imposable (0/1)' });

  // --- Listes (cliquables) : point d'entrée pour AJOUTER / OUVRIR / SUPPRIMER ---
  scr.creerEcran('paie_sals', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/paie_sal?o=8&b=">+ Nouveau salarié</a></div>$liste' });
  scr.placeWidget('paie_sals', 'liste', { type_widget: 'selectList', option_type_widget: 'table=sal\necran=paie_sal\ncols=matricule:Matricule;nom:Nom;prenom:Prénom;salaire_base:Salaire de base' });

  scr.creerEcran('paie_rubs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/paie_rub?o=8&b=">+ Nouvelle rubrique</a></div>$liste' });
  scr.placeWidget('paie_rubs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=rub\necran=paie_rub\ncols=rub_code:Code;libelle:Libellé;base_type:Base;tx_sal:Taux salarial;tx_pat:Taux patronal' });

  scr.creerEcran('paie_buls', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/paie_bul?o=8&b=">+ Nouveau bulletin</a></div>$liste' });
  scr.placeWidget('paie_buls', 'liste', { type_widget: 'selectList', option_type_widget: 'table=bul\necran=paie_bul\ncols=bul_1:N°;periode:Période;sal_id:Salarié;brut:Brut;net_a_payer:Net à payer' });

  // --- Écran BULLETIN : saisies + résultats 100% calculés par les formules maides ---
  const calc = (nom: string, libelle: string) => ({ type_widget: 'decimal', type_champ: 'decimal' as TypeChamp, libelle, formule_calcul: `[${nom}]`, calcul_systematique: '1', est_lecture_seule: 1 });
  scr.creerEcran('paie_bul', { table_liee: 'bul', template: '' });
  scr.placeWidget('paie_bul', 'sal_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'Salarié (n°)' });
  scr.placeWidget('paie_bul', 'periode', { type_widget: 'text', type_champ: 'clop', libelle: 'Période (AAAAMM)' });
  scr.placeWidget('paie_bul', 'salaire_base', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Salaire de base (brut)' });
  scr.placeWidget('paie_bul', 'heures_sup', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Heures supplémentaires' });
  scr.placeWidget('paie_bul', 'taux_hs', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux horaire majoré' });
  scr.placeWidget('paie_bul', 'primes', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Primes' });
  scr.placeWidget('paie_bul', 'brut', calc('brut', 'Salaire brut'));
  scr.placeWidget('paie_bul', 'plafond', calc('plafond', 'Plafond SS (tranche A)'));
  scr.placeWidget('paie_bul', 'base_csg', calc('base_csg', 'Base CSG/CRDS'));
  scr.placeWidget('paie_bul', 'total_cot_sal', calc('cot_sal', 'Total cotisations salariales'));
  scr.placeWidget('paie_bul', 'net_a_payer', calc('net_ap', 'Net à payer'));
  scr.placeWidget('paie_bul', 'net_imposable', calc('net_imp', 'Net imposable'));
  scr.placeWidget('paie_bul', 'total_cot_pat', calc('cot_pat', 'Total cotisations patronales'));
  scr.placeWidget('paie_bul', 'cout_employeur', calc('cout_emp', 'Coût total employeur'));

  // --- Bulletin imprimable (lettre / PDF) ---
  const let_ = new EcranEditor(params, 'let');
  let_.creerEcran('paie_bulletin_pdf', {
    table_liee: 'bul',
    template:
      'BULLETIN DE PAIE<br/>Salarié n° $sal_id — Période $periode<br/><hr/>'
      + 'Salaire brut : $brut<br/>Plafond SS : $plafond<br/>Base CSG : $base_csg<br/><hr/>'
      + 'Total cotisations salariales : $total_cot_sal<br/>'
      + '<b>Net à payer : $net_a_payer</b><br/>Net imposable : $net_imposable<br/><hr/>'
      + 'Total cotisations patronales : $total_cot_pat<br/>Coût total employeur : $cout_employeur',
  });

  // --- Droits : le coût employeur n'est visible que par les niveaux privilégiés ---
  new DroitEditor(data).definitDroit('bul', 'cout_employeur', 5, 'P');

  // --- Données d'exemple (1er lancement uniquement ; via le runtime générique) ---
  const seed = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });
  seed.sauvegarde('paie_emp', [], { raison_sociale: 'ACME SARL', siret: '12345678900012', adresse: '1 rue des Lilas', cp: '75001', ville: 'Paris', conv_collective: 'Syntec' });
  seed.sauvegarde('paie_sal', [], { emp_id: '1', matricule: 'M001', nom: 'Dupont', prenom: 'Jean', statut: 'non-cadre', contrat: 'CDI', salaire_base: '3000' });
  seed.sauvegarde('paie_sal', [], { emp_id: '1', matricule: 'M002', nom: 'Martin', prenom: 'Alice', statut: 'cadre', contrat: 'CDI', salaire_base: '2500' });
  // catalogue des cotisations (référentiel éditable)
  const rubs: Record<string, any>[] = [
    ...COT_SAL.map((c, i) => ({ rub_code: c.code, libelle: c.libelle, base_type: c.base, tx_sal: String(TAUX[c.code]), tx_pat: '0', non_deductible: c.code === 'CSGND_SAL' ? '1' : '0', ordre: String(100 + i) })),
    ...COT_PAT.map((c, i) => ({ rub_code: c.code, libelle: c.libelle, base_type: c.base, tx_sal: '0', tx_pat: String(TAUX[c.code]), non_deductible: '0', ordre: String(200 + i) })),
  ];
  for (const r of rubs) seed.sauvegarde('paie_rub', [], r);
  // un bulletin pour Dupont (3000) — calculé par les formules à l'enregistrement
  seed.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202406', salaire_base: '3000', heures_sup: '0', taux_hs: '0', primes: '0' });

  return { r4, params, menuEntries: menus };
}

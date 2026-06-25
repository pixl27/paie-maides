/**
 * Application de COMPTABILITÉ (en partie double) reconstruite EN LOW-CODE avec le
 * constructeur Maxima (ex-maides). Tout est PARAMÉTRÉ DANS LES DONNÉES :
 *  - tables (jal, cpt, trs, ecr, lig, res) via PatronEditor ;
 *  - écrans + listes via EcranEditor ;
 *  - LES TOTAUX sont exprimés EN FORMULES nommées (`frm`, éditables au Designer)
 *    qui AGRÈGENT les lignes (`aggregate`) — équilibre d'une écriture, solde d'un
 *    compte, résultat (produits − charges).
 *
 * Comptabilité = pièces (écritures) composées de lignes débit/crédit imputées à
 * des comptes du plan comptable. Une écriture est équilibrée si Σ débit = Σ crédit.
 * Le solde d'un compte = Σ débit − Σ crédit de ses lignes. Tout est recalculé à
 * l'affichage (visu lance le formulage) : aucune donnée dérivée n'est figée.
 */

import { join } from 'node:path';
import {
  R4, MemoryLayerStore, Runtime, creerPatron,
  PatronEditor, EcranEditor, TableParamEditor, FormuleEditor,
  type MenuEntry, type TypeChamp,
} from '@maides/core';
import { FileLayerStore } from './file-store.js';

/** Plan comptable de démonstration (PCG simplifié, numéros à 6 chiffres). */
const PLAN: { num: string; libelle: string; classe: number }[] = [
  { num: '101000', libelle: 'Capital', classe: 1 },
  { num: '164000', libelle: 'Emprunts auprès des établissements de crédit', classe: 1 },
  { num: '218000', libelle: 'Autres immobilisations corporelles', classe: 2 },
  { num: '401000', libelle: 'Fournisseurs', classe: 4 },
  { num: '411000', libelle: 'Clients', classe: 4 },
  { num: '445660', libelle: 'TVA déductible sur autres biens et services', classe: 4 },
  { num: '445710', libelle: 'TVA collectée', classe: 4 },
  { num: '512000', libelle: 'Banque', classe: 5 },
  { num: '530000', libelle: 'Caisse', classe: 5 },
  { num: '606300', libelle: 'Fournitures d’entretien et petit équipement', classe: 6 },
  { num: '607000', libelle: 'Achats de marchandises', classe: 6 },
  { num: '627000', libelle: 'Services bancaires et assimilés', classe: 6 },
  { num: '706000', libelle: 'Prestations de services', classe: 7 },
  { num: '707000', libelle: 'Ventes de marchandises', classe: 7 },
];

/** Journaux comptables de démonstration. */
const JOURNAUX: { code: string; libelle: string; type: string }[] = [
  { code: 'AC', libelle: 'Achats', type: 'achat' },
  { code: 'VE', libelle: 'Ventes', type: 'vente' },
  { code: 'BQ', libelle: 'Banque', type: 'tresorerie' },
  { code: 'CA', libelle: 'Caisse', type: 'tresorerie' },
  { code: 'OD', libelle: 'Opérations diverses', type: 'od' },
];

/**
 * Construit l'application de comptabilité. Si `dossier` est fourni, données et
 * paramétrage sont PERSISTÉS (JSON) et rechargés au démarrage ; sinon tout est en
 * mémoire (tests/démo). Le référentiel et les exemples ne sont créés qu'au PREMIER
 * lancement (ensuite on recharge le disque).
 */
export function construitCompta(dossier?: string): { r4: R4; params: MemoryLayerStore; menuEntries: MenuEntry[] } {
  const data: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'compta-data.json')) : new MemoryLayerStore();
  const params: MemoryLayerStore = dossier ? new FileLayerStore(join(dossier, 'compta-params.json')) : new MemoryLayerStore();
  if (!params.loadPatron('scr')) params.definePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));
  if (!params.loadPatron('let')) params.definePatron(creerPatron('let', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));

  const r4 = new R4({ data, paramR4: params });
  const menus: MenuEntry[] = [
    { menu_position: 'p000', menu_libelle: 'Comptabilité' },
    { menu_position: 'p100', menu_libelle: 'Écritures', menu_script: '/compta_ecrs?o=1&b=' },
    { menu_position: 'p120', menu_libelle: 'Factures', menu_script: '/compta_facs?o=1&b=' },
    { menu_position: 'p140', menu_libelle: 'Échéancier', menu_script: '/compta_echeancier?o=1&b=' },
    { menu_position: 'p160', menu_libelle: 'Règlements', menu_script: '/compta_regs?o=1&b=' },
    { menu_position: 'p200', menu_libelle: 'Journal général', menu_script: '/compta_ligs?o=1&b=' },
    { menu_position: 'p300', menu_libelle: 'Plan comptable / Balance', menu_script: '/compta_cpts?o=1&b=' },
    { menu_position: 'p400', menu_libelle: 'Tiers', menu_script: '/compta_trss?o=1&b=' },
    { menu_position: 'p500', menu_libelle: 'Journaux', menu_script: '/compta_jals?o=1&b=' },
    { menu_position: 'p600', menu_libelle: 'Compte de résultat', menu_script: '/compta_resultat?o=1&b=1' },
    { menu_position: 'p650', menu_libelle: 'Bilan', menu_script: '/compta_bilan?o=1&b=1' },
    { menu_position: 'p700', menu_libelle: 'Déclaration de TVA', menu_script: '/compta_tva?o=1&b=1' },
  ];

  // Déjà installé (relance avec persistance) ? on recharge sans rien reconstruire.
  if (data.loadPatron('lig')) return { r4, params, menuEntries: menus };

  const pat = new PatronEditor(data);

  // --- Journaux ---
  pat.creerTable('jal', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'jal_code', type_champ: 'clop' as TypeChamp, est_cle: 1, ordre_cle: 1 },
    { nom_champ: 'libelle', type_champ: 'string' as TypeChamp },
    { nom_champ: 'type', type_champ: 'clop' as TypeChamp },
  ]) pat.ajouteChamp('jal', c);
  pat.definitCle('jal', ['jal_code']);

  // --- Plan comptable (comptes) ---
  pat.creerTable('cpt', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'cpt_num', type_champ: 'clop' as TypeChamp, est_cle: 1, ordre_cle: 1 },
    { nom_champ: 'libelle', type_champ: 'string' as TypeChamp },
    { nom_champ: 'classe', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'total_debit', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'total_credit', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'solde', type_champ: 'decimal' as TypeChamp },
  ]) pat.ajouteChamp('cpt', c);
  pat.definitCle('cpt', ['cpt_num']);

  // --- Tiers (clients / fournisseurs) ---
  pat.creerTable('trs', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'trs_code', type_champ: 'clop' as TypeChamp, est_cle: 1, ordre_cle: 1 },
    { nom_champ: 'nom', type_champ: 'string' as TypeChamp },
    { nom_champ: 'type', type_champ: 'clop' as TypeChamp },        // client | fournisseur
    { nom_champ: 'compte', type_champ: 'clop' as TypeChamp },      // compte de rattachement
  ]) pat.ajouteChamp('trs', c);
  pat.definitCle('trs', ['trs_code']);

  // --- Écritures (pièces comptables) ---
  pat.creerTable('ecr', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'ecr_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'date_ecr', type_champ: 'date' as TypeChamp },
    { nom_champ: 'jal_code', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'piece', type_champ: 'string' as TypeChamp },
    { nom_champ: 'libelle', type_champ: 'string' as TypeChamp },
    { nom_champ: 'statut', type_champ: 'clop' as TypeChamp },        // brouillard | validé
    { nom_champ: 'total_debit', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'total_credit', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'equilibre', type_champ: 'decimal' as TypeChamp },
  ]) pat.ajouteChamp('ecr', c);
  pat.definitCle('ecr', ['ecr_1']);

  // --- Lignes d'écriture (imputations débit/crédit) ---
  pat.creerTable('lig', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'lig_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'ecr_id', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'date_ecr', type_champ: 'date' as TypeChamp },
    { nom_champ: 'jal_code', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'compte', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'trs_code', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'libelle', type_champ: 'string' as TypeChamp },
    { nom_champ: 'debit', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'credit', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'classe', type_champ: 'integer' as TypeChamp },   // classe PCG (1er chiffre du compte), calculée
  ]) pat.ajouteChamp('lig', c);
  pat.definitCle('lig', ['lig_1']);

  // --- Table mono-enregistrement pour le compte de résultat ---
  pat.creerTable('res', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'res_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'exercice', type_champ: 'string' as TypeChamp },
    { nom_champ: 'charges', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'produits', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'resultat', type_champ: 'decimal' as TypeChamp },
    // bilan (masses, net par classe)
    { nom_champ: 'b_immo', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'b_stocks', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'b_tiers', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'b_treso', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'b_actif', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'b_capx', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'b_passif', type_champ: 'decimal' as TypeChamp },
    // déclaration de TVA
    { nom_champ: 't_col', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 't_ded', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 't_due', type_champ: 'decimal' as TypeChamp },
  ]) pat.ajouteChamp('res', c);
  pat.definitCle('res', ['res_1']);

  // --- Factures (clients/fournisseurs) ---
  pat.creerTable('fac', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'fac_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'type', type_champ: 'clop' as TypeChamp },         // vente | achat
    { nom_champ: 'trs_code', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'numero', type_champ: 'string' as TypeChamp },
    { nom_champ: 'date_fac', type_champ: 'date' as TypeChamp },
    { nom_champ: 'date_ech', type_champ: 'date' as TypeChamp },
    { nom_champ: 'ht', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'tva_taux', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'tva', type_champ: 'decimal' as TypeChamp },        // calc
    { nom_champ: 'ttc', type_champ: 'decimal' as TypeChamp },        // calc
    { nom_champ: 'regle', type_champ: 'decimal' as TypeChamp },      // calc (Σ règlements)
    { nom_champ: 'solde', type_champ: 'decimal' as TypeChamp },      // calc (TTC − réglé) ; 0 = lettrée
  ]) pat.ajouteChamp('fac', c);
  pat.definitCle('fac', ['fac_1']);

  // --- Règlements (rattachés à une facture) ---
  pat.creerTable('reg', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'reg_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'fac_id', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'date_reg', type_champ: 'date' as TypeChamp },
    { nom_champ: 'montant', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'mode', type_champ: 'clop' as TypeChamp },          // virement | chèque | espèces | CB
  ]) pat.ajouteChamp('reg', c);
  pat.definitCle('reg', ['reg_1']);

  // --- Paramètres (TVA) éditables au Designer ---
  new TableParamEditor(params).definit('tx', 'TVA', 20);

  // --- LES TOTAUX, EN FORMULES NOMMÉES (éditables au Designer > Formules) ---
  // Filtres dynamiques construits par concaténation : "ecr_id = " + n° courant.
  const frm = new FormuleEditor(params);
  // Classe PCG d'une ligne = 1er chiffre du n° de compte, robuste quelle que soit
  // la longueur (sous-comptes 6+ chiffres) : classe = compte / 10^(nb_chiffres-1).
  // nb_chiffres = LONGUEUR de la chaîne du nombre (taille(chaine(...))) : compte EXACT,
  // sans ln ni epsilon. Évite le bug du log (ex. 999999999 lu à 9 chiffres + ε → classe 0
  // au lieu de 9) ET la division par zéro sur compte vide (taille("0")=1 ⇒ 10^0=1 ⇒ classe 0).
  frm.definitFormule('lig_classe', 'int( int($compte) / (10 ^ (taille(chaine(int($compte))) - 1)) )');
  // Équilibre d'une écriture = Σ débit − Σ crédit de SES lignes (0 = équilibrée).
  frm.definitFormule('ecr_tdeb', 'rn(0.01, aggregate("somme","lig","debit","ecr_id = " + $ecr_1))');
  frm.definitFormule('ecr_tcred', 'rn(0.01, aggregate("somme","lig","credit","ecr_id = " + $ecr_1))');
  frm.definitFormule('ecr_eq', 'rn(0.01, [ecr_tdeb] - [ecr_tcred])');
  // Solde d'un compte = Σ débit − Σ crédit de SES lignes (>0 débiteur, <0 créditeur).
  frm.definitFormule('cpt_deb', 'rn(0.01, aggregate("somme","lig","debit","compte = " + $cpt_num))');
  frm.definitFormule('cpt_cred', 'rn(0.01, aggregate("somme","lig","credit","compte = " + $cpt_num))');
  frm.definitFormule('cpt_sld', 'rn(0.01, [cpt_deb] - [cpt_cred])');
  // Compte de résultat : SOLDE NET par classe (gère les avoirs / contre-passations).
  // Charge nette (classe 6) = Σ débit − Σ crédit ; produit net (classe 7) = Σ crédit − Σ débit.
  frm.definitFormule('res_ch', 'rn(0.01, aggregate("somme","lig","debit","classe = 6") - aggregate("somme","lig","credit","classe = 6"))');
  frm.definitFormule('res_pr', 'rn(0.01, aggregate("somme","lig","credit","classe = 7") - aggregate("somme","lig","debit","classe = 7"))');
  frm.definitFormule('res_net', 'rn(0.01, [res_pr] - [res_ch])');
  // BILAN par MASSES (net par classe) — ROBUSTE : ACTIF = soldes nets débiteurs des
  // classes 2,3,4,5 ; PASSIF = capitaux (classe 1, net créditeur) + résultat.
  // Identité comptable : (cl2+cl3+cl4+cl5)(D−C) ≡ cl1(C−D) + résultat ⇒ actif = passif TOUJOURS.
  frm.definitFormule('bil_immo', 'rn(0.01, aggregate("somme","lig","debit","classe = 2") - aggregate("somme","lig","credit","classe = 2"))');
  frm.definitFormule('bil_stocks', 'rn(0.01, aggregate("somme","lig","debit","classe = 3") - aggregate("somme","lig","credit","classe = 3"))');
  frm.definitFormule('bil_tiers', 'rn(0.01, aggregate("somme","lig","debit","classe = 4") - aggregate("somme","lig","credit","classe = 4"))');
  frm.definitFormule('bil_treso', 'rn(0.01, aggregate("somme","lig","debit","classe = 5") - aggregate("somme","lig","credit","classe = 5"))');
  frm.definitFormule('bil_actif', 'rn(0.01, [bil_immo] + [bil_stocks] + [bil_tiers] + [bil_treso])');
  frm.definitFormule('bil_capx', 'rn(0.01, aggregate("somme","lig","credit","classe = 1") - aggregate("somme","lig","debit","classe = 1"))');
  frm.definitFormule('bil_passif', 'rn(0.01, [bil_capx] + [res_net])');
  // DÉCLARATION DE TVA : collectée (445710) − déductible (445660) = TVA à décaisser.
  frm.definitFormule('tva_col', 'rn(0.01, aggregate("somme","lig","credit","compte = 445710") - aggregate("somme","lig","debit","compte = 445710"))');
  frm.definitFormule('tva_ded', 'rn(0.01, aggregate("somme","lig","debit","compte = 445660") - aggregate("somme","lig","credit","compte = 445660"))');
  frm.definitFormule('tva_due', 'rn(0.01, [tva_col] - [tva_ded])');
  // FACTURATION : TVA, TTC, montant réglé (Σ règlements de CETTE facture), solde restant dû.
  frm.definitFormule('fac_tva', 'rn(0.01, $ht * $tva_taux / 100)');
  frm.definitFormule('fac_ttc', 'rn(0.01, $ht + [fac_tva])');
  frm.definitFormule('fac_regle', 'rn(0.01, aggregate("somme","reg","montant","fac_id = " + $fac_1))');
  frm.definitFormule('fac_solde', 'rn(0.01, [fac_ttc] - [fac_regle])');

  const calc = (nom: string, libelle: string) => ({ type_widget: 'decimal', type_champ: 'decimal' as TypeChamp, libelle, formule_calcul: `[${nom}]`, calcul_systematique: '1', est_lecture_seule: 1 });

  // --- Écrans ---
  const scr = new EcranEditor(params, 'scr');

  // Journaux : fiche + liste
  scr.creerEcran('compta_jal', { table_liee: 'jal', template: 'Code $jal_code<br/>Libellé $libelle<br/>Type $type' });
  scr.placeWidget('compta_jal', 'jal_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code journal', est_notnull: 1 });
  scr.placeWidget('compta_jal', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_jal', 'type', { type_widget: 'text', type_champ: 'clop', libelle: 'Type (achat/vente/tresorerie/od)' });
  scr.creerEcran('compta_jals', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_jal?o=8&b=">+ Nouveau journal</a></div>$liste' });
  scr.placeWidget('compta_jals', 'liste', { type_widget: 'selectList', option_type_widget: 'table=jal\necran=compta_jal\ncols=jal_code:Code;libelle:Libellé;type:Type' });

  // Tiers : fiche + liste
  scr.creerEcran('compta_trs', { table_liee: 'trs', template: 'Code $trs_code<br/>Nom $nom<br/>Type $type<br/>Compte de rattachement $compte' });
  scr.placeWidget('compta_trs', 'trs_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code tiers', est_notnull: 1 });
  scr.placeWidget('compta_trs', 'nom', { type_widget: 'text', type_champ: 'string', libelle: 'Nom / raison sociale' });
  scr.placeWidget('compta_trs', 'type', { type_widget: 'text', type_champ: 'clop', libelle: 'Type (client/fournisseur)' });
  scr.placeWidget('compta_trs', 'compte', { type_widget: 'text', type_champ: 'clop', libelle: 'Compte (411/401…)' });
  scr.creerEcran('compta_trss', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_trs?o=8&b=">+ Nouveau tiers</a></div>$liste' });
  scr.placeWidget('compta_trss', 'liste', { type_widget: 'selectList', option_type_widget: 'table=trs\necran=compta_trs\ncols=trs_code:Code;nom:Nom;type:Type;compte:Compte' });

  // Plan comptable : fiche (avec SOLDE calculé) + liste = balance (cliquer un compte montre son solde)
  scr.creerEcran('compta_cpt', { table_liee: 'cpt', template: 'Compte $cpt_num<br/>Libellé $libelle<br/>Classe $classe<hr/>Total débit $total_debit — Total crédit $total_credit<br/><b>Solde $solde</b><hr/><h2>Grand livre du compte</h2>$grandlivre' });
  scr.placeWidget('compta_cpt', 'cpt_num', { type_widget: 'text', type_champ: 'clop', libelle: 'N° de compte', est_notnull: 1 });
  scr.placeWidget('compta_cpt', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_cpt', 'classe', { type_widget: 'integer', type_champ: 'integer', libelle: 'Classe (1-7)' });
  scr.placeWidget('compta_cpt', 'total_debit', calc('cpt_deb', 'Total débit'));
  scr.placeWidget('compta_cpt', 'total_credit', calc('cpt_cred', 'Total crédit'));
  scr.placeWidget('compta_cpt', 'solde', calc('cpt_sld', 'Solde (débiteur si > 0)'));
  // Grand livre : mouvements de CE compte (filtre dynamique compte = $cpt_num)
  scr.placeWidget('compta_cpt', 'grandlivre', { type_widget: 'selectList', option_type_widget: 'table=lig\nfiltre=compte = $cpt_num\necran=compta_lig\ncols=ecr_id:Pièce;date_ecr:Date;jal_code:Jal;libelle:Libellé;debit:Débit;credit:Crédit' });
  scr.creerEcran('compta_cpts', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_cpt?o=8&b=">+ Nouveau compte</a> <a class="btn secondaire" data-md-ajax href="/compta_resultat?o=1&b=1">Compte de résultat</a></div>$liste' });
  scr.placeWidget('compta_cpts', 'liste', { type_widget: 'selectList', option_type_widget: 'table=cpt\necran=compta_cpt\ncols=cpt_num:Compte;libelle:Libellé;classe:Classe' });

  // Journal général : toutes les lignes ; saisie d'une ligne
  scr.creerEcran('compta_lig', { table_liee: 'lig', template: 'N° écriture (pièce) $ecr_id<br/>Date $date_ecr<br/>Journal $jal_code<br/>Compte $compte<br/>Tiers $trs_code<br/>Libellé $libelle<br/>Débit $debit — Crédit $credit' });
  scr.placeWidget('compta_lig', 'ecr_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'N° écriture', est_notnull: 1 });
  scr.placeWidget('compta_lig', 'date_ecr', { type_widget: 'date', type_champ: 'date', libelle: 'Date' });
  scr.placeWidget('compta_lig', 'jal_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Journal' });
  scr.placeWidget('compta_lig', 'compte', { type_widget: 'text', type_champ: 'clop', libelle: 'Compte', est_notnull: 1 });
  scr.placeWidget('compta_lig', 'trs_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Tiers (facultatif)' });
  scr.placeWidget('compta_lig', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_lig', 'debit', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Débit' });
  scr.placeWidget('compta_lig', 'credit', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Crédit' });
  scr.placeWidget('compta_lig', 'classe', { type_widget: 'integer', type_champ: 'integer', libelle: 'Classe (auto)', formule_calcul: '[lig_classe]', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.creerEcran('compta_ligs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_lig?o=8&b=">+ Nouvelle ligne</a></div>$liste' });
  scr.placeWidget('compta_ligs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=lig\necran=compta_lig\ncols=ecr_id:Pièce;date_ecr:Date;jal_code:Jal;compte:Compte;libelle:Libellé;debit:Débit;credit:Crédit' });

  // Écritures : fiche (équilibre calculé) + liste
  scr.creerEcran('compta_ecr', { table_liee: 'ecr', template: 'Écriture n° $ecr_1 — Statut $statut<br/>Date $date_ecr — Journal $jal_code<br/>Pièce $piece — $libelle<hr/>Total débit $total_debit — Total crédit $total_credit<br/><b>Équilibre (doit être 0) $equilibre</b><hr/><h2>Lignes de l’écriture</h2>$lignes<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_lig?o=8&b=">+ Nouvelle ligne</a></div>' });
  scr.placeWidget('compta_ecr', 'date_ecr', { type_widget: 'date', type_champ: 'date', libelle: 'Date' });
  scr.placeWidget('compta_ecr', 'jal_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Journal (AC/VE/BQ/CA/OD)' });
  scr.placeWidget('compta_ecr', 'piece', { type_widget: 'text', type_champ: 'string', libelle: 'N° de pièce' });
  scr.placeWidget('compta_ecr', 'libelle', { type_widget: 'text', type_champ: 'string', libelle: 'Libellé' });
  scr.placeWidget('compta_ecr', 'statut', { type_widget: 'text', type_champ: 'clop', libelle: 'Statut (brouillard/validé)' });
  scr.placeWidget('compta_ecr', 'total_debit', calc('ecr_tdeb', 'Total débit'));
  scr.placeWidget('compta_ecr', 'total_credit', calc('ecr_tcred', 'Total crédit'));
  scr.placeWidget('compta_ecr', 'equilibre', calc('ecr_eq', 'Équilibre (0 = équilibrée)'));
  // Détail : lignes de CETTE écriture (filtre dynamique ecr_id = $ecr_1)
  scr.placeWidget('compta_ecr', 'lignes', { type_widget: 'selectList', option_type_widget: 'table=lig\nfiltre=ecr_id = $ecr_1\necran=compta_lig\ncols=compte:Compte;libelle:Libellé;debit:Débit;credit:Crédit' });
  scr.creerEcran('compta_ecrs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_ecr?o=8&b=">+ Nouvelle écriture</a></div>$liste' });
  scr.placeWidget('compta_ecrs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=ecr\necran=compta_ecr\ncols=ecr_1:N°;date_ecr:Date;jal_code:Jal;piece:Pièce;libelle:Libellé' });

  // Compte de résultat (charges classe 6, produits classe 7, résultat)
  scr.creerEcran('compta_resultat', { table_liee: 'res', template: 'COMPTE DE RÉSULTAT — exercice $exercice<hr/>Total produits (classe 7) $produits<br/>Total charges (classe 6) $charges<hr/><b>Résultat (produits − charges) $resultat</b>' });
  scr.placeWidget('compta_resultat', 'exercice', { type_widget: 'text', type_champ: 'string', libelle: 'Exercice' });
  scr.placeWidget('compta_resultat', 'charges', calc('res_ch', 'Total charges (classe 6)'));
  scr.placeWidget('compta_resultat', 'produits', calc('res_pr', 'Total produits (classe 7)'));
  scr.placeWidget('compta_resultat', 'resultat', calc('res_net', 'Résultat net'));

  // Bilan simplifié par masses (net par classe) — actif = passif quoi qu'il arrive
  scr.creerEcran('compta_bilan', { table_liee: 'res', template:
    'BILAN SIMPLIFIÉ — exercice $exercice<hr/>'
    + '<b>ACTIF</b><br/>Actif immobilisé (cl.2) $b_immo<br/>Stocks (cl.3) $b_stocks<br/>Créances &amp; tiers débiteurs nets (cl.4) $b_tiers<br/>Trésorerie nette (cl.5) $b_treso<br/><b>TOTAL ACTIF $b_actif</b><hr/>'
    + '<b>PASSIF</b><br/>Capitaux propres (cl.1) $b_capx<br/>Résultat de l’exercice $resultat<br/><b>TOTAL PASSIF $b_passif</b>' });
  scr.placeWidget('compta_bilan', 'exercice', { type_widget: 'text', type_champ: 'string', libelle: 'Exercice' });
  scr.placeWidget('compta_bilan', 'b_immo', calc('bil_immo', 'Actif immobilisé (cl.2)'));
  scr.placeWidget('compta_bilan', 'b_stocks', calc('bil_stocks', 'Stocks (cl.3)'));
  scr.placeWidget('compta_bilan', 'b_tiers', calc('bil_tiers', 'Créances & tiers nets (cl.4)'));
  scr.placeWidget('compta_bilan', 'b_treso', calc('bil_treso', 'Trésorerie nette (cl.5)'));
  scr.placeWidget('compta_bilan', 'b_actif', calc('bil_actif', 'TOTAL ACTIF'));
  scr.placeWidget('compta_bilan', 'b_capx', calc('bil_capx', 'Capitaux propres (cl.1)'));
  scr.placeWidget('compta_bilan', 'resultat', calc('res_net', 'Résultat'));
  scr.placeWidget('compta_bilan', 'b_passif', calc('bil_passif', 'TOTAL PASSIF'));

  // Déclaration de TVA (CA3 simplifiée)
  scr.creerEcran('compta_tva', { table_liee: 'res', template:
    'DÉCLARATION DE TVA — exercice $exercice<hr/>TVA collectée (ventes) $t_col<br/>TVA déductible (achats) $t_ded<hr/><b>TVA à décaisser (collectée − déductible) $t_due</b>' });
  scr.placeWidget('compta_tva', 'exercice', { type_widget: 'text', type_champ: 'string', libelle: 'Exercice' });
  scr.placeWidget('compta_tva', 't_col', calc('tva_col', 'TVA collectée'));
  scr.placeWidget('compta_tva', 't_ded', calc('tva_ded', 'TVA déductible'));
  scr.placeWidget('compta_tva', 't_due', calc('tva_due', 'TVA à décaisser'));

  // --- Factures + règlements + lettrage + échéancier ---
  scr.creerEcran('compta_fac', { table_liee: 'fac', template:
    'Facture n° $fac_1 ($type) — $numero<br/>Tiers $trs_code<br/>Date $date_fac — Échéance $date_ech<hr/>'
    + 'Montant HT $ht<br/>TVA ($tva_taux %) $tva<br/><b>TTC $ttc</b><hr/>'
    + 'Déjà réglé $regle<br/><b>Solde restant dû (0 = lettrée/soldée) $solde</b><hr/>'
    + '<h2>Règlements</h2>$reglements<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_reg?o=8&b=">+ Nouveau règlement</a></div>' });
  scr.placeWidget('compta_fac', 'type', { type_widget: 'text', type_champ: 'clop', libelle: 'Type (vente/achat)' });
  scr.placeWidget('compta_fac', 'trs_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Tiers (client/fournisseur)' });
  scr.placeWidget('compta_fac', 'numero', { type_widget: 'text', type_champ: 'string', libelle: 'N° de facture' });
  scr.placeWidget('compta_fac', 'date_fac', { type_widget: 'date', type_champ: 'date', libelle: 'Date facture' });
  scr.placeWidget('compta_fac', 'date_ech', { type_widget: 'date', type_champ: 'date', libelle: 'Échéance' });
  scr.placeWidget('compta_fac', 'ht', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Montant HT', est_notnull: 1 });
  scr.placeWidget('compta_fac', 'tva_taux', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux de TVA %' });
  scr.placeWidget('compta_fac', 'tva', calc('fac_tva', 'TVA'));
  scr.placeWidget('compta_fac', 'ttc', calc('fac_ttc', 'Montant TTC'));
  scr.placeWidget('compta_fac', 'regle', calc('fac_regle', 'Déjà réglé'));
  scr.placeWidget('compta_fac', 'solde', calc('fac_solde', 'Solde restant dû'));
  scr.placeWidget('compta_fac', 'reglements', { type_widget: 'selectList', option_type_widget: 'table=reg\nfiltre=fac_id = $fac_1\necran=compta_reg\ncols=date_reg:Date;montant:Montant;mode:Mode' });

  scr.creerEcran('compta_facs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_fac?o=8&b=">+ Nouvelle facture</a></div>$liste' });
  scr.placeWidget('compta_facs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=fac\necran=compta_fac\ncols=fac_1:N°;type:Type;numero:Numéro;trs_code:Tiers;date_ech:Échéance;ttc:TTC;solde:Solde' });

  scr.creerEcran('compta_reg', { table_liee: 'reg', template: 'Règlement n° $reg_1<br/>Facture n° $fac_id<br/>Date $date_reg<br/>Montant $montant<br/>Mode $mode' });
  scr.placeWidget('compta_reg', 'fac_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'Facture (n°)', est_notnull: 1 });
  scr.placeWidget('compta_reg', 'date_reg', { type_widget: 'date', type_champ: 'date', libelle: 'Date du règlement' });
  scr.placeWidget('compta_reg', 'montant', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Montant', est_notnull: 1 });
  scr.placeWidget('compta_reg', 'mode', { type_widget: 'text', type_champ: 'clop', libelle: 'Mode (virement/chèque/espèces/CB)' });

  scr.creerEcran('compta_regs', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/compta_reg?o=8&b=">+ Nouveau règlement</a></div>$liste' });
  scr.placeWidget('compta_regs', 'liste', { type_widget: 'selectList', option_type_widget: 'table=reg\necran=compta_reg\ncols=reg_1:N°;fac_id:Facture;date_reg:Date;montant:Montant;mode:Mode' });

  scr.creerEcran('compta_echeancier', { table_liee: '', template: '<h2>Échéancier — factures et soldes</h2>$liste<p class="md-aide">Cliquez une facture pour voir/saisir ses règlements ; son solde y est recalculé.</p>' });
  scr.placeWidget('compta_echeancier', 'liste', { type_widget: 'selectList', option_type_widget: 'table=fac\necran=compta_fac\ntri=date_ech\ncols=numero:Facture;type:Type;trs_code:Tiers;date_ech:Échéance;ttc:TTC;regle:Réglé;solde:Solde' });

  // --- Données d'exemple (1er lancement uniquement ; via le runtime générique) ---
  const seed = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });
  for (const j of JOURNAUX) seed.sauvegarde('compta_jal', [], { jal_code: j.code, libelle: j.libelle, type: j.type });
  for (const c of PLAN) seed.sauvegarde('compta_cpt', [], { cpt_num: c.num, libelle: c.libelle, classe: String(c.classe) });
  seed.sauvegarde('compta_trs', [], { trs_code: 'C001', nom: 'Client Démo SA', type: 'client', compte: '411000' });
  seed.sauvegarde('compta_trs', [], { trs_code: 'F001', nom: 'Fournisseur Démo', type: 'fournisseur', compte: '401000' });

  // Écriture n°1 : VENTE (journal VE) — facture client 1 200 TTC (1 000 HT + 200 TVA)
  seed.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-25', jal_code: 'VE', piece: 'VENTE-001', libelle: 'Facture client C001', statut: 'validé' });
  const venteLignes = [
    { compte: '411000', trs_code: 'C001', libelle: 'Facture VENTE-001', debit: '1200', credit: '0' },
    { compte: '707000', trs_code: '', libelle: 'Vente de marchandises HT', debit: '0', credit: '1000' },
    { compte: '445710', trs_code: '', libelle: 'TVA collectée 20%', debit: '0', credit: '200' },
  ];
  for (const l of venteLignes) seed.sauvegarde('compta_lig', [], { ecr_id: '1', date_ecr: '2026-06-25', jal_code: 'VE', ...l });

  // Écriture n°2 : ACHAT (journal AC) — facture fournisseur 600 TTC (500 HT + 100 TVA)
  seed.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-25', jal_code: 'AC', piece: 'ACH-001', libelle: 'Facture fournisseur F001', statut: 'validé' });
  const achatLignes = [
    { compte: '607000', trs_code: '', libelle: 'Achat de marchandises HT', debit: '500', credit: '0' },
    { compte: '445660', trs_code: '', libelle: 'TVA déductible 20%', debit: '100', credit: '0' },
    { compte: '401000', trs_code: 'F001', libelle: 'Facture ACH-001', debit: '0', credit: '600' },
  ];
  for (const l of achatLignes) seed.sauvegarde('compta_lig', [], { ecr_id: '2', date_ecr: '2026-06-25', jal_code: 'AC', ...l });

  // Enregistrement unique du compte de résultat / bilan / TVA (la même fiche res)
  seed.sauvegarde('compta_resultat', [], { exercice: '2026' });

  // Factures de démonstration + un règlement partiel
  seed.sauvegarde('compta_fac', [], { type: 'vente', trs_code: 'C001', numero: 'VTE-2026-001', date_fac: '2026-06-01', date_ech: '2026-07-01', ht: '1000', tva_taux: '20' });
  seed.sauvegarde('compta_fac', [], { type: 'achat', trs_code: 'F001', numero: 'ACH-2026-001', date_fac: '2026-06-05', date_ech: '2026-07-05', ht: '500', tva_taux: '20' });
  seed.sauvegarde('compta_reg', [], { fac_id: '1', date_reg: '2026-06-15', montant: '600', mode: 'virement' });

  return { r4, params, menuEntries: menus };
}

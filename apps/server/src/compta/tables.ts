/**
 * Tables (patrons) de l'application de comptabilité : journaux, plan comptable,
 * tiers, écritures, lignes, état de synthèse (res), factures, règlements.
 */
import { PatronEditor, type TypeChamp } from '@maides/core';

/** Crée toutes les tables de données de la comptabilité (ordre sans incidence). */
export function definitTables(pat: PatronEditor): void {
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

  // --- Table mono-enregistrement pour le compte de résultat / bilan / TVA ---
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
}

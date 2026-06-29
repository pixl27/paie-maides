/**
 * Tables (patrons) de l'application de paie : employeur, salarié, catalogue de
 * rubriques de cotisation (paramétrable) et bulletin de paie.
 */
import { PatronEditor, type TypeChamp } from '@maides/core';

export function definitTables(pat: PatronEditor): void {
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
}

/**
 * Données de démonstration de la comptabilité (1er lancement uniquement) :
 * référentiel (plan comptable, journaux, tiers) + deux écritures équilibrées,
 * la fiche unique de synthèse, des factures et un règlement partiel.
 *
 * Tout passe par le runtime générique (mêmes règles que la saisie utilisateur).
 */
import { R4, Runtime } from '@maides/core';

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

/** Insère le référentiel et les exemples (idempotent : appelé au 1er lancement). */
export function seedDonnees(r4: R4): void {
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
}

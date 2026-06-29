/**
 * Barème de paie (référentiel éditable au Designer une fois seedé) : catalogue des
 * cotisations salariales/patronales et taux simplifiés 2024. Partagé entre la
 * définition des paramètres (PMSS, abattement CSG) et le seed du catalogue `rub`.
 */

/** Une rubrique de cotisation : base (brut|plafond|base_csg) + taux + code de seed. */
export interface Cotisation { base: 'brut' | 'plafond' | 'base_csg'; code: string; libelle: string; }

export const COT_SAL: Cotisation[] = [
  { base: 'plafond', code: 'VIP_SAL', libelle: 'Assurance vieillesse plafonnée' },
  { base: 'brut', code: 'VID_SAL', libelle: 'Assurance vieillesse déplafonnée' },
  { base: 'plafond', code: 'RCT1_SAL', libelle: 'Retraite complémentaire T1' },
  { base: 'plafond', code: 'CEG_SAL', libelle: 'Contribution équilibre général' },
  { base: 'base_csg', code: 'CSGD_SAL', libelle: 'CSG déductible' },
  { base: 'base_csg', code: 'CSGND_SAL', libelle: 'CSG/CRDS non déductible' },
];

export const COT_PAT: Cotisation[] = [
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
export const TAUX: Record<string, number> = {
  PMSS: 3864, ABATT_CSG: 0.9825,
  VIP_SAL: 6.90, VIP_PAT: 8.55, VID_SAL: 0.40, VID_PAT: 2.02,
  MAL_PAT: 7.00, ALLOC_PAT: 3.45, CHOM_PAT: 4.05, AGS_PAT: 0.25,
  RCT1_SAL: 3.15, RCT1_PAT: 4.72, CEG_SAL: 0.86, CEG_PAT: 1.29,
  CSGD_SAL: 6.80, CSGND_SAL: 2.90, AT_PAT: 1.50,
};

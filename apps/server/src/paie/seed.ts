/**
 * Données de démonstration de la paie (1er lancement uniquement) : un employeur,
 * deux salariés, le catalogue des cotisations (depuis le barème) et un bulletin
 * calculé par les formules à l'enregistrement.
 */
import { R4, Runtime } from '@maides/core';
import { COT_SAL, COT_PAT, TAUX } from './bareme.js';

export function seedDonnees(r4: R4): void {
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
}

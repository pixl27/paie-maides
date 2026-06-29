/**
 * Données d'exemple de l'assurance (via le runtime générique, aucun code métier) :
 * deux tiers et une quittance AUTO calculée par les formules.
 */
import { R4, Runtime } from '@maides/core';

export function seedDonnees(r4: R4): void {
  const seed = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });
  seed.sauvegarde('aax_adr', [], { adr_12: 'Dupont', adr_email: 'dupont@exemple.fr' });
  seed.sauvegarde('aax_adr', [], { adr_12: 'Martin', adr_email: 'martin@exemple.fr' });
  seed.sauvegarde('aax_qit', [], { base: '1000', prorata: '0.5', bonus: '950', taux_code: 'AUTO', com_taux: '10' });
}

/** Définition de TOUS les écrans de l'assurance : un fichier par domaine. */
import type { EcranEditor } from '@maides/core';
import { definitEcranTiers } from './tiers.js';
import { definitEcranQuittance } from './quittance.js';
import { definitEcranRenouvellement } from './renouvellement.js';

export function definitEcrans(scr: EcranEditor): void {
  definitEcranTiers(scr);
  definitEcranQuittance(scr);
  definitEcranRenouvellement(scr);
}

/**
 * Définition de TOUS les écrans de la comptabilité.
 *
 * Un fichier par domaine fonctionnel ; chaque domaine regroupe la FICHE et sa
 * LISTE (inséparables : la liste pointe vers la fiche via `ecran=…`). L'ordre de
 * création est sans incidence (les écrans se référencent par nom, pas par ordre).
 */
import type { EcranEditor } from '@maides/core';
import { definitEcransJournaux } from './journaux.js';
import { definitEcransTiers } from './tiers.js';
import { definitEcransComptes } from './comptes.js';
import { definitEcransLignes } from './lignes.js';
import { definitEcransEcritures } from './ecritures.js';
import { definitEcransEtats } from './etats.js';
import { definitEcransFactures } from './factures.js';
import { definitLettreFacture } from './factures-pdf.js';
import { definitLettresEtats } from './etats-pdf.js';

export function definitEcrans(scr: EcranEditor, lettres: EcranEditor): void {
  definitEcransJournaux(scr);
  definitEcransTiers(scr);
  definitEcransComptes(scr);
  definitEcransLignes(scr);
  definitEcransEcritures(scr);
  definitEcransEtats(scr);
  definitEcransFactures(scr);
  definitLettreFacture(lettres); // factures imprimables (PDF)
  definitLettresEtats(lettres);  // écriture, grand livre, journal, résultat, bilan (PDF)
}

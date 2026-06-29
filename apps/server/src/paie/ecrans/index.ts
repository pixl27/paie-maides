/**
 * Définition de TOUS les écrans de la paie : un fichier par domaine. `scr` porte
 * les écrans applicatifs (patron `scr`) ; `lettres` porte le bulletin imprimable
 * (patron `let`).
 */
import type { EcranEditor } from '@maides/core';
import { definitEcranEmployeur } from './employeur.js';
import { definitEcransSalaries } from './salaries.js';
import { definitEcransRubriques } from './rubriques.js';
import { definitEcransBulletins } from './bulletins.js';
import { definitLettreBulletin } from './bulletin-pdf.js';

export function definitEcrans(scr: EcranEditor, lettres: EcranEditor): void {
  definitEcranEmployeur(scr);
  definitEcransSalaries(scr);
  definitEcransRubriques(scr);
  definitEcransBulletins(scr);
  definitLettreBulletin(lettres);
}

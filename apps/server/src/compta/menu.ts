/** Menu de l'application de comptabilité (entrées + scripts d'écran). */
import type { MenuEntry } from '@maides/core';

export const menusCompta: MenuEntry[] = [
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

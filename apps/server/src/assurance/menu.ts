/** Menu de l'application d'assurance. */
import type { MenuEntry } from '@maides/core';

export const menusAssurance: MenuEntry[] = [
  { menu_position: 'a000', menu_libelle: 'Assurance' },
  { menu_position: 'a100', menu_libelle: 'Nouveau tiers', menu_script: '/aax_adr?o=8&b=' },
  { menu_position: 'a110', menu_libelle: 'Tiers Dupont', menu_script: '/aax_adr?o=1&b=1' },
  { menu_position: 'a200', menu_libelle: 'Nouvelle quittance', menu_script: '/aax_qit?o=8&b=' },
  { menu_position: 'a210', menu_libelle: 'Quittance n°1', menu_script: '/aax_qit?o=1&b=1' },
  { menu_position: 'a300', menu_libelle: 'Renouvellement (bonus-malus)', menu_script: '/aax_renouv?o=8&b=' },
  { menu_position: 'z900', menu_libelle: 'Designer (low-code)', menu_script: '/designer' },
];

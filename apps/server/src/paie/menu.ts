/** Menu de l'application de paie. */
import type { MenuEntry } from '@maides/core';

export const menusPaie: MenuEntry[] = [
  { menu_position: 'p000', menu_libelle: 'Paie' },
  { menu_position: 'p100', menu_libelle: 'Salariés', menu_script: '/paie_sals?o=1&b=' },
  { menu_position: 'p200', menu_libelle: 'Rubriques', menu_script: '/paie_rubs?o=1&b=' },
  { menu_position: 'p300', menu_libelle: 'Bulletins de paie', menu_script: '/paie_buls?o=1&b=' },
];

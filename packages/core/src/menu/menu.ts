/**
 * Menus (port de mdMenu.php).
 *
 * Un menu est une liste d'entrées portant une `position` hiérarchique (jusqu'à
 * 4 niveaux ; un chiffre '0' termine la descente), un libellé, un script (cible)
 * et un niveau de droit. L'arbre est filtré selon l'utilisateur puis rendu en
 * listes imbriquées.
 */

import { UserInfo } from '../expression/env.js';
import { menuEstVisible } from '../auth/droits.js';
import { escapeHtml, attrs } from '../rendering/html.js';

export interface MenuEntry {
  menu_position: string;
  menu_libelle: string;
  menu_script?: string;
  menu_droit?: number;
}

/**
 * Menu de paramétrage par défaut (port de __menu_defaut__) : proposé au
 * super-administrateur en repli quand la table 'menu' est vide ou absente.
 */
export const MENU_DEFAUT: MenuEntry[] = [
  { menu_position: 'z100', menu_libelle: 'Designer', menu_script: '/designer', menu_droit: 0 },
  { menu_position: 'z110', menu_libelle: 'Tables (patrons)', menu_script: '/designer', menu_droit: 0 },
  { menu_position: 'z120', menu_libelle: 'Écrans', menu_script: '/designer', menu_droit: 0 },
  { menu_position: 'z130', menu_libelle: 'Lettres', menu_script: '/designer', menu_droit: 0 },
  { menu_position: 'z900', menu_libelle: 'Déconnexion', menu_script: '/logout', menu_droit: 9 },
];

/**
 * Entrées de menu effectives. Pour un super-administrateur, le menu de
 * paramétrage par défaut est TOUJOURS ajouté (port de mdMenu : `$resultat +
 * $__menu_defaut__`), union par menu_position (les entrées personnalisées
 * priment). Pour les autres utilisateurs : les entrées telles quelles.
 */
export function entreesMenuOuDefaut(entries: MenuEntry[], user?: UserInfo): MenuEntry[] {
  if (!user?.superAdmin) return entries;
  const positions = new Set(entries.map((e) => e.menu_position));
  const defauts = MENU_DEFAUT.filter((d) => !positions.has(d.menu_position));
  return [...entries, ...defauts];
}

export interface MenuNode {
  label: string;
  script: string;
  position: string;
  children: Map<string, MenuNode>;
}

function nouveauNode(position = ''): MenuNode {
  return { label: '', script: '', position, children: new Map() };
}

/** Chemin hiérarchique d'une position (s'arrête au premier '0' après le 1er caractère). */
function cheminDe(position: string): string[] {
  const chemin = [position[0] ?? ''];
  for (let i = 1; i < position.length; i++) {
    const c = position[i]!;
    if (c === '0' || c === undefined) break;
    chemin.push(c);
  }
  return chemin;
}

/** Construit l'arbre de menu à partir des entrées (filtrées selon l'utilisateur). */
export function construitMenu(entries: MenuEntry[], user?: UserInfo): MenuNode {
  const racine = nouveauNode();
  const visibles = entries
    .filter((e) => !user || menuEstVisible(e.menu_droit, user))
    .sort((a, b) => a.menu_position.localeCompare(b.menu_position));

  for (const entry of visibles) {
    const chemin = cheminDe(entry.menu_position);
    let courant = racine;
    for (const cle of chemin) {
      if (!courant.children.has(cle)) courant.children.set(cle, nouveauNode());
      courant = courant.children.get(cle)!;
    }
    courant.label = entry.menu_libelle;
    courant.script = entry.menu_script ?? '';
    courant.position = entry.menu_position;
  }
  return racine;
}

/** Rend l'arbre de menu en listes imbriquées HTML. */
export function renderMenu(racine: MenuNode, nomMenu = 'menu'): string {
  const corps = renderNiveau([...racine.children.values()]);
  return `<ul${attrs({ id: nomMenu, class: 'menu' })}>${corps}</ul>`;
}

function renderNiveau(nodes: MenuNode[]): string {
  return nodes
    .filter((n) => n.label !== '')
    .map((n) => {
      const lien = n.script
        ? `<a${attrs({ href: n.script })}>${escapeHtml(n.label)}</a>`
        : `<span>${escapeHtml(n.label)}</span>`;
      const enfants = [...n.children.values()].filter((c) => c.label !== '');
      const sous = enfants.length ? `<ul>${renderNiveau(enfants)}</ul>` : '';
      return `<li>${lien}${sous}</li>`;
    })
    .join('');
}

/** Aplati l'arbre en liste de feuilles (entrées cliquables), pour navigation simple. */
export function feuillesMenu(racine: MenuNode): { label: string; script: string }[] {
  const out: { label: string; script: string }[] = [];
  const visite = (node: MenuNode) => {
    if (node.label && node.script) out.push({ label: node.label, script: node.script });
    node.children.forEach(visite);
  };
  racine.children.forEach(visite);
  return out;
}

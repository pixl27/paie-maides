import { describe, it, expect } from 'vitest';
import {
  hashPassword, verifyPassword, estHache,
} from '../src/auth/password.js';
import { authentifier, MemoryUserStore, toUserInfo } from '../src/auth/auth.js';
import { ecranEstAutorise, menuEstVisible, DrtException } from '../src/auth/droits.js';
import { construitMenu, renderMenu, feuillesMenu, type MenuEntry } from '../src/menu/index.js';

describe('auth — hachage de mot de passe', () => {
  it('hache et vérifie (sel aléatoire, comparaison constante)', () => {
    const h = hashPassword('secret');
    expect(estHache(h)).toBe(true);
    expect(h).not.toContain('secret');
    expect(verifyPassword('secret', h)).toBe(true);
    expect(verifyPassword('mauvais', h)).toBe(false);
  });
  it('deux hachages du même mot de passe diffèrent (sel)', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'));
  });
});

describe('auth — authentification', () => {
  const store = new MemoryUserStore();
  store.creer('alice', 'motdepasse', { super_admin: 'O', niveau: 0 });
  store.creer('bob', 'pw', { niveau: 3, actif: true });
  store.creer('inactif', 'pw', { actif: false });

  it('identifiants valides', () => {
    const u = authentifier(store, 'alice', 'motdepasse');
    expect(u).not.toBeNull();
    expect(toUserInfo(u!).superAdmin).toBe(true);
  });
  it('mauvais mot de passe / compte inactif', () => {
    expect(authentifier(store, 'alice', 'x')).toBeNull();
    expect(authentifier(store, 'inactif', 'pw')).toBeNull();
    expect(authentifier(store, 'fantome', 'pw')).toBeNull();
  });
});

describe('droits', () => {
  const admin = { login: 'a', superAdmin: true, niveau: 0 };
  const user3 = { login: 'b', superAdmin: false, niveau: 3 };

  it('super-admin accède à tout', () => {
    expect(ecranEstAutorise({ niveauDroits: 1, categorie: 'scr' }, admin)).toBe(true);
  });
  it('utilisateur : autorisé si niveau <= niveauDroits', () => {
    expect(ecranEstAutorise({ niveauDroits: 5, categorie: 'scr' }, user3)).toBe(true);
    expect(ecranEstAutorise({ niveauDroits: 2, categorie: 'scr' }, user3)).toBe(false);
  });
  it('écran sans niveau requis : autorisé', () => {
    expect(ecranEstAutorise({ categorie: 'scr' }, user3)).toBe(true);
  });
  it('visibilité menu : droit >= niveau utilisateur', () => {
    expect(menuEstVisible(5, user3)).toBe(true);
    expect(menuEstVisible(2, user3)).toBe(false);
  });
  it('DrtException', () => {
    expect(() => { throw new DrtException(1); }).toThrow('Droits insuffisants');
  });
});

describe('menu — arbre hiérarchique', () => {
  const entries: MenuEntry[] = [
    { menu_position: '1000', menu_libelle: 'Contrats', menu_script: '?e=contrat&o=1' },
    { menu_position: '1100', menu_libelle: 'Nouveau', menu_script: '?e=contrat&o=8' },
    { menu_position: '1200', menu_libelle: 'Liste', menu_script: '?e=contratListe&o=1' },
    { menu_position: '2000', menu_libelle: 'Admin', menu_script: '', menu_droit: 0 },
    { menu_position: '9000', menu_libelle: 'Déconnexion', menu_script: '?module=logout' },
  ];

  it('construit l’arbre et le rend en listes imbriquées', () => {
    const arbre = construitMenu(entries);
    const html = renderMenu(arbre, 'principal');
    expect(html).toContain('<ul id="principal" class="menu">');
    expect(html).toContain('>Contrats</a>');
    expect(html).toContain('>Nouveau</a>'); // sous-entrée de Contrats
    expect(html).toContain('<ul><li>'); // imbrication
  });

  it('filtre selon les droits utilisateur', () => {
    const user5 = { login: 'u', superAdmin: false, niveau: 5 };
    const arbre = construitMenu(entries, user5);
    const feuilles = feuillesMenu(arbre).map((f) => f.label);
    expect(feuilles).toContain('Nouveau');
    expect(feuilles).not.toContain('Admin'); // droit 0 < niveau 5 -> masqué
  });
});

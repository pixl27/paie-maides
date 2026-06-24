/**
 * Tests P2 services : requetteur (résolution + validation SQL), détection de
 * format + garde MML_NON_PDF, menu par défaut, mailing piloté par lignes.
 */
import { describe, it, expect } from 'vitest';
import { Requetteur } from '../src/services/requetteur.js';
import { detecterFormat, estPdf, genererPdf, type PdfRenderer } from '../src/services/documents.js';
import { SimplePdfRenderer } from '../src/services/pdf-simple.js';
import { MENU_DEFAUT, entreesMenuOuDefaut } from '../src/menu/menu.js';
import { MassMailing } from '../src/services/mailing.js';
import { MemoryMailer } from '../src/services/mailer.js';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';

describe('Requetteur', () => {
  const store = { charge: (n: string) => (n === 'liste' ? 'SELECT * FROM con WHERE id = $id' : null) };
  it('résout une requête nommée + substitue les variables', () => {
    const r = new Requetteur(store);
    expect(r.resoudre('[liste]', { id: 5 })).toBe('SELECT * FROM con WHERE id = 5');
  });
  it('requête nommée introuvable -> erreur', () => {
    expect(() => new Requetteur(store).resoudre('[absente]')).toThrow(/introuvable/);
  });
  it('validation SQL (port de REQ_valideSQL)', () => {
    expect(Requetteur.valideSQL('SELECT * FROM t')).toBe(true);
    expect(Requetteur.valideSQL('SELECT * FROM t -- x')).toBe(false); // commentaire
    expect(Requetteur.valideSQL('DELETE FROM t')).toBe(false); // pas un select
    expect(Requetteur.valideSQL('SELECT 1; DROP TABLE t')).toBe(false); // mot interdit
    expect(Requetteur.valideSQL('DELETE FROM t', true)).toBe(true); // trusted
  });
  it('rejette TOUS les mots-clés interdits du PHP (même précédés de select)', () => {
    for (const kw of ['insert', 'update', 'delete', 'rename', 'drop', 'create', 'truncate', 'alter',
      'commit', 'rollback', 'merge', 'call', 'explain', 'lock', 'grant', 'revoke', 'savepoint', 'transaction', 'set']) {
      expect(Requetteur.valideSQL(`SELECT * FROM t; ${kw} x`), kw).toBe(false);
    }
  });
  it('executeRequete : résout, valide, exécute', () => {
    const r = new Requetteur(store, (sql) => [{ sql }]);
    expect(r.executeRequete('[liste]', { id: 1 })).toEqual([{ sql: 'SELECT * FROM con WHERE id = 1' }]);
    expect(() => new Requetteur(store, () => []).executeRequete('DROP TABLE t')).toThrow(/refusée/);
  });
});

describe('détection de format', () => {
  it('reconnaît PDF / PNG / JPG / vide / inconnu', () => {
    expect(detecterFormat(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe('pdf');
    expect(detecterFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('png');
    expect(detecterFormat(new Uint8Array([0xff, 0xd8, 0x00]))).toBe('jpg');
    expect(detecterFormat(new Uint8Array([]))).toBe('empty');
    expect(detecterFormat(new Uint8Array([1, 2, 3]))).toBe('inconnu');
    expect(estPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
  });
});

describe('genererPdf — garde MML_NON_PDF', () => {
  function app() {
    const data = new MemoryLayerStore().definePatron(creerPatron('cli', [{ nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 }, { nom_champ: 'nom', type_champ: 'string' }], { emplacement: 'D' }));
    const params = new MemoryLayerStore().definePatron(creerPatron('let', [{ nom_champ: 'nom_lettre', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));
    params.putWithKey('let', ['l'], { nom_lettre: 'l', table_liee: 'cli', compiler: 1, template: 'Bonjour @($nom)', champs: {} });
    data.put('cli', { id: 1, nom: 'Z' });
    const r4 = new R4({ data, paramR4: params });
    return new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } });
  }
  it('refuse une sortie non-PDF', async () => {
    const faux: PdfRenderer = { rendre: async () => new Uint8Array([1, 2, 3]) };
    await expect(genererPdf(faux, app(), 'l', ['1'])).rejects.toThrow(/MML_NON_PDF/);
  });
  it('accepte un vrai PDF', async () => {
    const bytes = await genererPdf(new SimplePdfRenderer(), app(), 'l', ['1']);
    expect(estPdf(bytes)).toBe(true);
  });
});

describe('menu par défaut (__menu_defaut__)', () => {
  const admin = { login: 'a', superAdmin: true, niveau: 0 };
  const user = { login: 'u', superAdmin: false, niveau: 5 };
  it('super-admin sans entrées : reçoit le menu par défaut complet', () => {
    expect(entreesMenuOuDefaut([], admin).map((e) => e.menu_position)).toEqual(MENU_DEFAUT.map((e) => e.menu_position));
  });
  it('non super-admin : aucun menu par défaut', () => {
    expect(entreesMenuOuDefaut([], user)).toEqual([]);
    const perso = [{ menu_position: 'z1', menu_libelle: 'X' }];
    expect(entreesMenuOuDefaut(perso, user)).toBe(perso);
  });
  it('super-admin : le menu par défaut est TOUJOURS fusionné (union par position, perso prime)', () => {
    const perso = [{ menu_position: 'z100', menu_libelle: 'Mon Designer' }, { menu_position: 'z1', menu_libelle: 'X' }];
    const res = entreesMenuOuDefaut(perso, admin);
    // l'entrée perso z100 prime (pas dupliquée) ; les entrées par défaut absentes sont ajoutées
    expect(res.filter((e) => e.menu_position === 'z100')).toHaveLength(1);
    expect(res.find((e) => e.menu_position === 'z100')!.menu_libelle).toBe('Mon Designer');
    expect(res.some((e) => e.menu_position === 'z900')).toBe(true); // Déconnexion par défaut conservée
    expect(res.some((e) => e.menu_position === 'z1')).toBe(true); // perso conservée
  });
});

describe('mailing piloté par lignes (envoyerVers)', () => {
  it('envoie un courrier par enregistrement fourni', async () => {
    const data = new MemoryLayerStore().definePatron(creerPatron('cli', [{ nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 }, { nom_champ: 'nom', type_champ: 'string' }, { nom_champ: 'email', type_champ: 'string' }], { emplacement: 'D' }));
    const params = new MemoryLayerStore().definePatron(creerPatron('let', [{ nom_champ: 'nom_lettre', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }));
    params.putWithKey('let', ['l'], { nom_lettre: 'l', table_liee: 'cli', compiler: 1, template: 'Cher @($nom)', champs: {} });
    data.put('cli', { id: 1, nom: 'A', email: 'a@x' });
    data.put('cli', { id: 2, nom: 'B', email: 'b@x' });
    const r4 = new R4({ data, paramR4: params });
    const rt = new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } });
    const mailer = new MemoryMailer();
    // lignes fournies (comme un résultat de requête nommée)
    const rows = r4.recordsDe('cli').filter((r) => r['id'] === 1);
    const res = await new MassMailing(rt, r4, mailer).envoyerVers(rows, 'l', 'cli', { champEmail: 'email', sujet: 'S' });
    expect(res.total).toBe(1);
    expect(mailer.messages[0]!.destinataire).toBe('a@x');
    expect(mailer.messages[0]!.corpsHtml).toMatch(/Cher\s*<span[^>]*>A<\/span>/);
  });
});

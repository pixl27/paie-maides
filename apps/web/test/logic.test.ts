/** Tests de la logique pure du front SPA (sans DOM) + client API (fetch simulé). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { valeursFormulaire, parseScript, estNavigable } from '../src/serialise.js';
import { api } from '../src/api.js';
import type { ChampMeta } from '../src/types.js';

describe('parseScript / estNavigable', () => {
  it('extrait écran, ordre et clé', () => {
    expect(parseScript('?o=8&e=aax_con&b=4000.1')).toEqual({ ecran: 'aax_con', o: 8, b: '4000.1' });
  });
  it('détecte les programmes non navigables (module=)', () => {
    expect(parseScript('?module=pStructure')).toEqual({ module: 'pStructure' });
    expect(estNavigable('?module=pStructure')).toBe(false);
    expect(estNavigable('?o=1&e=azxVue')).toBe(true);
  });
});

describe('valeursFormulaire', () => {
  const champs: Record<string, ChampMeta> = {
    nom: { type_widget: 'text' },
    total: { type_widget: 'decimal', est_lecture_seule: true },
    titre: { type_widget: 'titre' },
    created_at: { type_widget: 'text' },
    __userLogin: { type_widget: 'text' },
    actif: { type_widget: 'boolean' },
  };
  it('ne renvoie que les champs éditables et porteurs de valeur', () => {
    const out = valeursFormulaire(champs, { nom: 'A', total: 9, titre: 'X', created_at: 'd', __userLogin: 'u', actif: 1 });
    expect(out).toEqual({ nom: 'A', actif: 1 });
  });
});

describe('client API', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  function mockFetch(payload: any) {
    const f = vi.fn((_url: string, _init?: { method?: string; body?: string }) =>
      Promise.resolve({ json: async () => payload } as Response));
    vi.stubGlobal('fetch', f);
    return f;
  }

  it('login POST envoie identifiants et lit la réponse', async () => {
    const f = mockFetch({ ok: true, user: { login: 'admin', superAdmin: true, niveau: 0 } });
    const r = await api.login('admin', 'admin');
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain('/api/login');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(init!.body!)).toEqual({ login: 'admin', motdepasse: 'admin' });
  });

  it('ecran GET construit la query o/b', async () => {
    const f = mockFetch({ ecran: 'aax_con', champs: {}, valeurs: {} });
    await api.ecran('aax_con', '4000.1', 8);
    expect(String(f.mock.calls[0]![0])).toContain('/api/aax_con?o=8&b=4000.1');
  });

  it('sauvegarde POST porte o=9 + clé + valeurs', async () => {
    const f = mockFetch({ ecran: 'aax_con', champs: {}, valeurs: {} });
    await api.sauvegarde('aax_con', '4000.1', { nom: 'Z' });
    const init = f.mock.calls[0]![1]!;
    expect(JSON.parse(init.body!)).toEqual({ o: 9, b: '4000.1', nom: 'Z' });
  });
});

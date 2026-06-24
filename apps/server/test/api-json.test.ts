/** Tests des branches JSON de l'API (consommées par la SPA React) : login, menu, logout. */
import { describe, it, expect, beforeEach } from 'vitest';
import { creerAppDemo } from '../src/demo.js';
import { serialiseZzz, type MaidesApp } from '../src/app.js';
import type { UserInfo } from '@maides/core';

const ADMIN: UserInfo = { login: 'admin', superAdmin: true, niveau: 0 };

describe('API JSON (SPA)', () => {
  let app: MaidesApp;
  beforeEach(() => { app = creerAppDemo(); });

  it('login GET json -> état de session', () => {
    const r = app.handle({ method: 'GET', ecran: 'login', query: {}, format: 'json' });
    expect(r.contentType).toContain('application/json');
    expect(JSON.parse(r.body)).toEqual({ authentifie: false, user: null });
  });

  it('login POST json valide -> { ok, user } + ouverture de session', () => {
    const r = app.handle({ method: 'POST', ecran: 'login', query: {}, format: 'json', body: { login: 'admin', motdepasse: 'admin' } });
    expect(r.status).toBe(200);
    const data = JSON.parse(r.body);
    expect(data.ok).toBe(true);
    expect(data.user.login).toBe('admin');
    expect(r.session?.action).toBe('set');
  });

  it('login POST json invalide -> 401 { ok:false }', () => {
    const r = app.handle({ method: 'POST', ecran: 'login', query: {}, format: 'json', body: { login: 'admin', motdepasse: 'faux' } });
    expect(r.status).toBe(401);
    expect(JSON.parse(r.body).ok).toBe(false);
  });

  it('menu json -> { user, entrees }', () => {
    const r = app.handle({ method: 'GET', ecran: 'menu', query: {}, format: 'json', user: ADMIN });
    const data = JSON.parse(r.body);
    expect(data.user.login).toBe('admin');
    expect(Array.isArray(data.entrees)).toBe(true);
    expect(data.entrees.some((e: any) => /facture/i.test(e.label))).toBe(true);
  });

  it('logout json -> { ok } + fermeture de session', () => {
    const r = app.handle({ method: 'POST', ecran: 'logout', query: {}, format: 'json' });
    expect(JSON.parse(r.body).ok).toBe(true);
    expect(r.session?.action).toBe('clear');
  });

  it('écran json -> état sérialisé (champs + valeurs)', () => {
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '8', b: '1' }, format: 'json', user: ADMIN });
    const data = JSON.parse(r.body);
    expect(data.ecran).toBe('factureSaisie');
    expect(data.champs.client).toBeDefined();
    expect(data.valeurs).toBeDefined();
  });

  it('serialiseZzz enrichit les widgets liés (options de select, lignes de liste)', () => {
    const zzz: any = {
      e: 'x', o: 8, cle: ['1'], ficMaitre: 't', nouveauDoc: false, erreurBloquante: false,
      champs: {
        civ: { type_widget: 'selectTable', option_type_widget: 'table=civ' },
        liste: { type_widget: 'recordList', option_type_widget: 'index=v' },
      },
      valeurs: {}, messages: [],
    };
    const acces = {
      lireTable: (t: string) => (t === 'civ' ? [{ cle: 'M', libelle: 'Monsieur' }] : []),
      lignes: () => [{ a: 1, b: 2 }],
    };
    const out = serialiseZzz(zzz, acces as any);
    expect(out.champs.civ.options).toEqual([{ value: 'M', libelle: 'M - Monsieur' }]);
    expect(out.champs.liste.lignes).toEqual([{ a: 1, b: 2 }]);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { creerAppDemo } from '../src/demo.js';
import type { MaidesApp } from '../src/app.js';
import type { UserInfo } from '@maides/core';

const ADMIN: UserInfo = { login: 'admin', superAdmin: true, niveau: 0 };

describe('serveur maides — shell complet (auth + menu + écrans)', () => {
  let app: MaidesApp;
  beforeEach(() => { app = creerAppDemo(); });

  it('accès protégé : sans session -> redirection vers /login', () => {
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '8', b: '1' } });
    expect(r.status).toBe(302);
    expect(r.headers?.Location).toBe('/login');
  });

  it('accès protégé AJAX sans session -> 401 (pas le HTML de login injecté)', () => {
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '8', b: '1' }, ajax: true });
    expect(r.status).toBe(401);
    expect(r.body).not.toContain('<form');
  });

  it('login invalide -> page avec erreur', () => {
    const r = app.handle({ method: 'POST', ecran: 'login', query: {}, body: { login: 'admin', motdepasse: 'faux' } });
    expect(r.status).toBe(200);
    expect(r.body).toContain('invalides');
  });

  it('login valide -> ouvre une session et redirige vers le menu', () => {
    const r = app.handle({ method: 'POST', ecran: 'login', query: {}, body: { login: 'admin', motdepasse: 'admin' } });
    expect(r.status).toBe(302);
    expect(r.session?.action).toBe('set');
    expect(r.session?.user?.login).toBe('admin');
  });

  it('menu : liste les entrées pour l’utilisateur connecté', () => {
    const r = app.handle({ method: 'GET', ecran: 'menu', query: {}, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.body).toContain('Nouvelle facture');
    expect(r.body).toContain('Déconnexion');
  });

  it('GET écran (connecté) : formulaire HTML', () => {
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '8', b: '1' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.body).toContain('<form');
    expect(r.body).toContain('name="client"');
  });

  it('POST sauvegarde valide (connecté) : calcule le total', () => {
    const r = app.handle({
      method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN,
      body: { o: '9', b: '1', client: 'ACME', qte: '3', pu: '100' },
    });
    expect(r.body).toContain('sauvegardé');
    expect(r.body).toContain('value="300"');
    const v = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '1' }, user: ADMIN });
    expect(v.body).toContain('value="ACME"');
  });

  it('POST invalide (connecté) : refus + messages', () => {
    const r = app.handle({
      method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN,
      body: { o: '9', b: '2', client: '', qte: '0', pu: '50' },
    });
    expect(r.body).toContain('refusé');
    expect(r.body).toContain('Obligatoire');
  });

  it('logout : ferme la session', () => {
    const r = app.handle({ method: 'GET', ecran: 'logout', query: {}, user: ADMIN });
    expect(r.session?.action).toBe('clear');
    expect(r.headers?.Location).toBe('/login');
  });
});

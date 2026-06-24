import { describe, it, expect, beforeEach } from 'vitest';
import { creerAppDemo } from '../src/demo.js';
import type { MaidesApp } from '../src/app.js';
import type { UserInfo } from '@maides/core';

const ADMIN: UserInfo = { login: 'admin', superAdmin: true, niveau: 0 };

describe('API JSON (socle d’un front SPA / intégrations)', () => {
  let app: MaidesApp;
  beforeEach(() => { app = creerAppDemo(); });

  it('GET écran en JSON : état structuré', () => {
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '8', b: '1' }, user: ADMIN, format: 'json' });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('application/json');
    const data = JSON.parse(r.body);
    expect(data.ecran).toBe('factureSaisie');
    expect(data.nouveauDoc).toBe(true);
    expect(data.champs.client.libelle).toBe('Client');
    expect(data.valeurs.total).toBe(0);
  });

  it('POST sauvegarde en JSON : valeurs recalculées', () => {
    const r = app.handle({
      method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, format: 'json',
      body: { o: '9', b: '1', client: 'ACME', qte: '3', pu: '100' },
    });
    expect(r.status).toBe(200);
    const data = JSON.parse(r.body);
    expect(data.validation.erreurBloquante).toBe(false);
    expect(data.valeurs.total).toBe(300);
  });

  it('POST invalide en JSON : HTTP 422 + erreurs par champ', () => {
    const r = app.handle({
      method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, format: 'json',
      body: { o: '9', b: '2', client: '', qte: '0', pu: '50' },
    });
    expect(r.status).toBe(422);
    const data = JSON.parse(r.body);
    expect(data.validation.erreurBloquante).toBe(true);
    expect(data.champs.client.messerr).toContain('Obligatoire');
  });
});

describe('designer — éditeur de lettres', () => {
  let app: MaidesApp;
  beforeEach(() => { app = creerAppDemo(); });

  it('créer une lettre, y placer un champ, puis la retrouver', () => {
    let r = app.handle({
      method: 'POST', ecran: 'designer', query: {}, user: ADMIN,
      body: { action: 'creerEcran', pat: 'let', nom: 'rappelEcheance', table_liee: 'facture', template: 'Cher $client...' },
    });
    expect(r.status).toBe(302);
    expect(r.headers?.Location).toContain('pat=let');

    app.handle({
      method: 'POST', ecran: 'designer', query: {}, user: ADMIN,
      body: { action: 'placeWidget', pat: 'let', ecran: 'rappelEcheance', nom_champ: 'client', type_widget: 'label' },
    });

    // vue de la lettre
    r = app.handle({ method: 'GET', ecran: 'designer', query: { ecran: 'rappelEcheance', pat: 'let' }, user: ADMIN });
    expect(r.body).toContain('lettre rappelEcheance');
    expect(r.body).toContain('Cher $client...');

    // listée sur l'accueil du designer
    r = app.handle({ method: 'GET', ecran: 'designer', query: {}, user: ADMIN });
    expect(r.body).toContain('rappelEcheance');
    expect(r.body).toContain('Lettres / documents');
  });
});

/**
 * Tests des services d'impression (documentImprimable / genererImpression) et
 * des mailers de référence (MemoryMailer / FonctionMailer) + mailing de masse.
 */
import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import { documentImprimable, genererImpression } from '../src/services/pdf.js';
import { MemoryMailer, FonctionMailer } from '../src/services/mailer.js';
import { MassMailing } from '../src/services/mailing.js';

describe('documentImprimable', () => {
  it('découpe en pages sur </page><page> et résout les numéros', () => {
    const html = documentImprimable('Page [[page_cu]]/[[page_nb]]</page><page>Suite [[page_cu]]/[[page_nb]]');
    expect((html.match(/md-page"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('Page 1/2');
    expect(html).toContain('Suite 2/2');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page { margin');
  });
  it('intègre en-tête, pied et marges', () => {
    const html = documentImprimable('corps', { entete: 'EN-TETE', piedpage: 'PIED', marges: '2cm', titre: 'T' });
    expect(html).toContain('EN-TETE');
    expect(html).toContain('PIED');
    expect(html).toContain('margin: 2cm');
    expect(html).toContain('<title>T</title>');
  });
});

/* --- application minimale avec une lettre paginée (compiler actif) --- */
const patClient = creerPatron('cli', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'nom', type_champ: 'string' },
  { nom_champ: 'email', type_champ: 'string' },
], { emplacement: 'D' });
const patLet = creerPatron('let', [{ nom_champ: 'nom_lettre', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const lettre: Record<string, any> = {
  nom_lettre: 'bienvenue', table_liee: 'cli', compiler: 1,
  template: 'Bonjour @($nom)@sautPage<br/>Page @page sur @pageTotale', champs: {},
};

function buildApp() {
  const data = new MemoryLayerStore().definePatron(patClient);
  const params = new MemoryLayerStore().definePatron(patLet).definePatron(patClient);
  params.putWithKey('let', ['bienvenue'], lettre);
  data.put('cli', { id: 1, nom: 'Alice', email: 'alice@x.fr' });
  data.put('cli', { id: 2, nom: 'Bob', email: 'bob@x.fr' });
  const r4 = new R4({ data, paramR4: params });
  return { r4, runtime: new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } }) };
}

describe('genererImpression (lettre paginée)', () => {
  it('rend la lettre compilée en document imprimable paginé', () => {
    const { runtime } = buildApp();
    const html = genererImpression(runtime, 'bienvenue', ['1']);
    expect(html).toContain('Bonjour');
    expect(html).toContain('Alice');
    expect((html.match(/md-page"/g) ?? [])).toHaveLength(2); // @sautPage -> 2 pages
    expect(html).toContain('Page 2 sur 2'); // @page/@pageTotale résolus
  });
});

describe('mailers', () => {
  it('MemoryMailer collecte les messages', () => {
    const m = new MemoryMailer();
    m.envoyer({ destinataire: 'a@b', sujet: 'S', corpsHtml: '<p>x</p>' });
    expect(m.messages).toHaveLength(1);
    m.vider();
    expect(m.messages).toHaveLength(0);
  });
  it('FonctionMailer délègue à la fonction', () => {
    const recus: string[] = [];
    const m = new FonctionMailer((msg) => { recus.push(msg.destinataire); });
    m.envoyer({ destinataire: 'z@z', sujet: 'S', corpsHtml: '' });
    expect(recus).toEqual(['z@z']);
  });
});

describe('mailing de masse avec MemoryMailer', () => {
  it('envoie un courrier par enregistrement', async () => {
    const { r4, runtime } = buildApp();
    const mailer = new MemoryMailer();
    const res = await new MassMailing(runtime, r4, mailer).envoyer('bienvenue', 'cli', { champEmail: 'email', sujet: 'Bienvenue' });
    expect(res.total).toBe(2);
    expect(res.envoyes).toBe(2);
    expect(mailer.messages.map((m) => m.destinataire).sort()).toEqual(['alice@x.fr', 'bob@x.fr']);
    expect(mailer.messages[0]!.corpsHtml).toContain('Bonjour');
  });
});

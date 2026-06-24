/**
 * Tests des moteurs PDF : SimplePdfRenderer (binaire sans dépendance) et
 * PuppeteerPdfRenderer (lanceur injecté), + genererPdf de bout en bout.
 */
import { describe, it, expect } from 'vitest';
import { htmlVersPdf, SimplePdfRenderer } from '../src/services/pdf-simple.js';
import { PuppeteerPdfRenderer } from '../src/services/pdf-puppeteer.js';
import { documentImprimable, genererPdf } from '../src/services/index.js';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';

const dec = new TextDecoder('latin1');

describe('htmlVersPdf (binaire sans dépendance)', () => {
  it('produit un PDF valide (entête, EOF, catalogue)', () => {
    const pdf = htmlVersPdf('<p>Bonjour le monde</p>');
    const s = dec.decode(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/Type /Catalog');
    expect(s).toContain('/BaseFont /Helvetica');
    expect(s).toContain('startxref');
  });
  it('le texte extrait apparaît dans le flux', () => {
    const s = dec.decode(htmlVersPdf('<h1>Titre</h1><p>Une ligne</p>'));
    expect(s).toContain('(Titre) Tj');
    expect(s).toContain('(Une ligne) Tj');
  });
  it('échappe les parenthèses du texte', () => {
    const s = dec.decode(htmlVersPdf('<p>total (TTC)</p>'));
    expect(s).toContain('total \\(TTC\\)');
  });
  it('une page par saut de page logique', () => {
    const doc = documentImprimable('Page A</page><page>Page B</page><page>Page C');
    const s = dec.decode(htmlVersPdf(doc));
    expect(s).toContain('/Count 3');
    expect((s.match(/\/Type \/Page[^s]/g) ?? [])).toHaveLength(3);
  });
});

describe('SimplePdfRenderer', () => {
  it('rendre() renvoie un Uint8Array PDF', async () => {
    const bytes = await new SimplePdfRenderer().rendre('<p>x</p>');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(dec.decode(bytes).startsWith('%PDF')).toBe(true);
  });
});

describe('genererPdf de bout en bout', () => {
  it('rend une lettre en PDF via le runtime + SimplePdfRenderer', async () => {
    const data = new MemoryLayerStore().definePatron(
      creerPatron('cli', [
        { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
        { nom_champ: 'nom', type_champ: 'string' },
      ], { emplacement: 'D' }),
    );
    const params = new MemoryLayerStore().definePatron(
      creerPatron('let', [{ nom_champ: 'nom_lettre', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }),
    );
    params.putWithKey('let', ['hello'], { nom_lettre: 'hello', table_liee: 'cli', compiler: 1, template: 'Cher @($nom)', champs: {} });
    data.put('cli', { id: 1, nom: 'Alice' });
    const r4 = new R4({ data, paramR4: params });
    const runtime = new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } });

    const bytes = await genererPdf(new SimplePdfRenderer(), runtime, 'hello', ['1']);
    expect(dec.decode(bytes)).toContain('(Cher Alice) Tj');
  });
});

describe('PuppeteerPdfRenderer (lanceur injecté)', () => {
  it('pilote le navigateur et renvoie les octets', async () => {
    const appels: string[] = [];
    let htmlRecu = '';
    const faux = new PuppeteerPdfRenderer({
      lanceur: async () => ({
        newPage: async () => ({
          setContent: async (html) => { htmlRecu = html; appels.push('setContent'); },
          pdf: async () => { appels.push('pdf'); return new Uint8Array([37, 80, 68, 70]); /* %PDF */ },
        }),
        close: async () => { appels.push('close'); },
      }),
    });
    const bytes = await faux.rendre('<h1>Salut</h1>');
    expect(dec.decode(bytes)).toBe('%PDF');
    expect(htmlRecu).toContain('Salut');
    expect(appels).toEqual(['setContent', 'pdf', 'close']);
  });
});

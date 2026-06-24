import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron, type Patron } from '../src/metamodel/index.js';
import { BatchRunner, MassMailing, genererDocumentHtml, genererPdf, type Mailer, type Message } from '../src/services/index.js';

const patContrat: Patron = creerPatron('contrat', [
  { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'client', type_champ: 'string' },
  { nom_champ: 'email', type_champ: 'string' },
  { nom_champ: 'prime', type_champ: 'decimal' },
], { emplacement: 'D' });

const patLet = creerPatron('let', [
  { nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
], { emplacement: 'P' });

function build() {
  const data = new MemoryLayerStore().definePatron(patContrat);
  data.put('contrat', { num: 1, client: 'ACME', email: 'a@acme.tld', prime: 100 });
  data.put('contrat', { num: 2, client: 'Globex', email: 'b@globex.tld', prime: 200 });

  const params = new MemoryLayerStore().definePatron(patLet).definePatron(patContrat);
  params.putWithKey('let', ['rappel'], {
    nom_ecran: 'rappel', table_liee: 'contrat',
    template: 'Cher $client, votre prime est de $prime.', champs: {},
  });

  const r4 = new R4({ data, paramR4: params });
  const runtime = new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } });
  return { r4, runtime, data };
}

describe('services — batch (port des crons)', () => {
  it('recalcule et sauvegarde via expression sur chaque enregistrement', () => {
    const { r4 } = build();
    const batch = new BatchRunner(r4, { user: { login: 'cron', superAdmin: true, niveau: 0 } });
    const res = batch.run('contrat', (record, aides) => {
      record.prime = aides.evaluer('$prime * 1.1'); // +10%
      aides.sauver(record);
    });
    expect(res.total).toBe(2);
    expect(res.traites).toBe(2);
    expect(res.erreurs).toHaveLength(0);
    expect(r4.search('contrat', ['1'])?.record?.prime).toBeCloseTo(110);
    expect(r4.search('contrat', ['2'])?.record?.prime).toBeCloseTo(220);
  });

  it('applique un filtre', () => {
    const { r4 } = build();
    const batch = new BatchRunner(r4);
    const res = batch.run('contrat', (r, a) => { r.prime = 0; a.sauver(r); }, { filtre: 'client=ACME' });
    expect(res.traites).toBe(1);
    expect(r4.search('contrat', ['1'])?.record?.prime).toBe(0);
    expect(r4.search('contrat', ['2'])?.record?.prime).toBe(200); // inchangé
  });
});

describe('services — documents (lettres)', () => {
  it('génère le HTML d’une lettre avec valeurs substituées', () => {
    const { runtime } = build();
    const html = genererDocumentHtml(runtime, 'rappel', ['1']);
    expect(html).toBe('Cher ACME, votre prime est de 100.');
  });

  it('génère un PDF via un PdfRenderer injecté', async () => {
    const { runtime } = build();
    // le moteur doit produire un PDF binaire valide (garde MML_NON_PDF)
    const renderer = { rendre: async (h: string) => new TextEncoder().encode(`%PDF-1.4\n${h}`) };
    const pdf = await genererPdf(renderer, runtime, 'rappel', ['2']);
    expect(new TextDecoder().decode(pdf)).toBe('%PDF-1.4\nCher Globex, votre prime est de 200.');
  });
});

describe('services — mailing de masse', () => {
  it('envoie la lettre à chaque destinataire via un Mailer injecté', async () => {
    const { runtime, r4 } = build();
    const envoyes: Message[] = [];
    const mailer: Mailer = { envoyer: (m) => { envoyes.push(m); } };
    const mm = new MassMailing(runtime, r4, mailer);
    const res = await mm.envoyer('rappel', 'contrat', { champEmail: 'email', sujet: 'Rappel de prime' });

    expect(res.total).toBe(2);
    expect(res.envoyes).toBe(2);
    expect(envoyes.map((m) => m.destinataire).sort()).toEqual(['a@acme.tld', 'b@globex.tld']);
    expect(envoyes.find((m) => m.destinataire === 'a@acme.tld')?.corpsHtml).toBe('Cher ACME, votre prime est de 100.');
    expect(envoyes[0]!.sujet).toBe('Rappel de prime');
  });
});

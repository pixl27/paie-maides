/**
 * Tests du chemin de sauvegarde (port de postageZzz + sauveDocMaitre) :
 * checkbox absente=0, reconstruction des tableaux, auto-incrément, coercition à
 * l'écriture (date/décimal), champs système, widgets documents intouchés.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import type { Ecran } from '../src/runtime/index.js';

const patArt = creerPatron('art', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1, est_autoincrement: 1 },
  { nom_champ: 'nom', type_champ: 'string' },
  { nom_champ: 'actif', type_champ: 'boolean' },
  { nom_champ: 'montant', type_champ: 'decimal' },
  { nom_champ: 'dnaiss', type_champ: 'date' },
  { nom_champ: 'tags', type_champ: 'array' },
  { nom_champ: 'doc', type_champ: 'blob' },
], { emplacement: 'D' });
const patScr = creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const ecran: Ecran & { nom_ecran: string } = {
  nom_ecran: 'art_saisie', table_liee: 'art', template: '',
  champs: {
    id: { type_widget: 'autoInc', type_champ: 'integer' },
    nom: { type_widget: 'text', type_champ: 'string' },
    actif: { type_widget: 'checkbox', type_champ: 'boolean' },
    montant: { type_widget: 'decimal', type_champ: 'decimal' },
    dnaiss: { type_widget: 'date', type_champ: 'date' },
    tags: { type_widget: 'array', type_champ: 'array' },
    doc: { type_widget: 'zonePDF', type_champ: 'blob' },
  },
};

function build() {
  const data = new MemoryLayerStore().definePatron(patArt);
  const params = new MemoryLayerStore().definePatron(patScr);
  params.putWithKey('scr', ['art_saisie'], ecran);
  const r4 = new R4({ data, paramR4: params });
  return { r4, data, runtime: new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } }) };
}

describe('auto-incrément', () => {
  it('génère la clé sur un nouveau document', () => {
    const app = build();
    const a = app.runtime.sauvegarde('art_saisie', [], { nom: 'A' });
    const b = app.runtime.sauvegarde('art_saisie', [], { nom: 'B' });
    expect(a.zzz.cle).toEqual(['1']);
    expect(b.zzz.cle).toEqual(['2']);
  });
});

describe('postageZzz', () => {
  let app: ReturnType<typeof build>;
  beforeEach(() => { app = build(); });

  it('checkbox absente de la soumission => 0', () => {
    const r = app.runtime.sauvegarde('art_saisie', [], { nom: 'A' }); // actif non soumis
    expect(r.zzz.valeurs.actif).toBe(0);
  });
  it('checkbox présente => 1', () => {
    const r = app.runtime.sauvegarde('art_saisie', [], { nom: 'A', actif: '1' });
    expect(r.zzz.valeurs.actif).toBe(1);
  });
  it('reconstruit un champ tableau depuis champ[i]', () => {
    const r = app.runtime.sauvegarde('art_saisie', [], { nom: 'A', 'tags[0]': 'x', 'tags[1]': 'y' });
    expect(r.zzz.valeurs.tags).toEqual(['x', 'y']);
  });
  it('ne touche pas un widget document (zonePDF)', () => {
    const r = app.runtime.sauvegarde('art_saisie', [], { nom: 'A', doc: 'PIRATE' });
    expect(r.zzz.valeurs.doc).not.toBe('PIRATE');
  });
});

describe('coercition à l’écriture + champs système', () => {
  it('date JJ-MM-AAAA -> AAAA-MM-JJ, décimal nettoyé, _id/_key/_type_doc/__tag__', () => {
    const app = build();
    app.runtime.sauvegarde('art_saisie', [], { nom: 'A', montant: '1234.50', dnaiss: '15-06-2020' });
    const rec = app.r4.search('art', ['1'])!.record;
    expect(rec.dnaiss).toBe('2020-06-15'); // JJ-MM-AAAA -> AAAA-MM-JJ
    expect(rec.montant).toBe(1234.5); // décimal coercé en nombre
    expect(rec._type_doc).toBe('art');
    expect(rec._id).toBe('art.1');
    expect(rec.__tag__).toBe(0);
    expect(typeof rec._key).toBe('string');
    expect(rec._key.trim()).toBe('1');
  });
});

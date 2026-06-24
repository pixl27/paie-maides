import { describe, it, expect } from 'vitest';
import { creerPatron, initRecord, valDefForChamp, patronVersDico, keyFromRecord } from '../src/metamodel/index.js';
import type { Champ } from '../src/metamodel/index.js';

const champs: Champ[] = [
  { nom_champ: 'num_police', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'nom', type_champ: 'string', val_def: '' },
  { nom_champ: 'prime', type_champ: 'decimal', val_def: '0' },
  { nom_champ: 'date_effet', type_champ: 'date' },
  { nom_champ: 'garanties', type_champ: 'array', taille_tableau: 3, val_def: '' },
];

describe('métamodèle — patron', () => {
  it('calcule is_key et champsTableau', () => {
    const p = creerPatron('contrat', champs);
    expect(p.is_key).toEqual(['num_police']);
    expect(p.champsTableau).toContain('garanties');
    expect(p.nom_table).toBe('contrat');
  });
});

describe('métamodèle — valeurs par défaut', () => {
  it('selon le type de champ', () => {
    expect(valDefForChamp({ nom_champ: 'a', type_champ: 'integer' })).toBe(0);
    expect(valDefForChamp({ nom_champ: 'a', type_champ: 'decimal' })).toBe('0');
    expect(valDefForChamp({ nom_champ: 'a', type_champ: 'date' })).toBe('0000-00-00');
    expect(valDefForChamp({ nom_champ: 'a', type_champ: 'datetime' })).toBe('0000-00-00 00:00:00');
    expect(valDefForChamp({ nom_champ: 'a', type_champ: 'string', val_def: 'x' })).toBe('x');
    expect(valDefForChamp({ nom_champ: 'a', type_champ: 'integer', est_autoincrement: 1 })).toBe('');
  });
});

describe('métamodèle — initRecord', () => {
  it('crée un enregistrement vide typé + champs système', () => {
    const p = creerPatron('contrat', champs);
    const rec = initRecord(p, ['1001'], 'bob');
    expect(rec._type_doc).toBe('contrat');
    expect(rec.num_police).toBe('1001'); // valeur de clé injectée
    expect(rec.prime).toBe('0');
    expect(rec.date_effet).toBe('0000-00-00');
    expect(Array.isArray(rec.garanties)).toBe(true);
    expect(rec.garanties).toHaveLength(3);
    expect(rec.created_by).toBe('bob');
  });
  it('extrait la clé d’un enregistrement', () => {
    const p = creerPatron('contrat', champs);
    expect(keyFromRecord(p, { num_police: 1001 })).toEqual(['1001']);
  });
  it('produit le dico de types pour les expressions', () => {
    const p = creerPatron('contrat', champs);
    const dico = patronVersDico(p);
    expect(dico.date_effet.type_champ).toBe('date');
    expect(dico.prime.type_champ).toBe('decimal');
  });
});

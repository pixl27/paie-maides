/**
 * Tests de la couche données : séquences, navigation, conditions, agrégats,
 * vues, et intégration R4 (compteurs, auto-incrément, up/down, vues).
 */
import { describe, it, expect } from 'vitest';
import {
  incrementeAlpha, prochaineCle, prochaineCleMinimale, derniereCle,
  up, down, find, findLight, evalCondition, agrege, executeVue, cmpCle,
} from '../src/data/index.js';
import { creerPatron } from '../src/metamodel/types.js';
import { R4 } from '../src/r4/r4.js';
import { MemoryLayerStore } from '../src/r4/memory-store.js';

/* clé composite a.b (entiers), pour la navigation */
const patCon = creerPatron('con', [
  { nom_champ: 'a', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'b', type_champ: 'integer', est_cle: 1, ordre_cle: 2 },
  { nom_champ: 'lib', type_champ: 'clop' },
]);

/* table à clé entière simple auto-incrémentée */
const patAdr = creerPatron('adr', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1, est_autoincrement: 1 },
  { nom_champ: 'nom', type_champ: 'clop' },
]);

const recsCon = [
  { a: 1, b: 1, lib: 'x' }, { a: 1, b: 2, lib: 'y' }, { a: 1, b: 5, lib: 'z' },
  { a: 2, b: 1, lib: 'w' }, { a: 2, b: 3, lib: 'v' },
];

describe('incrementeAlpha', () => {
  it('chiffres puis lettres avec retenue', () => {
    expect(incrementeAlpha('')).toBe('1');
    expect(incrementeAlpha('8')).toBe('9');
    expect(incrementeAlpha('9')).toBe('A');
    expect(incrementeAlpha('Z')).toBe('10');
    expect(incrementeAlpha('AZ')).toBe('B0');
    expect(incrementeAlpha('A9')).toBe('AA');
  });
});

describe('séquences', () => {
  it('derniereCle (clé composite, comparaison typée)', () => {
    expect(derniereCle(recsCon, patCon)).toEqual(['2', '3']);
  });
  it('prochaineCle incrémente le dernier élément entier', () => {
    expect(prochaineCle(recsCon, patCon)).toEqual(['2', '4']);
  });
  it('prochaineCle string -> incrementeAlpha', () => {
    const pat = creerPatron('t', [{ nom_champ: 'k', type_champ: 'string', est_cle: 1, ordre_cle: 1 }]);
    expect(prochaineCle([{ k: 'A9' }], pat)).toEqual(['AA']);
  });
  it('prochaineCle sur table vide', () => {
    expect(prochaineCle([], patAdr)).toEqual(['1']);
  });
  it('prochaineCleMinimale trouve le premier trou', () => {
    const recs = [{ n: 4000 }, { n: 4001 }, { n: 4003 }];
    expect(prochaineCleMinimale(recs, 'n', 4000, 31999)).toBe(4002);
  });
});

describe('navigation up/down', () => {
  it('down avance dans la clé composite', () => {
    expect(down(recsCon, patCon, ['1', '2'])).toMatchObject({ a: 1, b: 5 });
  });
  it('down franchit le 1er niveau (1.5 -> 2.1)', () => {
    expect(down(recsCon, patCon, ['1', '5'])).toMatchObject({ a: 2, b: 1 });
  });
  it('up recule', () => {
    expect(up(recsCon, patCon, ['2', '1'])).toMatchObject({ a: 1, b: 5 });
  });
  it('up sur le premier renvoie null', () => {
    expect(up(recsCon, patCon, ['1', '1'])).toBeNull();
  });
  it('down sur le dernier renvoie null', () => {
    expect(down(recsCon, patCon, ['2', '3'])).toBeNull();
  });
  it('clé vide -> premier (down) / dernier (up)', () => {
    expect(down(recsCon, patCon, [])).toMatchObject({ a: 1, b: 1 });
    expect(up(recsCon, patCon, [])).toMatchObject({ a: 2, b: 3 });
  });
});

describe('find / findLight', () => {
  it('findLight = préfixe de clé', () => {
    expect(findLight(recsCon, patCon, ['1'])).toHaveLength(3);
  });
  it('find par plage [debut, fin[', () => {
    const r = find(recsCon, patCon, ['1', '2'], ['2', '1']);
    expect(r.map((x) => `${x['a']}.${x['b']}`)).toEqual(['1.2', '1.5']);
  });
});

describe('conditions', () => {
  it('comparaisons et et/ou', () => {
    const rec = { x: 5, s: 'abc' };
    expect(evalCondition('x = 5', rec)).toBe(true);
    expect(evalCondition('x >= 5 et x <= 10', rec)).toBe(true);
    expect(evalCondition('x > 10 ou x = 5', rec)).toBe(true);
    expect(evalCondition('x <> 5', rec)).toBe(false);
    expect(evalCondition("s ~~ 'b'", rec)).toBe(true);
  });
});

describe('agrégats', () => {
  const recs = [{ m: 10, t: 'A' }, { m: 20, t: 'A' }, { m: 5, t: 'B' }];
  it('somme avec filtre', () => {
    expect(agrege(recs, 'somme', 'm', "t = 'A'")).toBe(30);
  });
  it('compte / compteunique', () => {
    expect(agrege(recs, 'compte', 'm', '')).toBe(3);
    expect(agrege(recs, 'compteunique', 't', '')).toBe(2);
  });
  it('moyenne / max / min', () => {
    expect(agrege(recs, 'moyenne', 'm', '')).toBeCloseTo(35 / 3);
    expect(agrege(recs, 'max', 'm', '')).toBe(20);
    expect(agrege(recs, 'min', 'm', '')).toBe(5);
  });
});

describe('vues (UNION ALL + conditions + colonnes système)', () => {
  it('combine deux tables et calcule _id/_key/_type_doc', () => {
    const getRecords = (t: string) => (t === 'con' ? recsCon : [{ a: 9, b: 9, lib: 'autre' }]);
    const rows = executeVue({
      nom_vue: 'maVue',
      lignes: [
        { patron: 'con', cle: 'a.b', conditions: ['a = 1'] },
        { patron: 'sin', cle: 'a.b' },
      ],
    }, getRecords);
    expect(rows).toHaveLength(4); // 3 con (a=1) + 1 sin
    const con1 = rows.find((r) => r['_type_doc'] === 'con')!;
    expect(con1['_id']).toMatch(/^con\.1\./);
    expect(rows.some((r) => r['_type_doc'] === 'sin')).toBe(true);
  });
});

describe('intégration R4', () => {
  function makeR4() {
    const data = new MemoryLayerStore().definePatron(patCon).definePatron(patAdr);
    recsCon.forEach((r) => data.put('con', r));
    return new R4({ data });
  }
  it('prochaineCle via R4', () => {
    expect(makeR4().prochaineCle('con')).toEqual(['2', '4']);
  });
  it('insert génère la clé auto-incrémentée', () => {
    const r4 = makeR4();
    r4.insert('adr', { nom: 'Dupont' });
    r4.insert('adr', { nom: 'Martin' });
    const tous = r4.recordsDe('adr');
    expect(tous.map((r) => String(r['id'])).sort()).toEqual(['1', '2']);
  });
  it('up/down via R4', () => {
    const r4 = makeR4();
    expect(r4.down('con', ['1', '2'])).toMatchObject({ b: 5 });
    expect(r4.up('con', ['1', '1'])).toBeNull();
  });
  it('cmpCle utilitaire', () => {
    expect(cmpCle(['1', '2'], ['1', '10'])).toBe(-1); // comparaison numérique
  });
});

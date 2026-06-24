/**
 * Tests navigation & ordres (corrections du ré-audit) : o2/o3 via up/down,
 * o6/o7 via sq_ecran, pile de navigation, options d'ordre, var_transfert,
 * format obe de la sérialisation JSON.
 */
import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime, PileNavigation, parseOrdre } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import type { Ecran } from '../src/runtime/index.js';

const patCon = creerPatron('con', [
  { nom_champ: 'a', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'b', type_champ: 'integer', est_cle: 1, ordre_cle: 2 },
  { nom_champ: 'lib', type_champ: 'string' },
], { emplacement: 'D' });
const patScr = creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const ecranCon: Ecran & { nom_ecran: string } = {
  nom_ecran: 'con_s', table_liee: 'con', var_transfert: '$src := $__ecran',
  template: '$a $b $lib', champs: { a: { type_widget: 'integer' }, b: { type_widget: 'integer' }, lib: { type_widget: 'text' } },
};

function build() {
  const data = new MemoryLayerStore().definePatron(patCon);
  const params = new MemoryLayerStore().definePatron(patScr);
  params.putWithKey('scr', ['con_s'], ecranCon);
  params.putWithKey('sq_ecran', ['parcours'], { sq_nom: 'parcours', sq_ecrans: ['e1', 'e2', 'e3'] });
  [['1', '1'], ['1', '2'], ['1', '5'], ['2', '1']].forEach(([a, b]) => data.put('con', { a, b, lib: `${a}.${b}` }));
  const r4 = new R4({ data, paramR4: params });
  return { r4, runtime: new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } }) };
}

describe('o2/o3 — document suivant/précédent via up/down', () => {
  it('suivant franchit le niveau de clé (1.5 -> 2.1)', () => {
    expect(build().runtime.documentSuivant('con_s', ['1', '5']).cle).toEqual(['2', '1']);
  });
  it('précédent recule (2.1 -> 1.5)', () => {
    expect(build().runtime.documentPrecedent('con_s', ['2', '1']).cle).toEqual(['1', '5']);
  });
});

describe('o6/o7 — séquence d’écrans sq_ecran', () => {
  it('résout suivant/précédent depuis la table sq_ecran (par nom)', () => {
    const rt = build().runtime;
    expect(rt.ecranSuivant('parcours', 'e1')).toBe('e2');
    expect(rt.ecranPrecedent('parcours', 'e2')).toBe('e1');
    expect(rt.ecranSuivant('parcours', 'e3')).toBeNull();
  });
  it('accepte aussi un tableau explicite', () => {
    expect(build().runtime.ecranSuivant(['x', 'y'], 'x')).toBe('y');
  });
});

describe('pile de navigation (gestionPile, ordres -1/-2/-3)', () => {
  it('empile et dépile', () => {
    const p = new PileNavigation();
    p.empile({ e: 'a', b: '' }); p.empile({ e: 'b', b: '' }); p.empile({ e: 'c', b: '' });
    expect(p.taille()).toBe(3);
    expect(p.navigueOrdreNegatif(-1)!.e).toBe('b'); // dépile 1 -> sommet b
    expect(p.navigueOrdreNegatif(-2)).toBeNull(); // dépile 2 -> vide
  });
});

describe('parseOrdre (options_o)', () => {
  it('décode "9:8" et "1"', () => {
    expect(parseOrdre('9:8')).toEqual({ ordre: '9', option: '8' });
    expect(parseOrdre('1')).toEqual({ ordre: '1', option: null });
    expect(parseOrdre(9)).toEqual({ ordre: '9', option: null });
  });
});

describe('var_transfert — ré-injection _vt_', () => {
  it('un _vt_ soumis est replacé dans valeursExtra', () => {
    const rt = build().runtime;
    const { zzz } = rt.postageSeul('con_s', ['1', '1'], { _vt_src: 'origine', lib: 'x' });
    expect(zzz.valeursExtra.src).toBe('origine');
  });
});

describe('serialiseJson — format obe', () => {
  it('obe contient b/e/m/n/p mais pas o', () => {
    const rt = build().runtime;
    const zzz = rt.visu('con_s', ['1', '1']);
    const obe = rt.serialiseJson(zzz).obe;
    expect(obe).toHaveProperty('b');
    expect(obe).toHaveProperty('e', 'con_s');
    expect(obe).toHaveProperty('m');
    expect(obe).toHaveProperty('n');
    expect(obe).toHaveProperty('p');
    expect(obe).not.toHaveProperty('o');
  });
});

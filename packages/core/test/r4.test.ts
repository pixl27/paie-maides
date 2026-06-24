import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore, r4Providers } from '../src/r4/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import { MdExpression } from '../src/expression/index.js';

/** Patrons système utilisés par R4 (formules, tables de paramètres). */
const patFrm = creerPatron('frm', [
  { nom_champ: 'pf01', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'pf02', type_champ: 'string' },
  { nom_champ: 'pf03', type_champ: 'clop' },
], { emplacement: 'P' });

const patTab = creerPatron('tab', [
  { nom_champ: 'tab1', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'tab2', type_champ: 'string', est_cle: 1, ordre_cle: 2 },
  { nom_champ: 'tab3', type_champ: 'string' },
], { emplacement: 'P' });

function buildR4() {
  // Couche générale (R1) : valeurs par défaut
  const r1 = new MemoryLayerStore()
    .definePatron(patFrm).definePatron(patTab)
    .put('frm', { pf01: 'majoration', pf02: 'Majoration', pf03: '10 * 2' })
    .put('tab', { tab1: 'taux', tab2: 'A', tab3: '100' })
    .put('tab', { tab1: 'taux', tab2: 'B', tab3: '200' });

  // Couche spécifique (R4) : surcharge la majoration
  const r4layer = new MemoryLayerStore()
    .definePatron(patFrm)
    .put('frm', { pf01: 'majoration', pf02: 'Majoration spécifique', pf03: '10 * 5' });

  return new R4({ paramR1: r1, paramR4: r4layer }, { niveauParametres: 4 });
}

describe('R4 — cascade & surcharge multi-tenant', () => {
  it('le paramétrage spécifique (R4) surcharge le général (R1)', () => {
    const r4 = buildR4();
    expect(r4.loadFormula('majoration')).toBe('10 * 5'); // R4 gagne
  });
  it('repli sur le général quand le spécifique est absent', () => {
    const r4 = buildR4();
    expect(r4.table('taux', 'A')).toBe('100'); // seulement en R1
    expect(r4.table('taux', 'B')).toBe('200');
  });
  it('search renvoie la couche d’origine', () => {
    const r4 = buildR4();
    const r = r4.search('frm', ['majoration'], 4);
    expect(r?.layer).toBe('paramR4');
  });
});

describe('R4 — tableInf / tableSup', () => {
  const store = new MemoryLayerStore().definePatron(patTab)
    .put('tab', { tab1: 'bareme', tab2: '10', tab3: 'X' })
    .put('tab', { tab1: 'bareme', tab2: '20', tab3: 'Y' })
    .put('tab', { tab1: 'bareme', tab2: '30', tab3: 'Z' });
  const r4 = new R4({ paramR1: store }, { niveauParametres: 4 });

  it('valeur inférieure la plus proche', () => {
    expect(r4.tableInf('bareme', '25')).toBe('Y'); // <= 25 le plus proche = 20
  });
  it('valeur supérieure la plus proche', () => {
    expect(r4.tableSup('bareme', '25')).toBe('Z'); // >= 25 le plus proche = 30
  });
});

describe('R4 — pont avec le moteur d’expressions', () => {
  it('[formule] et table() résolus via R4', () => {
    const r4 = buildR4();
    const e = new MdExpression('[majoration] + table("taux", "A")', { providers: r4Providers(r4) });
    expect(e.calcul().value).toBe(150); // 50 + 100
  });
});

describe('R4 — données d’exploitation (couche data)', () => {
  it('sauvegarde et relecture', () => {
    const data = new MemoryLayerStore().definePatron(creerPatron('contrat', [
      { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
      { nom_champ: 'prime', type_champ: 'decimal' },
    ]));
    const r4 = new R4({ data });
    r4.save('contrat', { num: 1, prime: 500 });
    r4.save('contrat', { num: 2, prime: 750 });
    expect(r4.loadRecord('contrat', '1')?.prime).toBe(500);
    expect(r4.documentExists('contrat', '2')).toBe(true);
    expect(r4.aggregate('somme', 'contrat', 'prime', '')).toBe(1250);
  });
});

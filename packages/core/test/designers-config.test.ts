/**
 * Tests des éditeurs de paramétrage (menus, droits, formules, tables de
 * paramètres, vues, séquences, relations) et de leur intégration au runtime R4.
 */
import { describe, it, expect } from 'vitest';
import {
  MenuEditor, DroitEditor, FormuleEditor, TableParamEditor, VueEditor,
  SequenceEcranEditor, RelationEditor,
} from '../src/designer/editors.js';
import { construitMenu, feuillesMenu } from '../src/menu/menu.js';
import { MemoryLayerStore } from '../src/r4/memory-store.js';
import { R4 } from '../src/r4/r4.js';
import { creerPatron } from '../src/metamodel/types.js';

function setup() {
  const params = new MemoryLayerStore();
  const data = new MemoryLayerStore();
  const r4 = new R4({ paramR4: params, data });
  return { params, data, r4 };
}

describe('MenuEditor', () => {
  it('crée, liste (triée) et supprime des entrées + alimente construitMenu', () => {
    const { params } = setup();
    const m = new MenuEditor(params);
    m.definitEntree({ menu_position: 'z200', menu_libelle: 'Outils', menu_droit: 9 });
    m.definitEntree({ menu_position: 'z100', menu_libelle: 'Fichier', menu_droit: 9 });
    m.definitEntree({ menu_position: 'z110', menu_libelle: 'Ouvrir', menu_script: '?o=1', menu_droit: 9 });
    expect(m.liste().map((e) => e.menu_position)).toEqual(['z100', 'z110', 'z200']);
    const arbre = construitMenu(m.liste(), { login: 'u', superAdmin: false, niveau: 5 });
    expect(feuillesMenu(arbre).some((f) => f.label === 'Ouvrir')).toBe(true);
    expect(m.supprimeEntree('z200')).toBe(true);
    expect(m.liste()).toHaveLength(2);
  });
});

describe('DroitEditor', () => {
  it('définit des droits par groupe ; défaut vide => C', () => {
    const { params } = setup();
    const d = new DroitEditor(params);
    d.definitDroit('con', 'con_5', 3, 'L');
    d.definitDroit('con', 'con_5', 9, 'P');
    expect(d.getDroit('con', 'con_5', 3)).toBe('L');
    expect(d.getDroit('con', 'con_5', 9)).toBe('P');
    expect(d.getDroit('con', 'con_5', 1)).toBe('C'); // non défini => C
    const grille = d.grille('con');
    expect(grille['con_5']![3]).toBe('L');
  });
});

describe('FormuleEditor + R4.loadFormula', () => {
  it('une formule nommée est exploitable par les expressions [nom]', () => {
    const { params, r4 } = setup();
    new FormuleEditor(params).definitFormule('majoration', '10 * 2');
    expect(r4.loadFormula('majoration')).toBe('10 * 2');
  });
});

describe('TableParamEditor + R4.table', () => {
  it('une table de paramètres est lisible via table()', () => {
    const { params, r4 } = setup();
    const t = new TableParamEditor(params);
    t.definit('tva', 'normal', 20);
    t.definit('tva', 'reduit', 5.5);
    expect(r4.table('tva', 'normal')).toBe(20);
    expect(t.liste('tva').map((x) => x.cle)).toEqual(['normal', 'reduit']);
    expect(t.supprime('tva', 'reduit')).toBe(true);
  });
});

describe('VueEditor + R4.executeVueParNom', () => {
  it('une vue définie est exécutée par le runtime', () => {
    const { params, data, r4 } = setup();
    const patCon = creerPatron('con', [
      { nom_champ: 'con_1', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
      { nom_champ: 'statut', type_champ: 'integer' },
    ]);
    data.definePatron(patCon);
    data.put('con', { con_1: 1, statut: 1 });
    data.put('con', { con_1: 2, statut: 9 });
    new VueEditor(params).definitVue({
      nom_vue: 'con_actifs', lignes: [{ patron: 'con', cle: 'con_1', conditions: ['statut = 1'] }],
    });
    const rows = r4.executeVueParNom('con_actifs');
    expect(rows).toHaveLength(1);
    expect(rows[0]!['_type_doc']).toBe('con');
    expect(rows[0]!['_id']).toBe('con.1');
  });
});

describe('SequenceEcranEditor', () => {
  it('navigue suivant/précédent dans une séquence', () => {
    const { params } = setup();
    const s = new SequenceEcranEditor(params);
    s.definitSequence('contrat', ['ecran1', 'ecran2', 'ecran3']);
    expect(s.getSequence('contrat')).toEqual(['ecran1', 'ecran2', 'ecran3']);
    expect(s.voisin('contrat', 'ecran1', 'suivant')).toBe('ecran2');
    expect(s.voisin('contrat', 'ecran2', 'precedent')).toBe('ecran1');
    expect(s.voisin('contrat', 'ecran3', 'suivant')).toBeNull();
  });
});

describe('RelationEditor', () => {
  it('ajoute/liste/supprime des relations sur un patron', () => {
    const { data } = setup();
    data.definePatron(creerPatron('con', [{ nom_champ: 'con_1', type_champ: 'integer', est_cle: 1, ordre_cle: 1 }]));
    const r = new RelationEditor(data);
    r.ajouteRelation('con', { nom: 'quittances', type: 'enfants', table: 'qit', cle_locale: ['con_1'], cle_distante: ['qit_con'] });
    expect(r.liste('con')).toHaveLength(1);
    expect(r.liste('con')[0]!.nom).toBe('quittances');
    r.supprimeRelation('con', 'quittances');
    expect(r.liste('con')).toHaveLength(0);
  });
});

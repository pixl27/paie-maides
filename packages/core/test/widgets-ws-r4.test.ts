/**
 * Tests P2 : alias/boutons/recherche de widgets, R4.getEmplacement + repli vue,
 * web services runtime (rechercheComplete / valeurParametre).
 */
import { describe, it, expect } from 'vitest';
import { getWidgetRenderer, typesWidgetsSupportes } from '../src/rendering/widgets.js';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';

const ctrl = (type: string, widget: any = {}, valeur?: any) =>
  getWidgetRenderer(type)({ nomChamp: 'c', widget: { type_widget: type, ...widget }, valeur });

describe('widgets : alias, boutons, recherche', () => {
  it('alias de type (casse / synonymes)', () => {
    expect(typesWidgetsSupportes()).toEqual(expect.arrayContaining(['checkbox', 'textArea', 'timestamp', 'buttonClose', 'bigSearch', 'simpleSearch', 'fullSearch']));
    expect(ctrl('checkbox', {}, 1)).toContain('type="checkbox"');
    expect(ctrl('textArea', {}, 'x')).toContain('<textarea');
    expect(ctrl('timestamp', {}, '')).toContain('datetime-local');
  });
  it('ordreBoutonObe : attributs OBE + raccourci souligné', () => {
    const h = ctrl('ordreBoutonObe', { libelle: '[E]nregistrer', option_type_widget: 'o=9\nb=4000\ne=aax_con\nconfirm=Sûr ?' });
    expect(h).toContain('data-o="9"');
    expect(h).toContain('data-b="4000"');
    expect(h).toContain('data-e="aax_con"');
    expect(h).toContain('data-confirm="Sûr ?"');
    expect(h).toContain('<u>E</u>nregistrer');
  });
  it('buttonClose', () => expect(ctrl('buttonClose', { libelle: 'Fermer' })).toContain('data-md-close'));
  it('champs de recherche', () => {
    expect(ctrl('bigSearch')).toContain('data-search="bigSearch"');
    expect(ctrl('fullSearch')).toContain('data-search="fullSearch"');
  });
});

const patCon = creerPatron('con', [{ nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 }, { nom_champ: 'nom', type_champ: 'string' }, { nom_champ: 'st', type_champ: 'integer' }], { emplacement: 'D' });
const patTab = creerPatron('tab', [{ nom_champ: 'tab1', type_champ: 'string', est_cle: 1, ordre_cle: 1 }, { nom_champ: 'tab2', type_champ: 'string', est_cle: 1, ordre_cle: 2 }, { nom_champ: 'tab3', type_champ: 'string' }], { emplacement: 'P' });
const patVue = creerPatron('vue', [{ nom_champ: 'vueCle', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });

function build() {
  const data = new MemoryLayerStore().definePatron(patCon);
  const params = new MemoryLayerStore().definePatron(patTab).definePatron(patVue);
  data.put('con', { id: 1, nom: 'Dupont', st: 1 });
  data.put('con', { id: 2, nom: 'Martin', st: 9 });
  params.putWithKey('tab', ['civ', 'M'], { tab1: 'civ', tab2: 'M', tab3: 'Monsieur' });
  params.putWithKey('vue', ['con_actifs'], { vueCle: 'con_actifs', lignes: [{ patron: 'con', cle: 'id', conditions: ['st = 1'] }] });
  const r4 = new R4({ data, paramR4: params });
  return { r4, runtime: new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } }) };
}

describe('R4.getEmplacement + repli vue', () => {
  it('résout P/D et traite une vue comme D', () => {
    const { r4 } = build();
    expect(r4.getEmplacement('con')).toBe('D');
    expect(r4.getEmplacement('tab')).toBe('P');
    expect(r4.getEmplacement('con_actifs')).toBe('D'); // vue
    expect(r4.getEmplacement('inconnu')).toBeNull();
  });
  it('recordsDe exécute une vue quand la table est une vue', () => {
    const rows = build().r4.recordsDe('con_actifs');
    expect(rows).toHaveLength(1);
    expect(rows[0]!['_type_doc']).toBe('con');
  });
});

describe('web services runtime', () => {
  it('rechercheComplete (plein-texte)', () => {
    const r = build().runtime.rechercheComplete('con', 'martin');
    expect(r).toHaveLength(1);
    expect(r[0]!['nom']).toBe('Martin');
  });
  it('valeurParametre (table de paramètres)', () => {
    expect(build().runtime.valeurParametre('civ', 'M')).toBe('Monsieur');
  });
});

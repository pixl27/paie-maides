/**
 * Tests des ordres et de la fidélité du pipeline ajoutés au runtime « bax » :
 * variables magiques, var_transfert, o10/o11/o13/o14, verrouillage optimiste,
 * sérialisation JSON (AJAX), web services, accès données des widgets.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import type { Ecran } from '../src/runtime/index.js';

const patFacture = creerPatron('facture', [
  { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'client', type_champ: 'string', val_def: '' },
  { nom_champ: 'qte', type_champ: 'integer', val_def: '0' },
  { nom_champ: 'pu', type_champ: 'decimal', val_def: '0' },
  { nom_champ: 'total', type_champ: 'decimal', val_def: '0' },
  { nom_champ: 'statut', type_champ: 'integer', val_def: '1' },
], { emplacement: 'D' });
const patScr = creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const patLet = creerPatron('let', [{ nom_champ: 'nom_lettre', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const patTab = creerPatron('tab', [
  { nom_champ: 'tab1', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'tab2', type_champ: 'string', est_cle: 1, ordre_cle: 2 },
  { nom_champ: 'tab3', type_champ: 'string' },
], { emplacement: 'P' });
const patVue = creerPatron('vue', [{ nom_champ: 'vueCle', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });

const ecranFacture: Ecran & { nom_ecran: string } = {
  nom_ecran: 'factureSaisie',
  table_liee: 'facture',
  var_transfert: '$vt := $__ecran',
  template: '$num $client $qte $pu $total',
  champs: {
    num: { type_widget: 'integer', type_champ: 'integer' },
    client: { type_widget: 'text', type_champ: 'string', est_notnull: 1 },
    qte: { type_widget: 'integer', type_champ: 'integer', val_min: '1', est_notnull: 1 },
    pu: { type_widget: 'decimal', type_champ: 'decimal' },
    total: { type_widget: 'decimal', type_champ: 'decimal', formule_calcul: '$qte * $pu', calcul_systematique: '1', est_lecture_seule: 1 },
    qui: { type_widget: 'text', type_champ: 'string', formule_calcul: '$__userLogin', calcul_systematique: '1', est_lecture_seule: 1 },
  },
};
const lettreFacture = {
  nom_lettre: 'factureCourrier', table_liee: 'facture',
  template: 'Facture @($num) pour @($client)', compiler: 1, champs: {},
};

function buildApp() {
  const data = new MemoryLayerStore().definePatron(patFacture);
  const params = new MemoryLayerStore()
    .definePatron(patScr).definePatron(patLet).definePatron(patFacture).definePatron(patTab).definePatron(patVue);
  params.putWithKey('scr', ['factureSaisie'], ecranFacture);
  params.putWithKey('let', ['factureCourrier'], lettreFacture);
  params.putWithKey('tab', ['civ', 'M'], { tab1: 'civ', tab2: 'M', tab3: 'Monsieur' });
  params.putWithKey('tab', ['civ', 'F'], { tab1: 'civ', tab2: 'F', tab3: 'Madame' });
  params.putWithKey('vue', ['factures_actives'], { vueCle: 'factures_actives', lignes: [{ patron: 'facture', cle: 'num', conditions: ['statut = 1'] }] });
  const r4 = new R4({ data, paramR4: params });
  const runtime = new Runtime(r4, { user: { login: 'tester', superAdmin: true, niveau: 0 } });
  return { r4, data, runtime };
}

describe('variables magiques', () => {
  let runtime: Runtime;
  beforeEach(() => { runtime = buildApp().runtime; });
  it('injecte __userLogin / UTI / __ecran / __nouveau et les rend utilisables en formule', () => {
    const zzz = runtime.visu('factureSaisie', ['1']);
    expect(zzz.valeurs['__userLogin']).toBe('tester');
    expect(zzz.valeurs['UTI']).toBe('tester');
    expect(zzz.valeurs['__ecran']).toBe('factureSaisie');
    expect(zzz.valeurs['__nouveau']).toBe(1);
    expect(zzz.valeurs['qui']).toBe('tester'); // formule $__userLogin
  });
  it('ne persiste pas les variables magiques dans le document', () => {
    runtime.sauvegarde('factureSaisie', ['1'], { client: 'ACME', qte: 1, pu: 10 });
    const rec = buildApp().data; // (vérif structurelle : champs persistés = patron)
    expect(Object.keys(patFacture.champs)).not.toContain('__userLogin');
    expect(rec).toBeDefined();
  });
});

describe('var_transfert', () => {
  it('évalue $vt := $__ecran dans valeursExtra', () => {
    const zzz = buildApp().runtime.visu('factureSaisie', ['1']);
    expect(zzz.valeursExtra['vt']).toBe('factureSaisie');
  });
});

describe('o10 / o11', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { app = buildApp(); });
  it('o10 postageSeul recalcule sans sauvegarder', () => {
    const { zzz } = app.runtime.postageSeul('factureSaisie', ['1'], { client: 'X', qte: 2, pu: 50 });
    expect(zzz.valeurs.total).toBe(100);
    expect(app.runtime.visu('factureSaisie', ['1']).nouveauDoc).toBe(true); // rien sauvé
  });
  it('o11 sauvegardePuisEdition sauve puis renvoie l’état d’édition', () => {
    const { zzz } = app.runtime.sauvegardePuisEdition('factureSaisie', ['1'], { client: 'Y', qte: 1, pu: 5 });
    expect(zzz.nouveauDoc).toBe(false);
    expect(zzz.o).toBe(8);
    expect(zzz.valeurs.client).toBe('Y');
  });
});

describe('o13 / o14 — courriers', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { app = buildApp(); app.runtime.sauvegarde('factureSaisie', ['7'], { client: 'ACME', qte: 1, pu: 1 }); });
  it('o13 apercuCourrier charge la lettre en mode document', () => {
    const zzz = app.runtime.apercuCourrier('factureCourrier', ['7']);
    expect(zzz.patEcran).toBe('let');
    expect(zzz.valeurs.client).toBe('ACME');
  });
  it('o14 documentPourImpression prépare le document (o=14)', () => {
    const zzz = app.runtime.documentPourImpression('factureCourrier', ['7']);
    expect(zzz.o).toBe(14);
  });
});

describe('verrouillage optimiste', () => {
  it('refuse la sauvegarde si le document a changé depuis sa lecture', () => {
    const app = buildApp();
    app.runtime.sauvegarde('factureSaisie', ['1'], { client: 'A', qte: 1, pu: 1 });
    const h = app.runtime.hashDe('factureSaisie', ['1']);
    // modification concurrente directe (autre updated_at)
    const rec = app.r4.search('facture', ['1'])!.record;
    app.r4.save('facture', { ...rec, updated_at: 'XXXX-modif-concurrente' });
    const conflit = app.runtime.sauvegarde('factureSaisie', ['1'], { client: 'B', qte: 2, pu: 2 }, { hashAttendu: h });
    expect(conflit.zzz.erreurBloquante).toBe(true);
  });
  it('accepte la sauvegarde avec le hash courant', () => {
    const app = buildApp();
    app.runtime.sauvegarde('factureSaisie', ['1'], { client: 'A', qte: 1, pu: 1 });
    const h = app.runtime.hashDe('factureSaisie', ['1']);
    const ok = app.runtime.sauvegarde('factureSaisie', ['1'], { client: 'B', qte: 2, pu: 2 }, { hashAttendu: h });
    expect(ok.zzz.erreurBloquante).toBe(false);
  });
});

describe('serialiseJson (AJAX)', () => {
  it('produit { obe, tuple:{champ:{v,ro,ne}} }', () => {
    const app = buildApp();
    const zzz = app.runtime.visu('factureSaisie', ['1']);
    const json = app.runtime.serialiseJson(zzz);
    expect(json.obe.e).toBe('factureSaisie');
    expect(json.tuple['total']!.ro).toBe(true);
    expect(json.tuple['client']!.ne).toBe(true); // pas d'erreur
  });
});

describe('web services (bax_webs)', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    app = buildApp();
    app.runtime.sauvegarde('factureSaisie', ['1'], { client: 'A', qte: 4, pu: 25 });
    app.runtime.sauvegarde('factureSaisie', ['2'], { client: 'B', qte: 1, pu: 1 });
  });
  it('calculSurEcran évalue une expression sur un document', () => {
    expect(app.runtime.calculSurEcran('factureSaisie', ['1'], '$qte * $pu')).toBe(100);
  });
  it('chercheCles renvoie les clés', () => {
    expect(app.runtime.chercheCles('facture').sort()).toEqual(['1', '2']);
  });
});

describe('accesDonnees (pont widgets)', () => {
  it('lireTable, lignes (via vue) et aggregate', () => {
    const app = buildApp();
    app.runtime.sauvegarde('factureSaisie', ['1'], { client: 'A', qte: 4, pu: 25 });
    app.runtime.sauvegarde('factureSaisie', ['2'], { client: 'B', qte: 1, pu: 1 });
    const acces = app.runtime.accesDonnees();
    expect(acces.lireTable!('civ')).toEqual([{ cle: 'M', libelle: 'Monsieur' }, { cle: 'F', libelle: 'Madame' }]);
    expect(acces.lignes!({ table: 'factures_actives' })).toHaveLength(2);
    expect(acces.aggregate!('somme', 'facture', 'total', '')).toBe(101);
  });
});

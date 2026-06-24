import { describe, it, expect } from 'vitest';
import { PatronEditor, EcranEditor } from '../src/designer/index.js';
import { MemoryLayerStore, R4 } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';

describe('PatronEditor — édition de structures', () => {
  it('crée une table, ajoute des champs, définit la clé', () => {
    const store = new MemoryLayerStore();
    const ed = new PatronEditor(store);
    ed.creerTable('produit', { emplacement: 'D' });
    ed.ajouteChamp('produit', { nom_champ: 'ref', type_champ: 'string' });
    ed.ajouteChamp('produit', { nom_champ: 'libelle', type_champ: 'string' });
    ed.ajouteChamp('produit', { nom_champ: 'prix', type_champ: 'decimal' });
    const p = ed.definitCle('produit', ['ref']);
    expect(p.is_key).toEqual(['ref']);
    expect(Object.keys(p.champs)).toEqual(['ref', 'libelle', 'prix']);
  });

  it('modifie, supprime un champ et clone une table', () => {
    const store = new MemoryLayerStore();
    const ed = new PatronEditor(store);
    ed.creerTable('t1');
    ed.ajouteChamp('t1', { nom_champ: 'a', type_champ: 'integer' });
    ed.modifieChamp('t1', 'a', { val_def: '5' });
    expect(ed.getPatron('t1').champs.a.val_def).toBe('5');
    ed.ajouteChamp('t1', { nom_champ: 'b', type_champ: 'string' });
    ed.supprimeChamp('t1', 'b');
    expect(ed.getPatron('t1').champs.b).toBeUndefined();
    ed.cloneTable('t1', 't2');
    expect(ed.getPatron('t2').champs.a.val_def).toBe('5');
  });

  it('refuse de créer une table existante', () => {
    const store = new MemoryLayerStore();
    const ed = new PatronEditor(store);
    ed.creerTable('x');
    expect(() => ed.creerTable('x')).toThrow();
  });
});

describe('EcranEditor — édition d’écrans', () => {
  it('crée un écran, place des widgets, clone', () => {
    const store = new MemoryLayerStore().definePatron(creerPatron('scr', [
      { nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
    ]));
    const ed = new EcranEditor(store);
    ed.creerEcran('saisie', { table_liee: 'produit', template: '$ref $prix' });
    ed.placeWidget('saisie', 'ref', { type_widget: 'text', libelle: 'Référence' });
    ed.placeWidget('saisie', 'prix', { type_widget: 'decimal', libelle: 'Prix' });
    const e = ed.getEcran('saisie');
    expect(e.table_liee).toBe('produit');
    expect(Object.keys(e.champs)).toEqual(['ref', 'prix']);
    ed.cloneEcran('saisie', 'saisie2');
    expect(ed.getEcran('saisie2').champs.ref.libelle).toBe('Référence');
  });
});

describe('auto-hébergement : construire une appli avec les designers puis l’exécuter', () => {
  it('aucune définition codée en dur : tout est créé via les éditeurs', () => {
    const data = new MemoryLayerStore();
    const params = new MemoryLayerStore().definePatron(creerPatron('scr', [
      { nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
    ]));

    // 1) Conception de la structure de données via le designer
    const patronEd = new PatronEditor(data);
    patronEd.creerTable('commande', { emplacement: 'D' });
    patronEd.ajouteChamp('commande', { nom_champ: 'num', type_champ: 'integer' });
    patronEd.ajouteChamp('commande', { nom_champ: 'qte', type_champ: 'integer', val_def: '0' });
    patronEd.ajouteChamp('commande', { nom_champ: 'pu', type_champ: 'decimal', val_def: '0' });
    patronEd.ajouteChamp('commande', { nom_champ: 'total', type_champ: 'decimal', val_def: '0' });
    patronEd.definitCle('commande', ['num']);
    // le patron doit aussi être visible côté params pour chargePatron
    params.savePatron(patronEd.getPatron('commande'));

    // 2) Conception de l'écran via le designer
    const ecranEd = new EcranEditor(params);
    ecranEd.creerEcran('commandeSaisie', { table_liee: 'commande', template: '$num $qte $pu $total' });
    ecranEd.placeWidget('commandeSaisie', 'num', { type_widget: 'integer' });
    ecranEd.placeWidget('commandeSaisie', 'qte', { type_widget: 'integer', est_notnull: 1, val_min: '1' });
    ecranEd.placeWidget('commandeSaisie', 'pu', { type_widget: 'decimal' });
    ecranEd.placeWidget('commandeSaisie', 'total', {
      type_widget: 'decimal', formule_calcul: '$qte * $pu', calcul_systematique: '1', est_lecture_seule: 1,
    });

    // 3) Exécution de l'appli ainsi construite, par le runtime générique
    const r4 = new R4({ data, paramR4: params });
    const runtime = new Runtime(r4, { user: { login: 'designer', superAdmin: true, niveau: 0 } });
    const { zzz, validation } = runtime.sauvegarde('commandeSaisie', ['1'], { qte: 5, pu: 20 });

    expect(validation.erreurBloquante).toBe(false);
    expect(zzz.valeurs.total).toBe(100); // formule appliquée
    expect(runtime.visu('commandeSaisie', ['1']).valeurs.total).toBe(100);
  });
});

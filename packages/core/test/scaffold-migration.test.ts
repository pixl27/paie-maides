import { describe, it, expect } from 'vitest';
import { MemoryLayerStore, R4 } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { initialiserApplication, creerApplicationDeBase } from '../src/scaffold/index.js';
import { importerDefinitions, importerLegacy, depuisLignesLegacy } from '../src/migration/index.js';

describe('scaffold — nouvelle application', () => {
  it('installe les patrons système', () => {
    const store = new MemoryLayerStore();
    initialiserApplication(store);
    for (const sys of ['scr', 'let', 'frm', 'tab', 'menu', 'vue']) {
      expect(store.loadPatron(sys)).not.toBeNull();
    }
  });
  it('application de base : écran accueil + entrée de menu', () => {
    const store = new MemoryLayerStore();
    creerApplicationDeBase(store);
    expect(store.search('scr', ['accueil'])?.template).toContain('Bienvenue');
    expect(store.search('menu', ['1000'])?.menu_libelle).toBe('Accueil');
  });
});

describe('migration — mapper legacy MySQL', () => {
  it('convertit patrons + patrons_champs en patrons normalisés', () => {
    const patrons = depuisLignesLegacy(
      [{ nom_table: 'contrat', emplacement: 'D' }],
      [
        { nom_table: 'contrat', nom_champ: 'num', type_champ: 'integer', est_cle: '1', ordre_cle: '1' },
        { nom_table: 'contrat', nom_champ: 'prime', type_champ: 'decimal' },
      ],
    );
    expect(patrons[0]!.nom_table).toBe('contrat');
    expect(patrons[0]!.champs).toHaveLength(2);
    expect(patrons[0]!.champs[0]!.est_cle).toBe(1);
  });
});

describe('migration — reprise complète puis exécution (scénario assurance)', () => {
  it('scaffold + import legacy (MySQL + CouchDB) puis on LANCE l’appli importée', () => {
    const params = new MemoryLayerStore();
    const data = new MemoryLayerStore();
    initialiserApplication(params); // patrons système (dont scr) requis pour importer les écrans

    const res = importerLegacy(params, {
      patrons: [{ nom_table: 'contrat', emplacement: 'D' }],
      champs: [
        { nom_table: 'contrat', nom_champ: 'num', type_champ: 'integer', est_cle: '1', ordre_cle: '1' },
        { nom_table: 'contrat', nom_champ: 'qte', type_champ: 'integer', val_def: '0' },
        { nom_table: 'contrat', nom_champ: 'pu', type_champ: 'decimal', val_def: '0' },
        { nom_table: 'contrat', nom_champ: 'total', type_champ: 'decimal', val_def: '0' },
      ],
      documents: [
        {
          type_doc: 'scr',
          docs: [{
            nom_ecran: 'contratEcran', table_liee: 'contrat', template: '$num $qte $pu $total',
            champs: {
              num: { type_widget: 'integer' },
              qte: { type_widget: 'integer' },
              pu: { type_widget: 'decimal' },
              total: { type_widget: 'decimal', formule_calcul: '$qte * $pu', calcul_systematique: '1' },
            },
          }],
        },
      ],
    });

    expect(res.patrons).toBe(1);
    expect(res.documents).toBe(1);
    expect(params.loadPatron('contrat')?.is_key).toEqual(['num']);

    // L'application importée est immédiatement exécutable par le runtime
    const r4 = new R4({ data, paramR4: params });
    const runtime = new Runtime(r4, { user: { login: 'migr', superAdmin: true, niveau: 0 } });
    const { zzz, validation } = runtime.sauvegarde('contratEcran', ['1'], { qte: 7, pu: 10 });
    expect(validation.erreurBloquante).toBe(false);
    expect(zzz.valeurs.total).toBe(70); // formule importée appliquée
    expect(runtime.visu('contratEcran', ['1']).valeurs.total).toBe(70); // persisté + relu
  });

  it('importerDefinitions (format normalisé)', () => {
    const store = new MemoryLayerStore();
    const res = importerDefinitions(store, {
      patrons: [{ nom_table: 'client', emplacement: 'D', champs: [{ nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 }] }],
      documents: [{ type_doc: 'client', data: { id: 5, nom: 'Z' } }],
    });
    expect(res).toEqual({ patrons: 1, documents: 1 });
    expect(store.search('client', ['5'])?.nom).toBe('Z');
  });
});

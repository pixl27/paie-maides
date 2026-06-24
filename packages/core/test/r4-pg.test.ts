import { describe, it, expect } from 'vitest';
import { PgDocumentRepository, PgLayerStore, type Queryable } from '../src/r4/pg/index.js';
import { R4 } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron, type Patron } from '../src/metamodel/index.js';
import type { Ecran } from '../src/runtime/index.js';

/**
 * Faux client SQL simulant PostgreSQL (tables maides_patron / maides_doc en
 * mémoire). Valide le câblage SQL/paramètres de PgDocumentRepository sans serveur.
 */
class FakePg implements Queryable {
  patrons = new Map<string, Patron>(); // clé "layer|nom"
  docs = new Map<string, { type_doc: string; cle: string; data: any }>(); // clé "layer|type|cle"

  async query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
    const sql = text.trim().toLowerCase();
    if (sql.startsWith('create table') || sql.includes('create table if not exists')) return { rows: [] };

    if (sql.startsWith('insert into maides_patron')) {
      this.patrons.set(`${params[0]}|${params[1]}`, JSON.parse(params[2]));
      return { rows: [] };
    }
    if (sql.startsWith('select def from maides_patron')) {
      const out = [...this.patrons.entries()].filter(([k]) => k.startsWith(`${params[0]}|`)).map(([, def]) => ({ def }));
      return { rows: out as T[] };
    }
    if (sql.startsWith('delete from maides_patron')) {
      this.patrons.delete(`${params[0]}|${params[1]}`);
      return { rows: [] };
    }
    if (sql.startsWith('insert into maides_doc')) {
      this.docs.set(`${params[0]}|${params[1]}|${params[2]}`, { type_doc: params[1], cle: params[2], data: JSON.parse(params[3]) });
      return { rows: [] };
    }
    if (sql.startsWith('select type_doc, cle, data from maides_doc')) {
      const out = [...this.docs.entries()].filter(([k]) => k.startsWith(`${params[0]}|`)).map(([, v]) => v);
      return { rows: out as T[] };
    }
    if (sql.startsWith('delete from maides_doc')) {
      this.docs.delete(`${params[0]}|${params[1]}|${params[2]}`);
      return { rows: [] };
    }
    throw new Error(`FakePg : requête non gérée: ${sql.slice(0, 40)}`);
  }
}

describe('persistance PostgreSQL (via faux client)', () => {
  it('PgDocumentRepository : round-trip patrons et documents', async () => {
    const repo = new PgDocumentRepository(new FakePg());
    await repo.ensureSchema();
    const p = creerPatron('client', [{ nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 }]);
    await repo.upsertPatron('paramR4', p);
    expect((await repo.allPatrons('paramR4'))[0]!.nom_table).toBe('client');

    await repo.upsertDoc('data', 'client', '1', { id: 1, nom: 'ACME' });
    const docs = await repo.allDocs('data');
    expect(docs).toHaveLength(1);
    expect(docs[0]!.data.nom).toBe('ACME');

    await repo.deleteDoc('data', 'client', '1');
    expect(await repo.allDocs('data')).toHaveLength(0);
  });

  it('PgLayerStore : écriture (write-through) puis relecture après rechargement', async () => {
    const repo = new PgDocumentRepository(new FakePg());
    const store1 = new PgLayerStore(repo, 'data');
    await store1.load();
    store1.savePatron(creerPatron('produit', [
      { nom_champ: 'ref', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
      { nom_champ: 'prix', type_champ: 'decimal' },
    ]));
    store1.save('produit', { ref: 'A1', prix: 9.9 });
    await store1.flush();

    // nouvelle instance : on recharge depuis le dépôt
    const store2 = new PgLayerStore(repo, 'data');
    await store2.load();
    expect(store2.loadPatron('produit')?.is_key).toEqual(['ref']);
    expect(store2.search('produit', ['A1'])?.prix).toBe(9.9);
  });

  it('pile complète : Runtime sur R4 persisté, sauvegarde puis relecture', async () => {
    const repo = new PgDocumentRepository(new FakePg());

    // couche params : patron scr + écran
    const params = new PgLayerStore(repo, 'paramR4');
    await params.load();
    params.savePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }]));
    params.savePatron(creerPatron('facture', [
      { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
      { nom_champ: 'qte', type_champ: 'integer', val_def: '0' },
      { nom_champ: 'pu', type_champ: 'decimal', val_def: '0' },
      { nom_champ: 'total', type_champ: 'decimal', val_def: '0' },
    ], { emplacement: 'D' }));
    const ecran: Ecran & { nom_ecran: string } = {
      nom_ecran: 'fact', table_liee: 'facture', template: '$num $qte $pu $total',
      champs: {
        num: { type_widget: 'integer' },
        qte: { type_widget: 'integer' },
        pu: { type_widget: 'decimal' },
        total: { type_widget: 'decimal', formule_calcul: '$qte * $pu', calcul_systematique: '1' },
      },
    };
    params.save('scr', ecran);
    await params.flush();

    // couche data
    const data = new PgLayerStore(repo, 'data');
    await data.load();

    const r4 = new R4({ data, paramR4: params });
    const runtime = new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } });
    const { zzz } = runtime.sauvegarde('fact', ['1'], { qte: 4, pu: 50 });
    expect(zzz.valeurs.total).toBe(200);
    await data.flush();

    // on recharge la couche data depuis le dépôt et on relit
    const data2 = new PgLayerStore(repo, 'data');
    await data2.load();
    expect(data2.search('facture', ['1'])?.total).toBe(200);
  });
});

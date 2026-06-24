/**
 * Persistance PostgreSQL des couches R4 (modèle document sur JSONB).
 *
 * Schéma :
 *  - maides_patron(layer, nom_table, def jsonb)            -> définitions de patrons
 *  - maides_doc(layer, type_doc, cle, data jsonb)          -> enregistrements/documents
 *
 * Le client est abstrait par `Queryable` (compatible avec `pg.Pool`/`pg.Client`),
 * pour ne pas imposer de dépendance et rester testable avec un faux client.
 */

import { Patron } from '../../metamodel/types.js';

/** Client SQL minimal (compatible pg.Pool/pg.Client). */
export interface Queryable {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>;
}

/** Document persistant. */
export interface DocRow {
  type_doc: string;
  cle: string;
  data: Record<string, any>;
}

/** Dépôt de documents et patrons pour une base (toutes couches). */
export interface DocumentRepository {
  allPatrons(layer: string): Promise<Patron[]>;
  upsertPatron(layer: string, patron: Patron): Promise<void>;
  deletePatron(layer: string, nomTable: string): Promise<void>;
  allDocs(layer: string): Promise<DocRow[]>;
  upsertDoc(layer: string, typeDoc: string, cle: string, data: Record<string, any>): Promise<void>;
  deleteDoc(layer: string, typeDoc: string, cle: string): Promise<void>;
}

/** DDL du schéma (à exécuter une fois). */
export const SCHEMA_SQL = `
create table if not exists maides_patron (
  layer text not null,
  nom_table text not null,
  def jsonb not null,
  primary key (layer, nom_table)
);
create table if not exists maides_doc (
  layer text not null,
  type_doc text not null,
  cle text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (layer, type_doc, cle)
);
create index if not exists idx_maides_doc_type on maides_doc(layer, type_doc);
`;

/** Implémentation PostgreSQL de DocumentRepository. */
export class PgDocumentRepository implements DocumentRepository {
  constructor(private client: Queryable) {}

  /** Crée le schéma si nécessaire. */
  async ensureSchema(): Promise<void> {
    await this.client.query(SCHEMA_SQL);
  }

  async allPatrons(layer: string): Promise<Patron[]> {
    const { rows } = await this.client.query<{ def: Patron }>(
      'select def from maides_patron where layer = $1', [layer],
    );
    return rows.map((r) => r.def);
  }

  async upsertPatron(layer: string, patron: Patron): Promise<void> {
    await this.client.query(
      `insert into maides_patron (layer, nom_table, def) values ($1, $2, $3)
       on conflict (layer, nom_table) do update set def = excluded.def`,
      [layer, patron.nom_table, JSON.stringify(patron)],
    );
  }

  async deletePatron(layer: string, nomTable: string): Promise<void> {
    await this.client.query('delete from maides_patron where layer = $1 and nom_table = $2', [layer, nomTable]);
  }

  async allDocs(layer: string): Promise<DocRow[]> {
    const { rows } = await this.client.query<DocRow>(
      'select type_doc, cle, data from maides_doc where layer = $1', [layer],
    );
    return rows;
  }

  async upsertDoc(layer: string, typeDoc: string, cle: string, data: Record<string, any>): Promise<void> {
    await this.client.query(
      `insert into maides_doc (layer, type_doc, cle, data, updated_at) values ($1, $2, $3, $4, now())
       on conflict (layer, type_doc, cle) do update set data = excluded.data, updated_at = now()`,
      [layer, typeDoc, cle, JSON.stringify(data)],
    );
  }

  async deleteDoc(layer: string, typeDoc: string, cle: string): Promise<void> {
    await this.client.query('delete from maides_doc where layer = $1 and type_doc = $2 and cle = $3', [layer, typeDoc, cle]);
  }
}

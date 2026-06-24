/**
 * Implémentation mémoire d'une couche R4 (pour tests, prototypage et exécution
 * sans base). L'implémentation PostgreSQL viendra en regard de cette interface.
 */

import { Patron } from '../metamodel/types.js';
import { keyFromRecord, cleToString } from '../metamodel/record.js';
import { LayerStore } from './layers.js';

export class MemoryLayerStore implements LayerStore {
  private patrons = new Map<string, Patron>();
  private tables = new Map<string, Map<string, Record<string, any>>>();

  /** Déclare un patron dans cette couche. */
  definePatron(patron: Patron): this {
    this.patrons.set(patron.nom_table, patron);
    if (!this.tables.has(patron.nom_table)) this.tables.set(patron.nom_table, new Map());
    return this;
  }

  loadPatron(nomTable: string): Patron | null {
    return this.patrons.get(nomTable) ?? null;
  }

  /** Liste les patrons de la couche. */
  listPatrons(): Patron[] {
    return [...this.patrons.values()];
  }

  /** Persiste une définition de patron (utilisé par les designers). */
  savePatron(patron: Patron): void {
    this.definePatron(patron);
  }

  /** Supprime une définition de patron. */
  deletePatron(nomTable: string): boolean {
    this.tables.delete(nomTable);
    return this.patrons.delete(nomTable);
  }

  /** Insère un enregistrement en calculant sa clé via le patron. */
  put(nomTable: string, record: Record<string, any>): this {
    return this.putWithKey(nomTable, this.cleDe(nomTable, record), record);
  }

  /** Insère un enregistrement avec une clé explicite. */
  putWithKey(nomTable: string, cle: string[], record: Record<string, any>): this {
    if (!this.tables.has(nomTable)) this.tables.set(nomTable, new Map());
    this.tables.get(nomTable)!.set(cleToString(cle), { ...record });
    return this;
  }

  search(nomTable: string, cle: string[]): Record<string, any> | null {
    const table = this.tables.get(nomTable);
    if (!table) return null;
    const rec = table.get(cleToString(cle));
    return rec ? { ...rec } : null;
  }

  listAll(nomTable: string): Record<string, any>[] {
    const table = this.tables.get(nomTable);
    return table ? [...table.values()].map((r) => ({ ...r })) : [];
  }

  save(nomTable: string, record: Record<string, any>): void {
    this.put(nomTable, record);
  }

  saveWithKey(nomTable: string, cle: string[], record: Record<string, any>): void {
    this.putWithKey(nomTable, cle, record);
  }

  delete(nomTable: string, cle: string[]): boolean {
    const table = this.tables.get(nomTable);
    if (!table) return false;
    return table.delete(cleToString(cle));
  }

  private cleDe(nomTable: string, record: Record<string, any>): string[] {
    const patron = this.patrons.get(nomTable);
    if (patron && patron.is_key.length > 0) return keyFromRecord(patron, record);
    // à défaut de patron, on tente _id puis la 1re propriété
    if (record['_id'] !== undefined) return [String(record['_id'])];
    const first = Object.keys(record)[0];
    return first ? [String(record[first])] : [''];
  }
}

/**
 * Couche R4 persistée sur PostgreSQL, en préservant le noyau synchrone.
 *
 * Stratégie « load-at-boot / write-through » :
 *  - `load()` (async) charge patrons + documents de la couche en mémoire ;
 *  - les lectures du runtime sont synchrones (sur le cache mémoire) ;
 *  - les écritures mettent à jour le cache ET sont propagées au dépôt PostgreSQL
 *    (à attendre via `flush()` lorsqu'on a besoin de garanties de durabilité).
 *
 * Convient aux volumétries de paramétrage et de travail courantes ; une variante
 * « lazy » pourra être ajoutée pour les très gros jeux de données.
 */

import { Patron } from '../../metamodel/types.js';
import { keyFromRecord, cleToString } from '../../metamodel/record.js';
import { LayerStore } from '../layers.js';
import { MemoryLayerStore } from '../memory-store.js';
import { DocumentRepository } from './repository.js';

export class PgLayerStore implements LayerStore {
  private mem = new MemoryLayerStore();
  private pending: Promise<unknown>[] = [];

  constructor(private repo: DocumentRepository, private layer: string) {}

  /** Charge la couche depuis PostgreSQL en mémoire. À appeler au démarrage. */
  async load(): Promise<void> {
    for (const patron of await this.repo.allPatrons(this.layer)) {
      this.mem.definePatron(patron);
    }
    for (const doc of await this.repo.allDocs(this.layer)) {
      this.mem.putWithKey(doc.type_doc, doc.cle.split('.'), doc.data);
    }
  }

  /** Attend la fin des écritures en cours (durabilité). */
  async flush(): Promise<void> {
    const enCours = this.pending;
    this.pending = [];
    await Promise.all(enCours);
  }

  private enqueue(p: Promise<unknown>): void {
    this.pending.push(p);
  }

  private cleDe(nomTable: string, record: Record<string, any>): string[] {
    const patron = this.mem.loadPatron(nomTable);
    if (patron && patron.is_key.length > 0) return keyFromRecord(patron, record);
    if (record['_id'] !== undefined) return [String(record['_id'])];
    const first = Object.keys(record)[0];
    return first ? [String(record[first])] : [''];
  }

  /* --- lectures synchrones (cache) --- */
  loadPatron(nomTable: string): Patron | null { return this.mem.loadPatron(nomTable); }
  listPatrons(): Patron[] { return this.mem.listPatrons(); }
  search(nomTable: string, cle: string[]): Record<string, any> | null { return this.mem.search(nomTable, cle); }
  listAll(nomTable: string): Record<string, any>[] { return this.mem.listAll(nomTable); }

  /* --- écritures (cache + propagation PostgreSQL) --- */
  save(nomTable: string, record: Record<string, any>): void {
    this.saveWithKey(nomTable, this.cleDe(nomTable, record), record);
  }

  saveWithKey(nomTable: string, cle: string[], record: Record<string, any>): void {
    this.mem.putWithKey(nomTable, cle, record);
    this.enqueue(this.repo.upsertDoc(this.layer, nomTable, cleToString(cle), record));
  }

  delete(nomTable: string, cle: string[]): boolean {
    const ok = this.mem.delete(nomTable, cle);
    this.enqueue(this.repo.deleteDoc(this.layer, nomTable, cleToString(cle)));
    return ok;
  }

  savePatron(patron: Patron): void {
    this.mem.savePatron(patron);
    this.enqueue(this.repo.upsertPatron(this.layer, patron));
  }

  deletePatron(nomTable: string): boolean {
    const ok = this.mem.deletePatron(nomTable);
    this.enqueue(this.repo.deletePatron(this.layer, nomTable));
    return ok;
  }
}

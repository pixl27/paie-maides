/**
 * Couche R4 persistée sur DISQUE (JSON, zéro dépendance) : étend MemoryLayerStore
 * en chargeant l'état au démarrage et en le réécrivant à chaque modification.
 *
 * Les données (patrons + enregistrements) survivent donc aux redémarrages —
 * indispensable pour un hébergement réel.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { MemoryLayerStore } from '@maides/core';

export class FileLayerStore extends MemoryLayerStore {
  private chargement = false;

  constructor(private fichier: string) {
    super();
    this.chargement = true;
    try { this.charge(); } finally { this.chargement = false; }
  }

  private charge(): void {
    if (!existsSync(this.fichier)) return;
    const data = JSON.parse(readFileSync(this.fichier, 'utf8')) as { patrons?: any[]; records?: Record<string, any[]> };
    for (const p of data.patrons ?? []) this.definePatron(p);
    for (const [table, recs] of Object.entries(data.records ?? {})) {
      for (const r of recs) this.put(table, r);
    }
  }

  /** Écrit tout l'état sur disque (écriture atomique via fichier temporaire). */
  private flush(): void {
    if (this.chargement) return;
    const records: Record<string, any[]> = {};
    for (const p of this.listPatrons()) records[p.nom_table] = this.listAll(p.nom_table);
    mkdirSync(dirname(this.fichier), { recursive: true });
    const tmp = `${this.fichier}.tmp`;
    writeFileSync(tmp, JSON.stringify({ patrons: this.listPatrons(), records }, null, 0));
    renameSync(tmp, this.fichier);
  }

  // --- mutations : on persiste après chaque écriture ---
  override definePatron(p: Parameters<MemoryLayerStore['definePatron']>[0]): this {
    const r = super.definePatron(p); this.flush(); return r;
  }
  override putWithKey(t: string, cle: string[], record: Record<string, any>): this {
    const r = super.putWithKey(t, cle, record); this.flush(); return r;
  }
  override delete(t: string, cle: string[]): boolean {
    const r = super.delete(t, cle); this.flush(); return r;
  }
  override deletePatron(nomTable: string): boolean {
    const r = super.deletePatron(nomTable); this.flush(); return r;
  }
}

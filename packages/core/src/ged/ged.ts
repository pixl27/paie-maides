/**
 * GED — Gestion Électronique de Documents (port du module ged/).
 *
 * Stocke des documents (fichiers) éventuellement rattachés à un enregistrement
 * métier (table + clé). L'acquisition par scanner est abstraite par une
 * interface `Scanner` injectable (remplace l'intégration webtwain du legacy).
 */

export interface Document {
  id: string;
  nom: string;
  mime: string;
  /** Contenu binaire du document. */
  contenu: Uint8Array;
  /** Rattachement métier optionnel. */
  table?: string;
  cle?: string;
  cree_le?: string;
  cree_par?: string;
}

/** Entrée d'acquisition (depuis un scanner, un upload…). */
export interface DocumentEntrant {
  nom: string;
  mime: string;
  contenu: Uint8Array;
  table?: string;
  cle?: string;
}

/** Stockage de documents. */
export interface GedStore {
  stocker(doc: DocumentEntrant, user?: string): string;
  recuperer(id: string): Document | null;
  /** Liste les documents rattachés à un enregistrement. */
  lister(table: string, cle: string): Document[];
  supprimer(id: string): boolean;
}

/** Acquisition de document (scanner, etc.) — pluggable. */
export interface Scanner {
  acquerir(options?: Record<string, any>): Promise<DocumentEntrant>;
}

let compteur = 0;

/** Implémentation mémoire de la GED. */
export class MemoryGed implements GedStore {
  private docs = new Map<string, Document>();

  stocker(entree: DocumentEntrant, user = ''): string {
    const id = `doc_${Date.now()}_${++compteur}`;
    this.docs.set(id, {
      id,
      nom: entree.nom,
      mime: entree.mime,
      contenu: entree.contenu,
      table: entree.table,
      cle: entree.cle,
      cree_le: new Date().toISOString(),
      cree_par: user,
    });
    return id;
  }

  recuperer(id: string): Document | null {
    const d = this.docs.get(id);
    return d ? { ...d } : null;
  }

  lister(table: string, cle: string): Document[] {
    return [...this.docs.values()].filter((d) => d.table === table && d.cle === cle);
  }

  supprimer(id: string): boolean {
    return this.docs.delete(id);
  }
}

/** Décode du base64 (ou un dataURL) en octets, indépendamment du runtime. */
export function base64VersOctets(donnee: string): { mime?: string; octets: Uint8Array } {
  let b64 = donnee;
  let mime: string | undefined;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(donnee);
  if (m) { mime = m[1]; b64 = m[2]!; }
  const buf = (globalThis as any).Buffer;
  if (buf) return { mime, octets: new Uint8Array(buf.from(b64, 'base64')) };
  // repli sans Node : atob
  const bin = (globalThis as any).atob ? (globalThis as any).atob(b64) : '';
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return { mime, octets };
}

/**
 * Scanner logiciel de référence : « acquiert » un document à partir d'un
 * contenu fourni (octets ou base64/dataURL), en remplacement de l'acquisition
 * matérielle WebTWAIN du legacy. Options : { nom, mime, contenu }.
 */
export class FichierScanner implements Scanner {
  acquerir(options: Record<string, any> = {}): Promise<DocumentEntrant> {
    const nom = String(options.nom ?? 'document');
    let contenu = options.contenu;
    let mime = options.mime as string | undefined;
    if (typeof contenu === 'string') {
      const r = base64VersOctets(contenu);
      contenu = r.octets;
      mime = mime ?? r.mime;
    }
    if (!(contenu instanceof Uint8Array)) {
      return Promise.reject(new Error('FichierScanner : contenu manquant (Uint8Array ou base64/dataURL attendu)'));
    }
    return Promise.resolve({ nom, mime: mime ?? 'application/octet-stream', contenu });
  }
}

/** Service GED de haut niveau : acquisition (scanner) + stockage rattaché. */
export class GedService {
  constructor(private store: GedStore, private scanner?: Scanner) {}

  attacher(entree: DocumentEntrant, user?: string): string {
    return this.store.stocker(entree, user);
  }

  async numeriser(table: string, cle: string, user?: string, options?: Record<string, any>): Promise<string> {
    if (!this.scanner) throw new Error('GED : aucun scanner configuré');
    const acquis = await this.scanner.acquerir(options);
    return this.store.stocker({ ...acquis, table, cle }, user);
  }

  documentsDe(table: string, cle: string): Document[] {
    return this.store.lister(table, cle);
  }
}

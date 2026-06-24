/**
 * Mailing de masse (port de gestionMassMailing.php / do_masseMailing).
 *
 * Pour chaque enregistrement d'une table, génère le corps d'un courrier (lettre
 * 'let' rendue en mode document) et l'envoie via un `Mailer` injectable.
 */

import { Runtime } from '../runtime/runtime.js';
import { R4 } from '../r4/r4.js';
import { keyFromRecord } from '../metamodel/record.js';
import { genererDocumentHtml } from './documents.js';

export interface Message {
  destinataire: string;
  sujet: string;
  corpsHtml: string;
}

/** Transport d'envoi (SMTP, API, file d'attente…). */
export interface Mailer {
  envoyer(message: Message): void | Promise<void>;
}

export interface MassMailingOptions {
  /** Champ contenant l'adresse e-mail du destinataire. */
  champEmail: string;
  /** Sujet (fixe) du courrier. */
  sujet: string;
  /** Filtre simple `champ=valeur` ou prédicat. */
  filtre?: string | ((record: Record<string, any>) => boolean);
}

export interface MassMailingResultat {
  total: number;
  envoyes: number;
  erreurs: { cle: string; message: string }[];
}

export class MassMailing {
  constructor(private runtime: Runtime, private r4: R4, private mailer: Mailer) {}

  /**
   * Envoie la lettre `nomLettre` (table liée `tableLiee`) à tous les
   * enregistrements de `tableLiee`.
   */
  async envoyer(nomLettre: string, tableLiee: string, options: MassMailingOptions): Promise<MassMailingResultat> {
    const store = this.r4.dataLayer();
    if (!store) throw new Error('MassMailing : couche data indisponible');
    let records: Record<string, any>[] = store.listAll(tableLiee);
    if (options.filtre) records = records.filter(predicat(options.filtre));
    return this.envoyerVers(records, nomLettre, tableLiee, options);
  }

  /**
   * Mailing piloté par un ensemble d'enregistrements fourni (port de
   * MML_massMailingRequete : à alimenter par un résultat de requête nommée).
   */
  async envoyerVers(
    records: Record<string, any>[],
    nomLettre: string,
    tableLiee: string,
    options: MassMailingOptions,
  ): Promise<MassMailingResultat> {
    const patron = this.r4.chargePatron(tableLiee);
    const res: MassMailingResultat = { total: records.length, envoyes: 0, erreurs: [] };
    for (const record of records) {
      const cle = patron ? keyFromRecord(patron, record) : [String(record['_id'] ?? '')];
      const cleStr = cle.join('.');
      try {
        const corpsHtml = genererDocumentHtml(this.runtime, nomLettre, cle);
        await this.mailer.envoyer({
          destinataire: String(record[options.champEmail] ?? ''),
          sujet: options.sujet,
          corpsHtml,
        });
        res.envoyes++;
      } catch (e: any) {
        res.erreurs.push({ cle: cleStr, message: e?.message ?? String(e) });
      }
    }
    return res;
  }
}

function predicat(filtre: string | ((r: Record<string, any>) => boolean)): (r: Record<string, any>) => boolean {
  if (typeof filtre === 'function') return filtre;
  const m = /^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(filtre);
  if (!m) return () => true;
  const [, champ, valeur] = m;
  const v = valeur!.replace(/^['"]|['"]$/g, '');
  return (r) => String(r[champ!]) === v;
}

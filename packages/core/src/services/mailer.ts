/**
 * Implémentations de référence du transport de courrier (Mailer injectable du
 * mailing de masse). Le legacy `gestionMassMailing` générait des PDF sur disque ;
 * ici on découple le transport (mémoire, fonction, ou SMTP réel côté hôte).
 */

import { Mailer, Message } from './mailing.js';

/** Mailer en mémoire : collecte les messages (tests, prévisualisation, dev). */
export class MemoryMailer implements Mailer {
  readonly messages: Message[] = [];
  envoyer(message: Message): void {
    this.messages.push(message);
  }
  /** Vide la boîte (utile entre deux campagnes). */
  vider(): void { this.messages.length = 0; }
}

/** Mailer délégant à une fonction (pont vers SMTP / API d'envoi de l'hôte). */
export class FonctionMailer implements Mailer {
  constructor(private fn: (message: Message) => void | Promise<void>) {}
  envoyer(message: Message): void | Promise<void> {
    return this.fn(message);
  }
}

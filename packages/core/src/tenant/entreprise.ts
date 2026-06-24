/**
 * Registre des entreprises / applications (multi-tenant).
 *
 * Port du concept de la base « entreprise » du legacy : chaque application
 * (code = APPLICATION) est rattachée à sa configuration d'accès aux données
 * (couches R4). Le registre résout un code d'application vers son `R4`.
 */

import { R4 } from '../r4/r4.js';

export interface Entreprise {
  /** Code de l'application / tenant (ex. 'assurance'). */
  code: string;
  libelle: string;
  /** Module/écran par défaut. */
  moduleDefaut?: string;
  actif?: boolean;
  [k: string]: any;
}

/** Registre des tenants : métadonnées + fabrique de R4 par tenant. */
export class TenantRegistry {
  private apps = new Map<string, { entreprise: Entreprise; r4Factory: () => R4 }>();
  private cache = new Map<string, R4>();

  /** Enregistre une application avec sa fabrique de R4. */
  enregistrer(entreprise: Entreprise, r4Factory: () => R4): this {
    this.apps.set(entreprise.code, { entreprise, r4Factory });
    return this;
  }

  /** Métadonnées d'une application. */
  info(code: string): Entreprise | null {
    return this.apps.get(code)?.entreprise ?? null;
  }

  /** Résout (et met en cache) le R4 d'une application. */
  resoudre(code: string): R4 | null {
    const entree = this.apps.get(code);
    if (!entree) return null;
    if (entree.entreprise.actif === false) return null;
    if (!this.cache.has(code)) this.cache.set(code, entree.r4Factory());
    return this.cache.get(code)!;
  }

  /** Liste des applications enregistrées et actives. */
  liste(): Entreprise[] {
    return [...this.apps.values()].map((e) => e.entreprise).filter((e) => e.actif !== false);
  }
}

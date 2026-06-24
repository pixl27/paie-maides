/**
 * Authentification et notion d'utilisateur (port modernisé et sécurisé de
 * gestionUser.php / azxLogin.php).
 *
 * Multi-tenant : un utilisateur est rattaché à une « entreprise » (application)
 * et à un niveau de couche R4 (dbLevel) ; le niveau de droit (niveau) pilote
 * l'accès aux écrans et entrées de menu.
 */

import { UserInfo } from '../expression/env.js';
import { hashPassword, verifyPassword } from './password.js';

/** Compte utilisateur stocké (mot de passe haché). */
export interface CompteUtilisateur {
  login: string;
  /** Mot de passe haché (scrypt$...). */
  password: string;
  super_admin?: 'O' | 'N' | boolean;
  /** Niveau de droit (0 = le plus privilégié). */
  niveau?: number;
  /** Niveau de couche R4 (1..4). */
  dbLevel?: number;
  nom?: string;
  prenom?: string;
  email?: string;
  actif?: boolean;
}

/** Source de comptes utilisateurs (in-memory, BDD…). */
export interface UserStore {
  findByLogin(login: string): CompteUtilisateur | null;
  save(compte: CompteUtilisateur): void;
  /** Liste tous les comptes (gestion des utilisateurs). Optionnel selon l'implémentation. */
  liste?(): CompteUtilisateur[];
  /** Supprime un compte. Optionnel. */
  supprime?(login: string): boolean;
}

/** Niveau de droit le moins privilégié (port de USR_LVL_MIN ; défaut sûr). */
export const NIVEAU_MOINS_PRIVILEGIE = 9;

/** Convertit un compte en `UserInfo` (contexte d'exécution). */
export function toUserInfo(c: CompteUtilisateur): UserInfo {
  return {
    login: c.login,
    superAdmin: c.super_admin === 'O' || c.super_admin === true,
    // Défaut SÛR : un utilisateur sans niveau défini est le MOINS privilégié (9),
    // pas le plus privilégié (0) — port de userGetNiveau() qui défaut à 9.
    niveau: c.niveau ?? NIVEAU_MOINS_PRIVILEGIE,
  };
}

/** Vérifie les identifiants ; renvoie le compte si OK et actif, sinon null. */
export function authentifier(store: UserStore, login: string, motDePasse: string): CompteUtilisateur | null {
  const compte = store.findByLogin(login);
  if (!compte) return null;
  if (compte.actif === false) return null;
  if (!verifyPassword(motDePasse, compte.password)) return null;
  return compte;
}

/** Store mémoire de comptes (hache les mots de passe fournis en clair). */
export class MemoryUserStore implements UserStore {
  private comptes = new Map<string, CompteUtilisateur>();

  findByLogin(login: string): CompteUtilisateur | null {
    return this.comptes.get(login) ?? null;
  }

  save(compte: CompteUtilisateur): void {
    this.comptes.set(compte.login, compte);
  }

  liste(): CompteUtilisateur[] {
    return [...this.comptes.values()].sort((a, b) => a.login.localeCompare(b.login));
  }

  supprime(login: string): boolean {
    return this.comptes.delete(login);
  }

  /** Crée un compte en hachant le mot de passe en clair. */
  creer(login: string, motDePasseClair: string, options: Partial<CompteUtilisateur> = {}): CompteUtilisateur {
    const compte: CompteUtilisateur = {
      login,
      password: hashPassword(motDePasseClair),
      super_admin: 'N',
      niveau: 0,
      dbLevel: 4,
      actif: true,
      ...options,
    };
    this.comptes.set(login, compte);
    return compte;
  }
}

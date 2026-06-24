/**
 * Hachage de mots de passe (scrypt, via le module crypto natif de Node).
 *
 * /!\ Le legacy stockait les mots de passe EN CLAIR (azxLogin.php) et les
 * comparait avec `==`. Ce module corrige ce défaut majeur de sécurité.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

/** Hache un mot de passe ; renvoie une chaine `scrypt$<saltHex>$<hashHex>`. */
export function hashPassword(motDePasse: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(motDePasse, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Vérifie un mot de passe contre un hash (comparaison à temps constant). */
export function verifyPassword(motDePasse: string, stored: string): boolean {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const attendu = Buffer.from(parts[2]!, 'hex');
  const calcule = scryptSync(motDePasse, salt, attendu.length);
  return attendu.length === calcule.length && timingSafeEqual(attendu, calcule);
}

/** Vrai si la chaine ressemble à un hash scrypt produit par ce module. */
export function estHache(valeur: string): boolean {
  return /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/.test(String(valeur));
}

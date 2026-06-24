/**
 * Manipulation des enregistrements (documents) à partir d'un patron :
 * initialisation, valeurs par défaut, clés, coercition de types, et pont vers
 * le dictionnaire de variables du moteur d'expressions.
 *
 * Port de init() / __determineValDef() / __tabloisationChamps() (accesMySQL.php).
 */

import { Champ, Patron, TypeChamp } from './types.js';
import type { ChampDef } from '../expression/env.js';

export type Record_ = Record<string, any>;

/** Valeur par défaut d'un champ selon son type (port de __determineValDef). */
export function valDefForChamp(champ: Champ): any {
  const valDef = champ.val_def ?? '';
  switch (champ.type_champ) {
    case 'array':
      return [valDef];
    case 'integer':
      if (champ.est_autoincrement === 1) return '';
      return valDef === '' || valDef === undefined ? 0 : Number(valDef);
    case 'decimal':
    case 'boolean':
      return valDef === '' || valDef === undefined ? '0' : valDef;
    case 'date':
      return valDef || '0000-00-00';
    case 'time':
      return valDef || '00:00:00';
    case 'datetime':
      return valDef || '0000-00-00 00:00:00';
    default:
      return valDef;
  }
}

/** Place la valeur par défaut dans data, en créant un tableau si nécessaire (port de __tabloisationChamps). */
function tabloisationChamps(data: Record_, champ: Champ, valDef: any): void {
  const taille = Number(champ.taille_tableau ?? 0);
  if (taille > 0 || champ.type_champ === 'array') {
    data[champ.nom_champ] = taille > 0 && taille < 100 ? new Array(taille).fill(valDef) : [];
  } else {
    data[champ.nom_champ] = valDef;
  }
}

/**
 * Initialise un enregistrement vide à partir d'un patron (port de init()).
 * @param cle clé optionnelle (valeurs à placer dans les champs-clé).
 * @param user login pour les champs created_by/updated_by.
 */
export function initRecord(patron: Patron, cle?: string[], user = ''): Record_ {
  const data: Record_ = {};
  data['_type_doc'] = patron.nom_table;

  for (const nomChamp of Object.keys(patron.champs)) {
    const champ = { ...patron.champs[nomChamp]! };
    if (!champ.type_champ) champ.type_champ = 'clop';
    tabloisationChamps(data, champ, valDefForChamp(champ));
  }

  // champs système / de base
  data['created_at'] = '0000-00-00 00:00:00';
  data['created_by'] = user;
  data['updated_at'] = '0000-00-00 00:00:00';
  data['updated_by'] = user;

  // valeurs de clé
  if (cle) {
    patron.is_key.forEach((nomChamp, i) => {
      if (cle[i] !== undefined) data[nomChamp] = cle[i];
    });
  }

  return data;
}

/** Extrait la clé (valeurs ordonnées) d'un enregistrement selon le patron. */
export function keyFromRecord(patron: Patron, record: Record_): string[] {
  return patron.is_key.map((nom) => String(record[nom] ?? ''));
}

/** Joint une clé en chaine (port de cleVersChaine : séparateur point). */
export function cleToString(cle: string[]): string {
  return cle.join('.');
}

/** Décompose une clé chaine en tableau (port de chaineVersCle). */
export function chaineVersCle(chaine: string): string[] {
  return String(chaine).split('.');
}

/** Coerce une valeur scalaire selon le type de champ (lecture/écriture). */
export function coerceValeur(type: TypeChamp, valeur: any): any {
  switch (type) {
    case 'integer':
      return valeur === '' || valeur == null ? 0 : parseInt(String(valeur), 10);
    case 'decimal':
      return valeur === '' || valeur == null ? 0 : parseFloat(String(valeur));
    case 'boolean':
      return valeur ? 1 : 0;
    default:
      return valeur;
  }
}

/**
 * Construit le dictionnaire de types (dico) attendu par le moteur d'expressions
 * à partir d'un patron : nom_champ -> { type_champ }.
 */
export function patronVersDico(patron: Patron): Record<string, ChampDef> {
  const dico: Record<string, ChampDef> = {};
  for (const [nom, champ] of Object.entries(patron.champs)) {
    dico[nom] = { ...champ }; // champ contient déjà type_champ
  }
  return dico;
}

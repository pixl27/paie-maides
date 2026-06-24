/**
 * Environnement d'exécution du langage d'expressions.
 *
 * Les fonctions « impures » du moteur PHP (accès base, écran, requête,
 * messages, navigation) reposaient sur des globales. Ici elles passent par
 * des fournisseurs injectables, ce qui rend le noyau testable et prêt à être
 * câblé sur PostgreSQL / le runtime générique plus tard.
 */

import { MdValue } from './value.js';

export interface UserInfo {
  login: string;
  superAdmin: boolean;
  niveau: number;
}

export interface ExpMessage {
  type: 'erreur' | 'attention' | 'succes' | 'admin' | 'debug';
  text: string;
  niveau?: number;
}

/** Accès aux couches de paramétrage R4 (formules, tables de paramètres). */
export interface ParamProvider {
  /** Charge le corps d'une formule nommée (R4 'frm', champ pf03). */
  loadFormula(name: string): string | null;
  /** Recherche stricte dans les tables de paramètres (R4 'tab', champ tab3). */
  table(name: string, key: string): string | number | null;
  /** Recherche avec repli sur la valeur inférieure la plus proche. */
  tableInf(name: string, key: string): string | number | null;
  /** Recherche avec repli sur la valeur supérieure la plus proche. */
  tableSup(name: string, key: string): string | number | null;
  /** Valeur d'un indice à une date ISO donnée (false si inconnu). */
  indice?(code: string, dateIso: string): number | false;
}

/** Accès aux données de production (agrégats, requêtes nommées, documents). */
export interface DataProvider {
  aggregate(op: string, table: string, champ: string, filtre: string, fusion: boolean): number;
  query(named: string, vars: Record<string, any>): Record<string, any>[];
  loadRecord(table: string, key: string, init: boolean): Record<string, any> | null;
  documentExists(patron: string, key: string): boolean;
}

/** Accès aux paramètres envoyés par le client (POST/GET, variables de transfert). */
export interface RequestProvider {
  get(name: string, def: any): any;
  transferVars(): Record<string, any> | null;
}

/** Navigation / redirections. */
export interface NavProvider {
  goUrl(url: string): void;
  goObe(o: string, b: string, e: string): void;
}

/**
 * Accès à l'écran courant (le `$zzz` / `containerForm` du moteur PHP).
 * Permet aux fonctions qui agissent sur l'écran (nouveauDoc, lectureSeule,
 * active/desactive, include, loadGo) de rester pures et injectables.
 */
export interface FormProvider {
  /** Vrai si l'enregistrement maître est nouveau (port de $zzz['nouveauDoc']). */
  nouveauDoc(): boolean;
  /** Force un widget en lecture seule (port de fFunc_lectureSeule). */
  lectureSeule(nomWidget: string): void;
  /** Réactive un widget précédemment désactivé. */
  active(nomWidget: string): void;
  /** Désactive un widget (hard = retire aussi de la soumission). */
  desactive(nomWidget: string, hard?: boolean): void;
  /** Désactive tout le formulaire (sauf les boutons si saufBouton). */
  desactiveForm(saufBouton?: boolean): void;
  /** Ajoute un fragment JavaScript à l'écran. */
  ajouteJScript(script: string): void;
  /** Inclut un sous-écran rendu et fusionne ses valeurs ; renvoie le HTML/PDF. */
  include(nomEcran: string): string;
  /** Chaîne l'impression d'un courrier suivant (port de fFunc_loadGo). */
  loadGo(nomPage: string): void;
}

export interface Providers {
  params?: ParamProvider;
  data?: DataProvider;
  request?: RequestProvider;
  nav?: NavProvider;
  form?: FormProvider;
}

/** Définition d'un champ dans le dictionnaire (type pour la coercition). */
export interface ChampDef {
  type_champ?: string;
  [k: string]: any;
}

/**
 * Contrat minimal exposé aux fonctions du langage (implémenté par MdExpression).
 */
export interface EvalEngine {
  variables: Record<string, any>;
  dico: Record<string, ChampDef>;
  interpreterVar: boolean;
  user?: UserInfo;
  providers: Providers;
  messages: ExpMessage[];
  isConsole: boolean;
  /** Défauts de devise (port de DEVISE_DECIMAL / DEVISE_SYMBOLE). */
  deviseDefaut?: { decimal: number; symbole: string };
  /** Évalue une (sous-)expression dans le même contexte de variables. */
  calcul(expression: string): MdValue;
}

/** Signature d'une fonction du langage maides. */
export type FnImpl = (engine: EvalEngine, args: MdValue[]) => MdValue | void;

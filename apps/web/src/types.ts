/** Types de l'état d'écran renvoyé par l'API JSON (serialiseZzz du serveur). */

export interface ChampMeta {
  type_widget?: string;
  type_champ?: string;
  libelle?: string;
  est_lecture_seule?: boolean;
  formule_calcul?: string;
  messerr?: string[];
  options?: { value: any; libelle: any }[];
  /** Lignes résolues (recordList, selectList, querabiliteList) renvoyées par le serveur. */
  lignes?: Record<string, any>[];
}

export interface Message {
  type: 'erreur' | 'attention' | 'succes' | 'admin' | 'debug';
  text: string;
}

export interface EtatEcran {
  ecran: string;
  o: number | string;
  cle: string[];
  ficMaitre: string;
  nouveauDoc: boolean;
  erreurBloquante: boolean;
  champs: Record<string, ChampMeta>;
  valeurs: Record<string, any>;
  messages: Message[];
  validation?: { erreurBloquante: boolean };
  supprime?: boolean;
}

export interface UtilisateurInfo {
  login: string;
  superAdmin: boolean;
  niveau: number;
}

export interface EntreeMenu {
  label: string;
  script: string;
}

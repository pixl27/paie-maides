/**
 * Runtime générique (port du moteur « bax »).
 *
 * Exécute un écran défini par données en CRUD : création de l'état `zzz`,
 * chargement du fichier maître, formulage, postage des saisies, validation,
 * sauvegarde. Les « ordres » historiques sont exposés en méthodes claires.
 *
 * Note de portage : l'ordre exact creeZzz/formulage/imputage/postage du legacy
 * (parfois contre-intuitif) est normalisé en un pipeline correct :
 *   charge données -> postage saisies -> formulage -> validation -> sauvegarde.
 */

import { R4 } from '../r4/r4.js';
import { r4Providers } from '../r4/expression-provider.js';
import { Providers, UserInfo, ExpMessage } from '../expression/env.js';
import { retVal } from '../expression/value.js';
import { initRecord, keyFromRecord, coerceValeur } from '../metamodel/record.js';
import { keyPaddee, cleVide, cmpElem } from '../data/keys.js';
import { evalCondition } from '../data/conditions.js';
import { Zzz } from './zzz.js';
import { Ecran, Widget } from './ecran.js';
import { formulage, moteurSurZzz, EvalContext } from './formulage.js';
import { validationSaisie, ResultatValidation } from './validation.js';
import { Specifique, SpecifiqueRegistry, SpecifiqueContexte } from './specifique.js';
import type { WidgetDataAcces } from '../rendering/widgets.js';

export interface RuntimeOptions {
  user?: UserInfo;
  isConsole?: boolean;
  /** Fournisseurs d'expression supplémentaires (sinon dérivés du R4). */
  providers?: Providers;
  /** Registre de code spécifique (logique métier sur-mesure par écran). */
  specifiques?: SpecifiqueRegistry;
}

export class Runtime {
  private r4: R4;
  private ctx: EvalContext;
  private user: UserInfo;
  private specifiques?: SpecifiqueRegistry;

  constructor(r4: R4, options: RuntimeOptions = {}) {
    this.r4 = r4;
    this.user = options.user ?? { login: '', superAdmin: false, niveau: 0 };
    this.specifiques = options.specifiques;
    this.ctx = {
      providers: options.providers ?? r4Providers(r4),
      user: this.user,
      isConsole: options.isConsole ?? false,
    };
  }

  /* ===================== code spécifique (extension) ===================== */

  /** Construit le contexte passé au code spécifique d'un écran. */
  private contexteSpec(zzz: Zzz): SpecifiqueContexte {
    return {
      zzz,
      user: this.user,
      valeurs: zzz.valeurs,
      evaluer: (expr) => retVal(moteurSurZzz(zzz, expr, this.ctx).calcul()),
      erreur: (message) => { zzz.erreurBloquante = true; zzz.messages.push({ type: 'erreur', text: message }); },
      message: (type: ExpMessage['type'], text) => { zzz.messages.push({ type, text }); },
    };
  }

  /** Appelle un point d'extension du code spécifique de l'écran, s'il existe. */
  private hook(zzz: Zzz, nom: 'demarre' | 'apresChargement' | 'avantSauvegarde' | 'apresSauvegarde'): void {
    const spec: Specifique | undefined = this.specifiques?.pour(zzz.e);
    const fn = spec?.[nom];
    if (fn) fn(this.contexteSpec(zzz));
  }

  /**
   * Exécute un ordre/opération personnalisé défini par le code spécifique
   * (équivalent des ordres o41–o90 du legacy).
   */
  executeOrdrePersonnalise(e: string, cle: string[], nomOrdre: string, input: Record<string, any> = {}): Zzz {
    const zzz = this.creeZzz(e, nomOrdre, cle);
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    this.postage(zzz, input);
    formulage(zzz, this.ctx);
    // Ordre par écran, sinon ordre GLOBAL '*' (port du chargement de o_<nom>.php
    // app-wide quand o est non-numérique dans bax.php).
    const fn = this.specifiques?.pour(e)?.ordres?.[nomOrdre] ?? this.specifiques?.pour('*')?.ordres?.[nomOrdre];
    if (!fn) throw new Error(`Ordre personnalisé '${nomOrdre}' introuvable (écran ${e}).`);
    fn(this.contexteSpec(zzz));
    return zzz;
  }

  /* ===================== construction de l'état ===================== */

  /** Crée l'état zzz à partir d'un écran (port de creeZzz). */
  creeZzz(e: string, o: number | string, cle: string[], patEcran: 'scr' | 'let' = 'scr'): Zzz {
    const ecranRec = this.r4.chargeEcran(e, patEcran);
    if (!ecranRec) {
      throw new Error(`L'écran ${e} est introuvable. Veuillez le créer au préalable.`);
    }
    const ecran = ecranRec as Ecran;

    // contrôle de droit d'écran
    if (!this.user.superAdmin && patEcran === 'scr' && ecran.niveauDroits != null && this.user.niveau > ecran.niveauDroits) {
      throw new Error('Accès non autorisé');
    }

    // Copie par widget : la définition d'écran est partagée entre requêtes
    // (cache R4), donc on isole chaque widget pour ne jamais muter l'original
    // (ex. messerr posé par validationSaisie ne doit pas fuiter entre requêtes/users).
    const champs: Record<string, Widget> = {};
    const valeurs: Record<string, any> = {};
    for (const [nom, widget] of Object.entries(ecran.champs ?? {})) {
      champs[nom] = { ...widget };
      valeurs[nom] = widget.val_def ?? '';
    }

    const ficMaitre = ecran.table_liee ?? '';
    const patronMaitre = ficMaitre ? this.r4.chargePatron(ficMaitre) ?? undefined : undefined;

    const zzz: Zzz = {
      e, o, patEcran, cle, ficMaitre, patronMaitre, ecran,
      champs, valeurs, champsExtra: {}, valeursExtra: {},
      nouveauDoc: true, erreurBloquante: false, messages: [],
    };
    this.injecteVariablesMagiques(zzz);
    this.appliqueVarTransfert(zzz);
    this.hook(zzz, 'demarre'); // code spécifique : initialisation de l'écran
    return zzz;
  }

  /**
   * Injecte les variables magiques (port de ajouteVariablesMagiques) : identité
   * utilisateur, contexte OBE et écran. Exploitables par les formules.
   */
  private injecteVariablesMagiques(zzz: Zzz): void {
    const v = zzz.valeurs;
    v['__userLogin'] = this.user.login;
    v['UTI'] = this.user.login;
    v['__userNom'] = this.user.login;
    v['__userLevel'] = this.user.niveau;
    v['__ecran'] = zzz.e;
    v['__patron'] = zzz.ficMaitre;
    v['__o'] = zzz.o;
    v['__b'] = zzz.cle.join('.');
    v['__e'] = zzz.e;
    v['__nouveau'] = zzz.nouveauDoc ? 1 : 0;
  }

  /**
   * Applique les variables de transfert de l'écran (port de var_transfert :
   * lignes `$gauche := $droite`), résultats placés dans valeursExtra.
   */
  private appliqueVarTransfert(zzz: Zzz): void {
    const vt = zzz.ecran?.var_transfert;
    if (typeof vt !== 'string' || vt.trim() === '') return;
    for (const ligne of vt.split(/\r?\n/)) {
      const l = ligne.trim();
      if (l === '' || !l.includes(':=')) continue;
      try {
        const moteur = moteurSurZzz(zzz, l, this.ctx);
        moteur.calcul();
        Object.assign(zzz.valeursExtra, moteur.affectations);
      } catch { /* transfert silencieux en cas d'erreur */ }
    }
  }

  /** Charge le fichier maître et impute ses valeurs (port de lireFicMaitreEtc + imputageZzz). */
  chargeFicMaitre(zzz: Zzz): void {
    if (!zzz.ficMaitre) { zzz.nouveauDoc = true; return; }
    const res = this.r4.search(zzz.ficMaitre, zzz.cle);
    if (res) {
      zzz.nouveauDoc = false;
      for (const [k, v] of Object.entries(res.record)) zzz.valeurs[k] = v;
    } else {
      zzz.nouveauDoc = true;
      if (zzz.patronMaitre) {
        const vide = initRecord(zzz.patronMaitre, zzz.cle, this.user.login);
        for (const [k, v] of Object.entries(vide)) {
          if (zzz.valeurs[k] === undefined || zzz.valeurs[k] === '') zzz.valeurs[k] = v;
        }
      }
    }
    zzz.valeurs['__nouveau'] = zzz.nouveauDoc ? 1 : 0; // maj de la variable magique
    this.appliqueDroits(zzz);
  }

  /**
   * Applique les droits par champ (port de appliqueDroits + genereSortieWidgets) :
   * charge la table 'drt' pour le niveau de l'utilisateur et résout C/N/L/P.
   * - 'C' / '' : complet ; 'N' : modifiable seulement à la création (sinon lecture) ;
   * - 'L' : lecture seule ; 'P' : masqué (non affiché).
   * Résultat dans zzz.droits, SANS muter les définitions de widgets (partagées).
   */
  appliqueDroits(zzz: Zzz): void {
    zzz.droits = {};
    if (this.user.superAdmin) return; // super-admin : tout en 'C'
    const niveau = this.user.niveau;
    const regles = new Map<string, string>();
    if (zzz.ficMaitre) {
      for (const r of this.r4.recordsDe('drt')) {
        if (String(r['drt_table']) !== zzz.ficMaitre) continue;
        const v = r[`drt_grp_${niveau}`];
        if (v !== undefined && v !== '') regles.set(String(r['drt_champ']), String(v));
      }
    }
    for (const nom of Object.keys(zzz.champs)) {
      const droit = regles.get(nom) ?? 'C';
      let ro = false; let masque = false;
      switch (droit) {
        case 'N': ro = !zzz.nouveauDoc; break;
        case 'L': ro = true; break;
        case 'P': masque = true; ro = true; break;
        default: break;
      }
      if (ro || masque) zzz.droits[nom] = { ro, masque, droit };
    }
  }

  /**
   * Charge les enregistrements liés (port de DB_chargeRelationLieEtLieAuParents).
   * Les enfants (un-à-plusieurs) sont exposés sous forme de tableau, le parent
   * (plusieurs-à-un) sous forme d'enregistrement, dans `zzz.valeurs[rel.nom]`.
   */
  chargeRelations(zzz: Zzz): void {
    const relations = zzz.patronMaitre?.relations;
    if (!relations) return;
    const data = this.r4.dataLayer();
    for (const rel of relations) {
      if (rel.type === 'enfants') {
        const tous = data ? data.listAll(rel.table) : [];
        zzz.valeurs[rel.nom] = tous.filter((r) =>
          rel.cle_distante.every((f, i) => String(r[f]) === String(zzz.valeurs[rel.cle_locale[i]!])),
        );
      } else {
        const cle = rel.cle_locale.map((f) => String(zzz.valeurs[f] ?? ''));
        zzz.valeurs[rel.nom] = this.r4.search(rel.table, cle)?.record ?? null;
      }
    }
  }

  /** Liste les enregistrements d'une table (port simplifié des vues). */
  liste(table: string, options: { filtre?: string | ((r: Record<string, any>) => boolean) } = {}): Record<string, any>[] {
    const data = this.r4.dataLayer();
    let rows = data ? data.listAll(table) : [];
    if (options.filtre) {
      const f = options.filtre;
      if (typeof f === 'function') rows = rows.filter(f);
      else {
        const m = /^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(f);
        if (m) {
          const v = m[2]!.replace(/^['"]|['"]$/g, '');
          rows = rows.filter((r) => String(r[m![1]!]) === v);
        }
      }
    }
    return rows;
  }

  /** Intègre les saisies client dans les valeurs (port de postageZzz). */
  postage(zzz: Zzz, input: Record<string, any> = {}): void {
    const intouchables = new Set(['zonePDF', 'zoneImg', 'zoneDoc', 'zonePng', 'zoneJpg', 'scanInit']);
    const refuse = (nom: string): boolean => {
      const w = zzz.champs[nom];
      if (w?.est_lecture_seule === 1) return true;
      const d = zzz.droits?.[nom];
      if (d && (d.ro || d.masque)) return true;
      if (w && intouchables.has(String(w.type_widget))) return true;
      return false;
    };

    // 1) champs tableau : reconstruit champ[i] -> champ = [...] (et conserve les indices à plat)
    const tableaux: Record<string, any[]> = {};
    for (const [k, v] of Object.entries(input)) {
      const m = /^(\w+)\[(\d+)\]$/.exec(k);
      if (!m) continue;
      const [, base, idx] = m;
      if (refuse(base!)) continue;
      (tableaux[base!] ??= [])[Number(idx)] = v;
      zzz.valeurs[k] = v;
    }
    for (const [base, arr] of Object.entries(tableaux)) zzz.valeurs[base] = arr;

    // 0) variables de transfert (_vt_<nom>) ré-injectées dans valeursExtra (port de metTransfertVariableDansZzz)
    for (const [k, v] of Object.entries(input)) {
      const m = /^_vt_(.+)$/.exec(k);
      if (m) zzz.valeursExtra[m[1]!] = v;
    }

    const estCase = (w?: { type_widget?: string }): boolean =>
      String(w?.type_widget) === 'boolean' || String(w?.type_widget) === 'checkbox';

    // 2) champs scalaires (hors checkbox, traités en 3)
    for (const [k, v] of Object.entries(input)) {
      if (/^\w+\[\d+\]$/.test(k)) continue; // déjà traité (tableau)
      if (refuse(k) || estCase(zzz.champs[k])) continue;
      zzz.valeurs[k] = v;
    }

    // 3) checkbox/boolean : présente => 1, absente => 0 (port de postageZzz)
    if (Object.keys(input).length > 0) {
      for (const [nom, w] of Object.entries(zzz.champs)) {
        if (!estCase(w) || refuse(nom)) continue;
        zzz.valeurs[nom] = (nom in input) ? 1 : 0;
      }
    }
  }

  /** Sauvegarde le document maître (port de sauveDocMaitre). */
  sauveDocMaitre(zzz: Zzz): void {
    if (!zzz.ficMaitre || !zzz.patronMaitre) {
      throw new Error('Sauvegarde impossible : aucun fichier maître.');
    }
    const record = zzz.nouveauDoc
      ? initRecord(zzz.patronMaitre, zzz.cle, this.user.login)
      : (this.r4.search(zzz.ficMaitre, zzz.cle)?.record ?? initRecord(zzz.patronMaitre, zzz.cle, this.user.login));

    // champ-clé auto-incrémenté sur un nouveau document : générer la prochaine valeur
    const dernierCle = zzz.patronMaitre.is_key[zzz.patronMaitre.is_key.length - 1];
    const autoNew = zzz.nouveauDoc && dernierCle != null
      && zzz.patronMaitre.champs[dernierCle]?.est_autoincrement === 1;

    // report des valeurs des champs du patron, AVEC coercition à l'écriture (port de sauveDocMaitre)
    for (const [nom, champ] of Object.entries(zzz.patronMaitre.champs)) {
      if (autoNew && nom === dernierCle) continue; // clé auto-incrémentée : générée plus bas
      if (zzz.valeurs[nom] === undefined) continue;
      record[nom] = coerceEcriture(champ.type_champ, zzz.valeurs[nom]);
    }
    // s'assurer que la clé est cohérente (sauf clé auto-incrémentée d'un nouveau doc)
    zzz.patronMaitre.is_key.forEach((nom, i) => {
      if (autoNew && nom === dernierCle) return;
      if (zzz.cle[i] !== undefined) record[nom] = zzz.cle[i];
    });
    if (autoNew && dernierCle) {
      const cleGen = this.r4.prochaineCle(zzz.ficMaitre);
      record[dernierCle] = cleGen[cleGen.length - 1];
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (zzz.nouveauDoc) { record['created_at'] = now; record['created_by'] = this.user.login; }
    record['updated_at'] = now;
    record['updated_by'] = this.user.login;

    // champs système (port de DB_genereChampsSystem)
    const cleFinale = keyFromRecord(zzz.patronMaitre, record);
    record['_type_doc'] = zzz.ficMaitre;
    record['_id'] = `${zzz.ficMaitre}.${cleFinale.join('.')}`;
    record['_key'] = keyPaddee(cleFinale);
    record['__tag__'] = 0;

    this.r4.save(zzz.ficMaitre, record);
    zzz.nouveauDoc = false;
    zzz.cle = keyFromRecord(zzz.patronMaitre, record);
  }

  /* ===================== ordres ===================== */

  /** o1 — Visualisation. */
  visu(e: string, cle: string[], patEcran: 'scr' | 'let' = 'scr'): Zzz {
    const zzz = this.creeZzz(e, 1, cle, patEcran);
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    formulage(zzz, this.ctx);
    this.hook(zzz, 'apresChargement');
    return zzz;
  }

  /** o8 — Édition. */
  edition(e: string, cle: string[]): Zzz {
    const zzz = this.creeZzz(e, 8, cle);
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    formulage(zzz, this.ctx);
    this.hook(zzz, 'apresChargement');
    return zzz;
  }

  /** o9 — Sauvegarde (charge, poste les saisies, formule, valide, sauve si OK). */
  sauvegarde(
    e: string,
    cle: string[],
    input: Record<string, any> = {},
    options: { hashAttendu?: string } = {},
  ): { zzz: Zzz; validation: ResultatValidation } {
    const zzz = this.creeZzz(e, 9, cle);
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    this.postage(zzz, input);
    formulage(zzz, this.ctx);
    this.hook(zzz, 'avantSauvegarde'); // code spécifique : ajustement/contrôle avant sauvegarde
    const blocageSpecifique = zzz.erreurBloquante; // mémorisé car validationSaisie réinitialise le drapeau
    const validation = validationSaisie(zzz, this.ctx);
    if (blocageSpecifique) { zzz.erreurBloquante = true; validation.erreurBloquante = true; }
    // Verrouillage optimiste (port de verifHashageFicMaitreOK) : si le client a
    // chargé une version puis qu'un autre l'a modifiée entre-temps, on refuse.
    if (options.hashAttendu !== undefined && !zzz.nouveauDoc) {
      const actuel = this.hashDe(e, cle);
      if (actuel !== '' && actuel !== options.hashAttendu) {
        zzz.erreurBloquante = true;
        validation.erreurBloquante = true;
        zzz.messages.push({ type: 'erreur', text: 'Document modifié par un autre utilisateur depuis sa lecture. Rechargez avant d\'enregistrer.' });
      }
    }
    if (!zzz.erreurBloquante) {
      this.sauveDocMaitre(zzz);
      this.hook(zzz, 'apresSauvegarde');
    }
    return { zzz, validation };
  }

  /** Empreinte d'optimistic locking d'un document (port de calculHash : updated_at). */
  hashDe(e: string, cle: string[]): string {
    const table = this.tableDeEcran(e);
    if (!table) return '';
    const rec = this.r4.search(table, cle)?.record;
    return rec ? String(rec['updated_at'] ?? '') : '';
  }

  /** o18 — Sauvegarde sans validation. */
  sauvegardeForcee(e: string, cle: string[], input: Record<string, any> = {}): Zzz {
    const zzz = this.creeZzz(e, 18, cle);
    this.chargeFicMaitre(zzz);
    this.postage(zzz, input);
    formulage(zzz, this.ctx);
    zzz.erreurBloquante = false;
    this.sauveDocMaitre(zzz);
    return zzz;
  }

  /** o4 — Suppression puis rechargement (port de supprimerDocument). */
  supprime(e: string, cle: string[]): Zzz {
    const table = this.tableDeEcran(e);
    // Réservé aux super-administrateurs.
    if (!this.user.superAdmin) {
      const zzz = this.visu(e, cle);
      zzz.erreurBloquante = true;
      zzz.messages.push({ type: 'erreur', text: 'Suppression réservée aux super-administrateurs.' });
      return zzz;
    }
    // Refus si des données liées existent.
    if (this.documentALies(table, cle)) {
      const zzz = this.visu(e, cle);
      zzz.erreurBloquante = true;
      zzz.messages.push({ type: 'erreur', text: 'Suppression impossible : des données liées existent.' });
      return zzz;
    }
    if (this.r4.dataLayer()) this.r4.dataLayer()!.delete(table, cle);
    return this.visu(e, cle);
  }

  /** Vrai si des enregistrements enfants référencent ce document (port de DB_documentALies). */
  private documentALies(table: string, cle: string[]): boolean {
    const patron = this.r4.chargePatron(table);
    const rels = (patron?.relations ?? []).filter((r) => r.type === 'enfants');
    if (rels.length === 0) return false;
    const maitre = this.r4.search(table, cle)?.record;
    if (!maitre) return false;
    for (const rel of rels) {
      const enfants = this.r4.recordsDe(rel.table);
      const lie = enfants.some((r) =>
        rel.cle_distante.every((f, i) => String(r[f]) === String(maitre[rel.cle_locale[i]!] ?? '')));
      if (lie) return true;
    }
    return false;
  }

  /** Clé suivante dans la table via l'algorithme down (port de down). */
  cleSuivante(table: string, cle: string[]): string[] | null {
    const patron = this.r4.chargePatron(table);
    if (!patron) return null;
    const rec = this.r4.down(table, cleVide(cle) ? [] : cle);
    return rec ? keyFromRecord(patron, rec) : null;
  }

  /** Clé précédente dans la table via l'algorithme up (port de up). */
  clePrecedente(table: string, cle: string[]): string[] | null {
    const patron = this.r4.chargePatron(table);
    if (!patron) return null;
    const rec = this.r4.up(table, cleVide(cle) ? [] : cle);
    return rec ? keyFromRecord(patron, rec) : null;
  }

  /** o2 — Document suivant (puis visu). */
  documentSuivant(e: string, cle: string[]): Zzz {
    const nc = this.cleSuivante(this.tableDeEcran(e), cle) ?? cle;
    return this.visu(e, nc);
  }

  /** o3 — Document précédent (puis visu). */
  documentPrecedent(e: string, cle: string[]): Zzz {
    const nc = this.clePrecedente(this.tableDeEcran(e), cle) ?? cle;
    return this.visu(e, nc);
  }

  /** Séquence d'écrans nommée (table sq_ecran, port de la table de séquences). */
  private sequenceEcrans(nom: string): string[] {
    return (this.r4.search('sq_ecran', [nom])?.record?.['sq_ecrans'] as string[]) ?? [];
  }

  /** o6/o7 — Écran suivant/précédent dans une séquence (tableau OU nom de séquence sq_ecran). */
  ecranSuivant(sequence: string[] | string, courant: string): string | null {
    const seq = Array.isArray(sequence) ? sequence : this.sequenceEcrans(sequence);
    const i = seq.indexOf(courant);
    return i >= 0 && i < seq.length - 1 ? seq[i + 1]! : null;
  }

  ecranPrecedent(sequence: string[] | string, courant: string): string | null {
    const seq = Array.isArray(sequence) ? sequence : this.sequenceEcrans(sequence);
    const i = seq.indexOf(courant);
    return i > 0 ? seq[i - 1]! : null;
  }

  /** o12 — Visualisation si le document existe, édition sinon. */
  visuOuEdition(e: string, cle: string[]): Zzz {
    const table = this.tableDeEcran(e);
    if (table && this.r4.search(table, cle)) return this.visu(e, cle);
    return this.edition(e, cle);
  }

  /** o5 — Duplication d'un document vers une nouvelle clé. */
  duplique(e: string, cleSource: string[], cleCible: string[], input: Record<string, any> = {}): { zzz: Zzz; validation: ResultatValidation } {
    const src = this.visu(e, cleSource);
    if (src.nouveauDoc) throw new Error('Duplication : document source introuvable.');
    const valeurs = { ...src.valeurs, ...input };
    return this.sauvegarde(e, cleCible, valeurs);
  }

  /**
   * o10 — Postage + formulage + validation SANS sauvegarde (recalcul à la volée,
   * écran sans table ou rafraîchissement AJAX). Port de executeO10.
   */
  postageSeul(e: string, cle: string[], input: Record<string, any> = {}): { zzz: Zzz; validation: ResultatValidation } {
    const zzz = this.creeZzz(e, 10, cle);
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    this.postage(zzz, input);
    formulage(zzz, this.ctx);
    const validation = validationSaisie(zzz, this.ctx);
    return { zzz, validation };
  }

  /** o11 — Sauvegarde puis ré-édition (port de executeO11). */
  sauvegardePuisEdition(e: string, cle: string[], input: Record<string, any> = {}): { zzz: Zzz; validation: ResultatValidation } {
    const r = this.sauvegarde(e, cle, input);
    if (!r.zzz.erreurBloquante) return { zzz: this.edition(e, r.zzz.cle), validation: r.validation };
    return r;
  }

  /** o13 — Aperçu d'un courrier (écran 'let', mode document). Port de executeO13. */
  apercuCourrier(e: string, cle: string[]): Zzz {
    const zzz = this.creeZzz(e, 13, cle, 'let');
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    formulage(zzz, this.ctx);
    this.hook(zzz, 'apresChargement');
    return zzz;
  }

  /** o14 — Document prêt pour impression PDF (écran 'let', o=14). Port de executeO14. */
  documentPourImpression(e: string, cle: string[]): Zzz {
    const zzz = this.creeZzz(e, 14, cle, 'let');
    this.chargeFicMaitre(zzz);
    this.chargeRelations(zzz);
    formulage(zzz, this.ctx);
    return zzz;
  }

  /**
   * o20 / o21 — Crée un document de paramétrage (lettre 'let' ou écran 'scr')
   * pour une nouvelle clé, puis renvoie l'état d'édition. Port de creerDocEcran.
   */
  creeDocumentParametrage(patEcran: 'scr' | 'let', e: string, cle: string[]): Zzz {
    const zzz = this.creeZzz(e, patEcran === 'let' ? 20 : 21, cle, patEcran);
    this.chargeFicMaitre(zzz);
    formulage(zzz, this.ctx);
    return zzz;
  }

  /**
   * Sérialise l'état d'écran en JSON pour AJAX (port de genereSortieJson) :
   * { obe, tuple: { champ: { v, ro, ne } } } où ne = true (pas d'erreur) ou
   * la liste des messages d'erreur du champ.
   */
  serialiseJson(zzz: Zzz): { obe: Record<string, any>; tuple: Record<string, { v: any; ro: boolean; ne: true | string[] }> } {
    const exclus = new Set(['zonePDF', 'zoneImg', 'zoneDoc']);
    const tuple: Record<string, { v: any; ro: boolean; ne: true | string[] }> = {};
    for (const [nom, w] of Object.entries(zzz.champs)) {
      if (exclus.has(String(w.type_widget))) continue;
      const d = zzz.droits?.[nom];
      if (d?.masque) continue; // droit 'P' : champ non exposé
      const erreurs = (w.messerr ?? []) as string[];
      tuple[nom] = { v: zzz.valeurs[nom], ro: w.est_lecture_seule === 1 || !!d?.ro, ne: erreurs.length ? erreurs : true };
    }
    // obe (port de genereSortieJson) : b (clé = tableau), e, m, n, p — PAS o.
    return { obe: { b: zzz.cle, e: zzz.e, m: zzz.m ?? '', n: zzz.n ?? '', p: zzz.p ?? '' }, tuple };
  }

  /* ===================== web services (port de bax_webs) ===================== */

  /** Calcule une expression dans le contexte d'un écran/clé (bax_webs a=5). */
  calculSurEcran(e: string, cle: string[], expression: string): any {
    const zzz = this.visu(e, cle);
    return retVal(moteurSurZzz(zzz, expression, this.ctx).calcul());
  }

  /** Recherche des clés d'une table par préfixe (bax_webs a=1/3). */
  chercheCles(table: string, prefixe: string[] = [], nbMax = 50): string[] {
    const patron = this.r4.chargePatron(table);
    if (!patron) return [];
    const rows = prefixe.length ? this.r4.findLight(table, prefixe, nbMax) : this.r4.recordsDe(table).slice(0, nbMax);
    return rows.map((r) => keyFromRecord(patron, r).join('.'));
  }

  /** Recherche plein-texte simple sur une table/vue (bax_webs a=2 bigSearch / a=4 recherche complète). */
  rechercheComplete(table: string, terme: string, nbMax = 50): Record<string, any>[] {
    const t = String(terme).toLowerCase();
    if (t === '') return [];
    return this.r4.recordsDe(table)
      .filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(t)))
      .slice(0, nbMax);
  }

  /** Valeur d'une table de paramètres (bax_webs a=12 getValueFromTable / a=20 getTableParam). */
  valeurParametre(table: string, cle: string): string | number | null {
    return this.r4.table(table, cle);
  }

  /* ===================== accès données pour les widgets ===================== */

  /**
   * Fournit l'accès données attendu par les widgets liés (selectTable, recordList,
   * sous-écrans…) à partir du R4. À passer à renderEcran via RenderOptions.acces.
   */
  accesDonnees(): WidgetDataAcces {
    return {
      lireTable: (nomTable) => this.r4.recordsDe('tab')
        .filter((r) => String(r['tab1']) === nomTable)
        .map((r) => ({ cle: String(r['tab2']), libelle: String(r['tab3'] ?? '') })),
      lireFic: (spec) => {
        let rows = this.r4.recordsDe(spec.table);
        if (spec.filtre) rows = rows.filter((r) => String(r[spec.cle] ?? '') !== '');
        return rows.map((r) => ({ value: String(r[spec.cle] ?? ''), libelle: spec.libelle ? String(r[spec.libelle] ?? '') : String(r[spec.cle] ?? '') }));
      },
      lignes: (spec) => {
        // table peut être une vue : on tente l'exécution de vue, sinon table brute
        const parVue = this.r4.chargeVue(spec.table) ? this.r4.executeVueParNom(spec.table) : null;
        const rows = parVue ?? this.r4.recordsDe(spec.table);
        const filtres = spec.filtre ? rows.filter((r) => evalCondition(spec.filtre!, r)) : rows.slice();
        // tri (option `tri=champ` ou `champ desc`, plusieurs séparés par des virgules)
        if (spec.tri) {
          const clauses = spec.tri.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
            const desc = /\s+desc$/i.test(s);
            return { champ: s.replace(/\s+(asc|desc)$/i, '').trim(), sens: desc ? -1 : 1 };
          });
          filtres.sort((a, b) => {
            for (const c of clauses) { const d = cmpElem(a[c.champ], b[c.champ]); if (d !== 0) return d * c.sens; }
            return 0;
          });
        }
        // expose __cle__ (clé cliquable) : dérivée de _id (= "<table>.<clé>") si absente
        return filtres.map((r) => {
          if (r.__cle__ != null) return r;
          const id = String(r._id ?? ''); const i = id.indexOf('.');
          return { ...r, __cle__: i >= 0 ? id.slice(i + 1) : id };
        });
      },
      aggregate: (op, table, champ, filtre) => this.r4.aggregate(op, table, champ, filtre),
      champsDe: (table) => Object.keys(this.r4.chargePatron(table)?.champs ?? {}),
      rendSousEcran: (nomEcran, valeurs) => {
        try {
          const zzz = this.creeZzz(nomEcran, 1, []);
          Object.assign(zzz.valeurs, valeurs);
          formulage(zzz, this.ctx);
          // rendu minimal : substitution du gabarit par les valeurs (sans dépendance circulaire)
          return zzz.ecran?.template ?? '';
        } catch { return ''; }
      },
      urlDocument: (table, cle, champ) => `/doc?t=${encodeURIComponent(table)}&b=${encodeURIComponent(cle)}&c=${encodeURIComponent(champ)}`,
    };
  }

  private tableDeEcran(e: string): string {
    const ecran = this.r4.chargeEcran(e, 'scr') as Ecran | null;
    return ecran?.table_liee ?? '';
  }
}

/** Coercition d'une valeur selon le type de champ, à l'écriture (port de sauveDocMaitre). */
function coerceEcriture(type: string | undefined, valeur: any): any {
  if (type === 'date') {
    const s = String(valeur ?? '');
    if (s === '') return '0000-00-00';
    const lit = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
    if (lit) return `${lit[3]}-${lit[2]}-${lit[1]}`; // JJ-MM-AAAA -> AAAA-MM-JJ
    const my = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (my) return `${my[1]}-${my[2]}-${my[3]}`; // AAAA-MM-JJ (heure éventuelle retirée)
    return s;
  }
  if (type === 'integer' || type === 'decimal') {
    if (typeof valeur === 'string') {
      const nettoye = valeur.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      return coerceValeur(type, nettoye);
    }
    return coerceValeur(type, valeur);
  }
  if (type === 'boolean') return coerceValeur(type, valeur);
  return valeur;
}

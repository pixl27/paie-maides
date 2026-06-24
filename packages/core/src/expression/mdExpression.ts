/**
 * Moteur d'expressions « maides » — port fidèle de lib/mdExpression.php.
 *
 * Pipeline : `calcul(expr)` -> découpage `;` -> `creerPile()` (tokeniseur +
 * shunting-yard -> RPN) -> `calculPile()` (évaluation RPN).
 *
 * Formes spéciales : SI(cond ? vrai : faux), sous-formules [nom], blocs (...),
 * variables $x / $x[i], affectations $x := ...
 */

import {
  MdValue, nbr, str, dte, voidVal, isVoid, isNumericString, retVal, truthy,
} from './value.js';
import { matchMysqlDate, mysqlToLiteral, jourConstant } from './dates.js';
import {
  op_plus, op_moins, op_mult, op_div, op_pow, op_et, op_ou, op_not, op_neg,
  op_eqt, op_dif, op_lt, op_let, op_gt, op_get, op_startBy, op_has, op_endBy,
} from './operators.js';
import { getFunction } from './functions.js';
import { ExpCriticalException } from './errors.js';
import {
  EvalEngine, Providers, UserInfo, ExpMessage, ChampDef,
} from './env.js';

/* ---------------------- précédences ---------------------- */

const PRIORITE: Record<string, number> = {
  '^': 5, '*': 5, '/': 5, '+': 4, '-': 4,
  '<': 3, '>': 3, '<=': 3, '>=': 3,
  '=': 2, '<>': 2, '~=': 2, '=~': 2, '~~': 2,
  ET: 1, OU: 0,
  NON: 6, 'u-': 6, // unaires
};
const UNAIRES = new Set(['NON', 'u-']);
const BINARY_SYMBOLS = new Set(['+', '-', '*', '/', '^', '<=', '>=', '<>', '~=', '=~', '~~', '=', '<', '>']);
const WORD_BINARY = new Set(['ET', 'OU']);
const CONSTANTES = new Set(['JOUR', 'MOIS', 'AN', 'VRAI', 'FAUX', 'UTI', 'VOID']);

/**
 * Regex de tokenisation (port de la regex construite dans le constructeur PHP).
 * Corrections : ajout de `~~`, et frontières de mots sur opérateurs/constantes
 * littéraux (évite que `etat` soit lu comme l'opérateur `et`).
 */
const TOKEN_RE = /^(\$\w+\s*:=[\s\S]*|\$(\w+)(?:\["?([^"]*)"?\])?|\[|et\b|ou\b|non\b|<>|>=|<=|~=|=~|~~|~|>|<|=|[a-z_]\w*\s*\(|jour\b|mois\b|an\b|vrai\b|faux\b|uti\b|void\b|\(|\d+(?:\.\d*)?|\.\d+|"\d{2}-\d{2}-\d{4}"|"|\+|-|\*|\/|=|\^)/i;

/* ---------------------- jetons RPN ---------------------- */

type RpnToken = MdValue | { op: string };
const isOp = (t: RpnToken): t is { op: string } => Object.prototype.hasOwnProperty.call(t, 'op');

/** Référence mutable d'index pour les scanners de caractères. */
interface Cursor { i: number; }

export interface MdExpressionOptions {
  variables?: Record<string, any>;
  dico?: Record<string, ChampDef>;
  interpreterVar?: boolean;
  user?: UserInfo;
  providers?: Providers;
  isConsole?: boolean;
  /** Défauts de devise (DEVISE_DECIMAL / DEVISE_SYMBOLE). */
  devise?: { decimal?: number; symbole?: string };
}

export class MdExpression implements EvalEngine {
  expression: string;
  variables: Record<string, any>;
  dico: Record<string, ChampDef>;
  interpreterVar: boolean;
  user?: UserInfo;
  providers: Providers;
  messages: ExpMessage[] = [];
  isConsole: boolean;
  deviseDefaut: { decimal: number; symbole: string };
  /** Variables créées/modifiées par affectation durant l'évaluation. */
  affectations: Record<string, any> = {};

  constructor(expression = '', options: MdExpressionOptions = {}) {
    this.expression = expression;
    this.variables = options.variables ?? {};
    this.dico = options.dico ?? {};
    this.interpreterVar = options.interpreterVar ?? false;
    this.user = options.user;
    this.providers = options.providers ?? {};
    this.isConsole = options.isConsole ?? false;
    this.deviseDefaut = { decimal: options.devise?.decimal ?? 2, symbole: options.devise?.symbole ?? '' };
  }

  /* ===================== point d'entrée ===================== */

  /** Évalue l'expression (ou celle fournie) et renvoie le résultat de la dernière ligne. */
  calcul(expression?: string): MdValue {
    let expr = expression === undefined ? this.expression : String(expression);
    expr = expr.trim();
    expr = expr.replace(/\/\*[\s\S]*?\*\//g, ''); // suppression des commentaires
    if (expr.trim() === '') return voidVal();

    expr = expr.replace(/&#39;/g, "'").replace(/\n|&nbsp;/g, ' ').replace(/\r/g, '');
    const lignes = expr.split(';');

    let resultat: MdValue = voidVal();
    for (const ligneRaw of lignes) {
      const ligne = ligneRaw.trim();
      if (ligne === '') continue;
      const rpn = this.creerPile(ligne);
      resultat = this.calculPile(rpn);
    }
    return resultat;
  }

  /* ===================== tokeniseur (shunting-yard) ===================== */

  private creerPile(expression: string): RpnToken[] {
    const output: RpnToken[] = [];
    const opStack: string[] = [];
    const cur: Cursor = { i: 0 };
    let attendOperateur = false;
    const len = expression.length;

    const flushFor = (op1: string) => {
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1]!;
        if (PRIORITE[top]! >= PRIORITE[op1]!) {
          output.push({ op: opStack.pop()! });
        } else break;
      }
    };

    while (cur.i < len) {
      while (cur.i < len && expression[cur.i] === ' ') cur.i++;
      if (cur.i >= len) break;

      const slice = expression.slice(cur.i);
      const match = TOKEN_RE.exec(slice);
      if (!match) {
        throw new ExpCriticalException(`${expression}: caractère non reconnu`);
      }
      const val = match[0]!;
      const U = val.toUpperCase();

      /* --- opérateurs (binaires + unaires - / NON) --- */
      if (BINARY_SYMBOLS.has(val) || WORD_BINARY.has(U) || U === 'NON') {
        if (!attendOperateur) {
          if (val === '-') {
            opStack.push('u-');
          } else if (U === 'NON') {
            opStack.push('NON');
          } else {
            throw new ExpCriticalException(`${expression}: erreur de syntaxe, ${val} mal placé`);
          }
          cur.i += val.length;
          continue;
        } else {
          if (U === 'NON') throw new ExpCriticalException(`${expression}: opérateur '${val}' non attendu`);
          const opSym = WORD_BINARY.has(U) ? U : val;
          flushFor(opSym);
          opStack.push(opSym);
          attendOperateur = false;
          cur.i += val.length;
          continue;
        }
      }

      /* --- sous-formule [nom] --- */
      if (val === '[') {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: opérateur attendu mais sous-expression fournie`);
        cur.i++;
        let nom = '';
        while (cur.i < len && expression[cur.i] !== ']') {
          const c = expression[cur.i]!;
          if (/[a-z0-9_]/i.test(c)) nom += c;
          else throw new ExpCriticalException(`${expression}: caractère invalide dans le nom d'une sous-expression`);
          cur.i++;
        }
        if (cur.i >= len) throw new ExpCriticalException(`${expression}: ']' manquant`);
        if (nom === '') throw new ExpCriticalException(`${expression}: nom de sous-formule manquant`);
        cur.i++; // passe le ]
        const sousExp = this.chargeExpression(nom);
        output.push(this.calcul(sousExp));
        attendOperateur = true;
        continue;
      }

      /* --- affectation $x := ... --- */
      const affect = /^\$(\w+)\s*:=([\s\S]*)$/.exec(val);
      if (affect) {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: opérateur attendu mais affectation fournie`);
        output.push(this.executeAffectation(affect[1]!, affect[2]!));
        attendOperateur = true;
        cur.i += val.length;
        continue;
      }

      /* --- variable $x / $x[i] --- */
      const variable = /^\$(\w+)(?:\[(.*)\])?$/.exec(val);
      if (variable) {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: opérateur attendu mais variable fournie`);
        output.push(this.executeVariable(variable[1]!, variable[2]));
        attendOperateur = true;
        cur.i += val.length;
        continue;
      }

      /* --- fonction nom(...) --- */
      const fonction = /^([a-z_]\w*)\s*\($/i.exec(val);
      if (fonction) {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: opérateur attendu mais fonction ${val} fournie`);
        const nomFonction = fonction[1]!;
        if (nomFonction.toUpperCase() === 'SI') {
          cur.i += 0; // executeSi lit depuis le début du token 'SI('
          output.push(this.executeSi(expression, cur));
        } else {
          cur.i += val.length; // passe "nom("
          const params = this.prepareParams(expression, cur);
          const fn = getFunction(nomFonction);
          if (!fn) throw new ExpCriticalException(`${expression}: fonction ${nomFonction} inconnue`);
          const r = fn(this, params);
          output.push(r == null ? voidVal() : r);
        }
        attendOperateur = true;
        continue;
      }

      /* --- bloc ( ... ) --- */
      if (val === '(') {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: opérateur attendu mais '(' fournie`);
        output.push(this.executeBloc(expression, cur));
        attendOperateur = true;
        continue;
      }

      /* --- constante --- */
      if (CONSTANTES.has(U)) {
        if (attendOperateur) throw new ExpCriticalException(`Un opérateur est attendu or la constante '${val}' a été fournie`);
        output.push(this.resoudConstante(U));
        attendOperateur = true;
        cur.i += val.length;
        continue;
      }

      /* --- chaine "..." --- */
      if (val === '"') {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: opérateur attendu mais chaine fournie`);
        output.push(str(this.extraitChaine(expression, cur)));
        attendOperateur = true;
        continue;
      }

      /* --- date littérale "JJ-MM-AAAA" --- */
      if (/\d{2}-\d{2}-\d{4}/.test(val)) {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: date trouvée alors qu'on attend un opérateur`);
        output.push(dte(val.replace(/"/g, '')));
        attendOperateur = true;
        cur.i += val.length;
        continue;
      }

      /* --- nombre --- */
      if (isNumericString(val)) {
        if (attendOperateur) throw new ExpCriticalException(`${expression}: nombre trouvé alors qu'on attend un opérateur`);
        output.push(nbr(Number(val)));
        attendOperateur = true;
        cur.i += val.length;
        continue;
      }

      if (val === '') { cur.i++; continue; }
      throw new ExpCriticalException(`${expression}: '${val}' n'est pas une expression correcte.`);
    }

    while (opStack.length > 0) output.push({ op: opStack.pop()! });
    return output;
  }

  /* ===================== évaluateur RPN ===================== */

  private calculPile(pile: RpnToken[]): MdValue {
    const stack: MdValue[] = [];
    for (const jeton of pile) {
      if (!isOp(jeton)) { stack.push(jeton); continue; }
      const op = jeton.op;
      if (UNAIRES.has(op)) {
        const a = stack.pop();
        if (a === undefined) throw new ExpCriticalException(`Opérateur unitaire ${op} orphelin`);
        stack.push(op === 'NON' ? op_not(a) : op_neg(a));
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new ExpCriticalException(`Opérateur orphelin ${op}`);
      stack.push(this.appliqueBinaire(op, a, b));
    }
    if (stack.length !== 1) {
      throw new ExpCriticalException('Incohérence dans la formule : éléments restants dans la pile de calcul');
    }
    return stack[0]!;
  }

  private appliqueBinaire(op: string, a: MdValue, b: MdValue): MdValue {
    switch (op.toUpperCase()) {
      case '+': return op_plus(a, b);
      case '-': return op_moins(a, b);
      case '*': return op_mult(a, b);
      case '/': return op_div(a, b);
      case '^': return op_pow(a, b);
      case 'ET': return op_et(a, b);
      case 'OU': return op_ou(a, b);
      case '=': return op_eqt(a, b);
      case '<>': return op_dif(a, b);
      case '<': return op_lt(a, b);
      case '<=': return op_let(a, b);
      case '>': return op_gt(a, b);
      case '>=': return op_get(a, b);
      case '~=': return op_startBy(a, b);
      case '~~': return op_has(a, b);
      case '=~': return op_endBy(a, b);
      default: throw new ExpCriticalException(`opérateur ${op} inconnu.`);
    }
  }

  /* ===================== constantes ===================== */

  private resoudConstante(name: string): MdValue {
    switch (name) {
      case 'JOUR': return nbr(jourConstant());
      // MOIS / AN : déclarées dans l'original mais jamais résolues (toujours en
      // erreur). On retient la sémantique naturelle et utile : mois et année
      // courants (cohérent avec les fonctions mois()/an()).
      case 'MOIS': return nbr(new Date().getUTCMonth() + 1);
      case 'AN': return nbr(new Date().getUTCFullYear());
      case 'VRAI': return nbr(1);
      case 'FAUX': return nbr(0);
      case 'UTI': return str(this.user?.login ?? '');
      case 'VOID': return voidVal();
      default: throw new ExpCriticalException(`Constante '${name}' non trouvée`);
    }
  }

  /* ===================== variables & affectations ===================== */

  private executeAffectation(nomVar: string, exprDroite: string): MdValue {
    const resultat = this.calcul(exprDroite.trim());
    const valeur = retVal(resultat);
    this.variables[nomVar] = valeur;
    this.affectations[nomVar] = valeur;
    if (resultat.type === 'dte') {
      this.dico[nomVar] = { ...(this.dico[nomVar] ?? {}), type_champ: 'date' };
    }
    return voidVal();
  }

  private executeVariable(nomVar: string, indice?: string): MdValue {
    if (!Object.prototype.hasOwnProperty.call(this.variables, nomVar)) {
      this.messages.push({ type: 'admin', text: `variable $${nomVar} inconnue. valeur 0 utilisée` });
      return nbr(0);
    }
    let valeur = this.variables[nomVar];

    // accès indicé $x[i]
    if (indice !== undefined && indice !== '' && typeof valeur === 'object' && valeur !== null) {
      let idx: any = indice;
      if (isNumericString(indice)) idx = Number(indice);
      else idx = retVal(this.calcul(indice));
      if (valeur[idx] === undefined) {
        this.messages.push({ type: 'admin', text: `indice ${idx} inconnu` });
        return nbr(0);
      }
      valeur = valeur[idx];
    }

    if (typeof valeur === 'object' && valeur !== null) {
      // tableau/objet renvoyé tel quel
      return { type: 'arr', value: valeur };
    }

    // détermination du type via le dictionnaire
    const typeDico = this.dico[nomVar]?.type_champ ?? '';
    let type: MdValue['type'] = 'str';
    switch (typeDico) {
      case 'date': type = 'dte'; break;
      case 'integer':
      case 'decimal':
      case 'boolean':
        if (valeur === '' || valeur === null || valeur === undefined) valeur = 0;
        type = 'nbr';
        break;
      case '':
      case 'string':
      case 'clop':
      case 'blob':
        type = 'str';
        break;
      default:
        type = isNumericString(String(typeDico)) ? 'nbr' : 'str';
        break;
    }

    // date MySQL -> date littérale interne
    if (matchMysqlDate(String(valeur))) {
      valeur = mysqlToLiteral(String(valeur));
      type = 'dte';
    }

    if (this.interpreterVar) {
      return this.calcul(String(valeur));
    }
    if (typeDico === '') {
      if (isNumericString(String(valeur)) || typeof valeur === 'boolean') type = 'nbr';
    }
    return { type, value: type === 'nbr' ? Number(valeur) : valeur };
  }

  /* ===================== chargement de sous-formules ===================== */

  private chargeExpression(nom: string): string {
    const formule = this.providers.params?.loadFormula(nom);
    if (formule == null) throw new ExpCriticalException(`la formule ${nom} est introuvable`);
    return formule;
  }

  /* ===================== SI(cond ? vrai : faux) ===================== */

  private executeSi(expression: string, cur: Cursor): MdValue {
    let nbOuvre = 0;
    let sousExp = '';
    let condition = '';
    let dansCondition = true;
    let vrai = '';
    let dansVrai = false;
    let faux = '';
    let dansFaux = false;
    let continuer = true;
    const len = expression.length;

    while (cur.i < len && continuer) {
      const char = expression[cur.i]!;
      if (char === '"') {
        sousExp += '"' + escapeChaine(this.extraitChaine(expression, cur)) + '"';
        continue; // extraitChaine a déjà avancé le curseur
      }
      switch (char) {
        case '(':
          if (nbOuvre > 0) sousExp += '(';
          else sousExp = '';
          nbOuvre++;
          break;
        case ')':
          nbOuvre--;
          if (nbOuvre > 0) sousExp += ')';
          else {
            if (dansFaux) { faux = sousExp; continuer = false; }
            else throw new ExpCriticalException(`${expression}: erreur dans la structure du SI`);
          }
          break;
        case '?':
          if (nbOuvre === 1) {
            if (dansCondition) { condition = sousExp; dansCondition = false; dansVrai = true; sousExp = ''; }
            else throw new ExpCriticalException(`${expression}: ? mal placé`);
          } else sousExp += '?';
          break;
        case ':':
          if (expression[cur.i + 1] === '=') sousExp += ':';
          else if (nbOuvre === 1) {
            if (dansVrai) { vrai = sousExp; dansVrai = false; dansFaux = true; sousExp = ''; }
            else throw new ExpCriticalException(`${expression}: : mal placé`);
          } else sousExp += ':';
          break;
        default:
          sousExp += char;
          break;
      }
      cur.i++;
    }

    if (nbOuvre > 0) throw new ExpCriticalException(`${expression}: ) manquant`);
    if (condition.trim() === '') throw new ExpCriticalException(`${expression}: condition manquante`);
    if (vrai.trim() === '') throw new ExpCriticalException(`${expression}: clause VRAI manquante`);
    if (faux.trim() === '') throw new ExpCriticalException(`${expression}: clause FAUX manquante`);

    return truthy(this.calcul(condition)) ? this.calcul(vrai) : this.calcul(faux);
  }

  /* ===================== bloc ( ... ) ===================== */

  private executeBloc(expression: string, cur: Cursor): MdValue {
    let continuer = true;
    let dansChaine = false;
    let sousExp = '';
    let nbOuvre = 0;
    const len = expression.length;

    while (cur.i < len && continuer) {
      const char = expression[cur.i]!;
      if (char === '"') dansChaine = !dansChaine;
      if (dansChaine) {
        sousExp += char;
      } else {
        switch (char) {
          case '(':
            if (nbOuvre > 0) sousExp += '(';
            nbOuvre++;
            break;
          case ')':
            nbOuvre--;
            if (nbOuvre > 0) sousExp += ')';
            else continuer = false;
            break;
          default:
            sousExp += char;
            break;
        }
      }
      cur.i++;
    }
    if (dansChaine) throw new ExpCriticalException(`${expression}: chaine non fermée`);
    if (nbOuvre > 0) throw new ExpCriticalException(`${expression}: ) manquante`);
    return this.calcul(sousExp);
  }

  /* ===================== paramètres de fonction ===================== */

  private prepareParams(expression: string, cur: Cursor): MdValue[] {
    const tempParams: string[] = [];
    let valParam = '';
    let continuer = true;
    let nbOuvre = 1;
    const len = expression.length;

    while (cur.i < len && continuer) {
      const char = expression[cur.i]!;
      if (char === '"') {
        valParam += '"' + escapeChaine(this.extraitChaine(expression, cur)) + '"';
        continue;
      }
      switch (char) {
        case ',':
          if (nbOuvre === 1) { tempParams.push(valParam.trim()); valParam = ''; }
          else valParam += ',';
          break;
        case '(':
          nbOuvre++;
          valParam += '(';
          break;
        case ')':
          if (nbOuvre === 1) { tempParams.push(valParam.trim()); valParam = ''; continuer = false; }
          else valParam += ')';
          nbOuvre--;
          break;
        default:
          valParam += char;
          break;
      }
      cur.i++;
    }

    if (nbOuvre !== 0) throw new ExpCriticalException(`${expression}: parenthèse fermante manquante`);
    if (valParam.trim() !== '') tempParams.push(valParam.trim());

    const params: MdValue[] = [];
    for (const expParam of tempParams) {
      if (expParam === '') continue;
      const r = this.calcul(expParam);
      if (!isVoid(r)) params.push(r);
    }
    return params;
  }

  /* ===================== extraction de chaine "..." ===================== */

  private extraitChaine(expression: string, cur: Cursor): string {
    cur.i++; // passe le " ouvrant
    let chaine = '';
    const len = expression.length;
    while (cur.i < len) {
      const char = expression[cur.i]!;
      if (char === '\\') {
        cur.i++;
        if (cur.i < len) { chaine += expression[cur.i]!; cur.i++; }
        continue;
      }
      if (char === '"') { cur.i++; return chaine; } // passe le " fermant
      chaine += char;
      cur.i++;
    }
    throw new ExpCriticalException(`${expression}: " manquant`);
  }
}

/** Échappe " et \ pour réinjecter une chaine dans une sous-expression. */
function escapeChaine(s: string): string {
  return s.replace(/([\\"])/g, '\\$1');
}

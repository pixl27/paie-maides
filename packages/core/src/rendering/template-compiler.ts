/**
 * Compilateur de gabarit « @ » — port de lib/compilateurTemplate.php.
 *
 * Directives supportées (drapeau `compiler` d'un écran) :
 *  - @si(cond) … @sinonsi(cond) … @sinon … @finsi
 *  - @pour($v de DÉBUT a FIN) … @finpour      (sens auto, bornes incluses)
 *  - @(expr)   évalue et AFFICHE (sauf tableau/void)
 *  - @[expr]   évalue SANS afficher (effets de bord : :=, messages…)
 *  - @nom / @nom[indice]   affiche une variable (formatage date auto)
 *  - @date @heure @page @pageTotale @sautPage
 *  - commentaires de bloc supprimés
 *
 * Différence avec l'original : pas de génération de fichier PHP intermédiaire
 * (faille d'injection) ; interprétation directe d'un AST, n'évaluant que la
 * branche retenue (comme le if/elseif/else compilé de l'original).
 */

import { MdExpression, type MdExpressionOptions } from '../expression/mdExpression.js';
import { retVal } from '../expression/value.js';

export interface CompileTemplateContexte extends MdExpressionOptions {
  /** Définition des champs du patron maître (pour le formatage date des @variables). */
  champs?: Record<string, { type_champ?: string }>;
}

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'var'; name: string; index?: string }
  | { kind: 'exprShow'; expr: string }
  | { kind: 'exprSilent'; expr: string }
  | { kind: 'sautPage' | 'page' | 'pageTotale' | 'date' | 'heure' }
  | { kind: 'si'; branches: { cond: string | null; body: Node[] }[] }
  | { kind: 'pour'; varName: string; start: number; stop: number; body: Node[] };

const BLOCK_KEYWORDS = new Set(['si', 'sinonsi', 'sinon', 'finsi', 'pour', 'finpour', 'sautpage']);

/** Compile et rend un gabarit avec ses directives @. */
export function compileTemplate(template: string, ctx: CompileTemplateContexte = {}): string {
  if (template.includes('<?php') || template.includes('<?') || template.includes('?>')) {
    throw new Error("ALERTE SECURITE : tentative d'injection de code");
  }
  // suppression des commentaires de bloc
  const t = template.replace(/\/\*[\s\S]*?\*\//g, '');

  const parser = new Parser(t);
  const { nodes } = parser.parseNodes(new Set());

  const engine = new MdExpression('', ctx);
  const champs = ctx.champs ?? {};
  return new Renderer(engine, champs).render(nodes);
}

/* ============================ Parseur ============================ */

class Parser {
  private s: string;
  private i = 0;
  constructor(s: string) { this.s = s; }

  /** Parse jusqu'à EOF ou jusqu'à une directive « stoppeuse » (qu'elle consomme). */
  parseNodes(stoppers: Set<string>): { nodes: Node[]; stop: string | null } {
    const nodes: Node[] = [];
    let text = '';
    const flush = () => { if (text !== '') { nodes.push({ kind: 'text', value: text }); text = ''; } };

    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c !== '@') { text += c; this.i++; continue; }

      const next = this.s[this.i + 1];
      // @(expr) / @[expr]
      if (next === '(') {
        flush();
        this.i++; // sur '('
        const { contenu } = this.lireBalance('(', ')');
        nodes.push({ kind: 'exprShow', expr: unescapeEntites(contenu) });
        continue;
      }
      if (next === '[') {
        flush();
        this.i++; // sur '['
        const { contenu } = this.lireBalance('[', ']');
        nodes.push({ kind: 'exprSilent', expr: unescapeEntites(contenu) });
        continue;
      }
      // @mot…
      const mot = this.lireMot(this.i + 1);
      if (mot === '') { text += '@'; this.i++; continue; } // '@' littéral

      const lower = mot.toLowerCase();

      // directive « stoppeuse » : on consomme le mot et on rend la main
      if (stoppers.has(lower)) {
        if (BLOCK_KEYWORDS.has(lower)) text = stripTrailingBr(text);
        flush();
        this.i += 1 + mot.length; // passe '@mot'
        return { nodes, stop: lower };
      }

      if (lower === 'si' || lower === 'pour') text = stripTrailingBr(text);
      flush();
      this.i += 1 + mot.length; // passe '@mot'

      switch (lower) {
        case 'si': nodes.push(this.parseSi()); break;
        case 'pour': nodes.push(this.parsePour()); break;
        case 'sautpage': this.skipFollowingBr(); nodes.push({ kind: 'sautPage' }); break;
        case 'pagetotale': nodes.push({ kind: 'pageTotale' }); break;
        case 'page': nodes.push({ kind: 'page' }); break;
        case 'date': nodes.push({ kind: 'date' }); break;
        case 'heure': nodes.push({ kind: 'heure' }); break;
        default: {
          // variable @nom ou @nom[indice]
          let index: string | undefined;
          if (this.s[this.i] === '[') {
            const { contenu } = this.lireBalance('[', ']');
            index = contenu;
          }
          nodes.push({ kind: 'var', name: mot, index });
        }
      }
    }
    flush();
    return { nodes, stop: null };
  }

  private parseSi(): Node {
    const branches: { cond: string | null; body: Node[] }[] = [];
    // condition du @si
    this.attendParenthese('si');
    let cond: string | null = unescapeEntites(this.lireBalance('(', ')').contenu);
    this.skipFollowingBr();
    for (;;) {
      const { nodes, stop } = this.parseNodes(new Set(['sinonsi', 'sinon', 'finsi']));
      branches.push({ cond, body: nodes });
      if (stop === 'sinonsi') {
        this.attendParenthese('sinonsi');
        cond = unescapeEntites(this.lireBalance('(', ')').contenu);
        this.skipFollowingBr();
        continue;
      }
      if (stop === 'sinon') {
        this.skipFollowingBr();
        const elseBlock = this.parseNodes(new Set(['finsi']));
        branches.push({ cond: null, body: elseBlock.nodes });
        this.skipFollowingBr();
        break;
      }
      // finsi (ou EOF toléré)
      this.skipFollowingBr();
      break;
    }
    return { kind: 'si', branches };
  }

  private parsePour(): Node {
    this.attendParenthese('pour');
    const inner = this.lireBalance('(', ')').contenu;
    const m = /\$(\w+)\s+de\s+(-?\d+)\s+a\s+(-?\d+)/i.exec(inner);
    if (!m) throw new Error(`@pour mal formé : (${inner})`);
    this.skipFollowingBr();
    const body = this.parseNodes(new Set(['finpour']));
    this.skipFollowingBr();
    return { kind: 'pour', varName: m[1]!, start: Number(m[2]), stop: Number(m[3]), body: body.nodes };
  }

  /* --- utilitaires de scan --- */

  private lireMot(pos: number): string {
    const m = /^[a-zA-Z_]\w*/.exec(this.s.slice(pos));
    return m ? m[0] : '';
  }

  private attendParenthese(dir: string): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
    if (this.s[this.i] !== '(') throw new Error(`@${dir} : '(' attendu`);
  }

  /** Lit un contenu équilibré ; `this.i` doit pointer sur l'ouvrant. Gère les chaines "…". */
  private lireBalance(open: string, close: string): { contenu: string } {
    if (this.s[this.i] !== open) throw new Error(`'${open}' attendu`);
    let depth = 0;
    let dansChaine = false;
    const debut = this.i;
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i]!;
      if (dansChaine) {
        if (c === '\\') { this.i++; continue; }
        if (c === '"') dansChaine = false;
        continue;
      }
      if (c === '"') { dansChaine = true; continue; }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) { const contenu = this.s.slice(debut + 1, this.i); this.i++; return { contenu }; }
      }
    }
    throw new Error(`'${close}' manquant dans le gabarit`);
  }

  private skipFollowingBr(): void {
    const m = /^\s*<br\s*\/?>\s*/i.exec(this.s.slice(this.i));
    if (m) this.i += m[0].length;
  }
}

/* ============================ Rendu ============================ */

class Renderer {
  constructor(private engine: MdExpression, private champs: Record<string, { type_champ?: string }>) {}

  render(nodes: Node[]): string {
    let out = '';
    for (const n of nodes) out += this.renderNode(n);
    return out;
  }

  private renderNode(n: Node): string {
    switch (n.kind) {
      case 'text': return n.value;
      case 'sautPage': return '</page><page>';
      case 'page': return '[[page_cu]]';
      case 'pageTotale': return '[[page_nb]]';
      case 'date': return wrap(formatDateNow());
      case 'heure': return wrap(formatHeureNow());
      case 'exprSilent': this.engine.calcul(n.expr); return '';
      case 'exprShow': {
        const tok = this.engine.calcul(n.expr);
        if (tok.type === 'arr' || tok.type === 'void') return '';
        return wrap(String(tok.value));
      }
      case 'var': return this.renderVar(n.name, n.index);
      case 'si': {
        for (const b of n.branches) {
          if (b.cond === null) return this.render(b.body); // @sinon
          if (truthyToken(this.engine.calcul(b.cond))) return this.render(b.body);
        }
        return '';
      }
      case 'pour': {
        let out = '';
        const reverse = n.start > n.stop;
        const save = this.engine.variables[n.varName];
        for (let v = n.start; reverse ? v >= n.stop : v <= n.stop; reverse ? v-- : v++) {
          this.engine.variables[n.varName] = v;
          out += this.render(n.body);
        }
        if (save === undefined) delete this.engine.variables[n.varName];
        else this.engine.variables[n.varName] = save;
        return out;
      }
    }
  }

  private renderVar(name: string, index?: string): string {
    const vars = this.engine.variables;
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      this.engine.messages.push({ type: 'debug', text: `gabarit : la variable @${name} n'est pas initialisée (chaine vide)` });
      return wrap('');
    }
    const valeur = vars[name];
    if (Array.isArray(valeur) || (typeof valeur === 'object' && valeur !== null)) {
      if (index === undefined || index === '') {
        return errSpan(`@${name}`, 'Variable tableau sans indice');
      }
      const io = retVal(this.engine.calcul(index));
      if (!Object.prototype.hasOwnProperty.call(valeur, io as any)) {
        return errSpan(`@${name}[${index}]`, 'Indice inconnu');
      }
      return wrap(String((valeur as any)[io as any]));
    }
    if (index !== undefined && index !== '') {
      return errSpan(`@${name}[${index}]`, "La variable n'est pas un tableau");
    }
    // scalaire : formatage date si le champ est de type date ou si valeur ressemble à une date
    const estDate = this.champs[name]?.type_champ === 'date' || /\d{4}-\d{2}-\d{2}/.test(String(valeur));
    return wrap(estDate ? formatDateAffichage(valeur) : String(valeur));
  }
}

/* ============================ Helpers ============================ */

function wrap(contenu: string): string {
  return `<span class="arob affRO">${contenu}</span>`;
}

function errSpan(tag: string, message: string): string {
  return `<span class="tpl error">${tag} <span class="message">${message}</span></span>`;
}

function unescapeEntites(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

/** Retire un éventuel <br> final (avec espaces) d'un texte précédant une directive bloc. */
function stripTrailingBr(text: string): string {
  return text.replace(/\s*<br\s*\/?>\s*$/i, '');
}

function truthyToken(tok: { type: string; value: any }): boolean {
  const raw = retVal(tok as any);
  return !(raw === 0 || raw === '0' || raw === '' || raw === null || raw === undefined || raw === false);
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

// @date / @heure : heure LOCALE du serveur (port du date('d/m/Y') / date('H:i') PHP).
function formatDateNow(): string {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatHeureNow(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Formate une valeur date (MySQL AAAA-MM-JJ ou littéral JJ-MM-AAAA) en JJ/MM/AAAA. */
function formatDateAffichage(v: any): string {
  const s = String(v);
  const my = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (my) return `${my[3]}/${my[2]}/${my[1]}`;
  const lit = /(\d{2})-(\d{2})-(\d{4})/.exec(s);
  if (lit) return `${lit[1]}/${lit[2]}/${lit[3]}`;
  return s;
}

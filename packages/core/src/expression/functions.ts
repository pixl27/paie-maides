/**
 * Bibliothèque de fonctions standard du langage « maides »
 * (port de mdExpressionFonctions.php et des méthodes fFunc_* de mdExpression.php).
 *
 * Les noms sont insensibles à la casse (comme function_exists en PHP).
 */

import {
  MdValue, nbr, str, dte, arr, voidVal,
  isNbr, isStr, isDte, isVoid, isNumericString,
} from './value.js';
import {
  nbJourFromLiteral, literalFromDays, todayLiteral, matchLiteralDate,
  literalToMysql, mysqlToLiteral,
} from './dates.js';
import { ExpCriticalException, ExpWarningException } from './errors.js';
import { sprintf } from './sprintf.js';
import { EvalEngine, FnImpl } from './env.js';

/* ------------------------------------------------------------------ */
/* Helpers de formatage                                                */
/* ------------------------------------------------------------------ */

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function pad2(n: number): string { return String(n).padStart(2, '0'); }

/** number_format façon PHP (séparateur décimal et de milliers paramétrables). */
function numberFormat(value: number, dec: number, decPoint = ',', thousands = ' '): string {
  const neg = value < 0;
  const fixed = Math.abs(value).toFixed(dec);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  let out = grouped;
  if (dec > 0) out += decPoint + decPart;
  return (neg ? '-' : '') + out;
}

/** Parse une date (littérale JJ-MM-AAAA ou MySQL AAAA-MM-JJ) en Date UTC. */
function parseToDate(s: string): Date {
  const lit = matchLiteralDate(s);
  if (lit) return new Date(Date.UTC(Number(lit.y), Number(lit.m) - 1, Number(lit.d)));
  const mysql = mysqlToLiteral(s); // renvoie tel quel si pas mysql
  const lit2 = matchLiteralDate(mysql);
  if (lit2) return new Date(Date.UTC(Number(lit2.y), Number(lit2.m) - 1, Number(lit2.d)));
  const t = Date.parse(s);
  return Number.isNaN(t) ? new Date(0) : new Date(t);
}

/** Sous-ensemble de date() de PHP utilisé par formateDate(). */
function phpDate(format: string, d: Date): string {
  const map: Record<string, () => string> = {
    d: () => pad2(d.getUTCDate()),
    j: () => String(d.getUTCDate()),
    m: () => pad2(d.getUTCMonth() + 1),
    n: () => String(d.getUTCMonth() + 1),
    Y: () => String(d.getUTCFullYear()),
    y: () => pad2(d.getUTCFullYear() % 100),
    H: () => pad2(d.getUTCHours()),
    G: () => String(d.getUTCHours()),
    i: () => pad2(d.getUTCMinutes()),
    s: () => pad2(d.getUTCSeconds()),
  };
  let out = '';
  for (let i = 0; i < format.length; i++) {
    const c = format[i]!;
    out += map[c] ? map[c]!() : c;
  }
  return out;
}

/** Sous-ensemble de strftime() utilisé par dateLitterale(). */
function strftime(format: string, d: Date): string {
  return format
    .replace(/%d/g, pad2(d.getUTCDate()))
    .replace(/%e/g, String(d.getUTCDate()))
    .replace(/%B/g, MOIS_FR[d.getUTCMonth()]!)
    .replace(/%m/g, pad2(d.getUTCMonth() + 1))
    .replace(/%A/g, JOURS_FR[d.getUTCDay()]!)
    .replace(/%Y/g, String(d.getUTCFullYear()))
    .replace(/%G/g, String(d.getUTCFullYear()));
}

/* ------------------------------------------------------------------ */
/* Fonctions du langage                                                */
/* ------------------------------------------------------------------ */

const fns: Record<string, FnImpl> = {};
const reg = (name: string, fn: FnImpl) => { fns[name.toLowerCase()] = fn; };

/* --- numériques --- */

reg('int', (_e, [p]) => nbr(Math.trunc(Number(p?.value) || 0)));

reg('chaine', (_e, [n]) => {
  if (!n || !isNbr(n)) throw new ExpCriticalException('chaine($nombre): $nombre doit etre un nombre');
  return str(n.value);
});

reg('rd', (_e, [decimal, valeur]) => { // arrondi inférieur au multiple
  if (!decimal || !valeur || !isNbr(decimal) || !isNbr(valeur)) {
    throw new ExpCriticalException("rd(): n'accepte que des arguments numériques");
  }
  return nbr(Math.floor(Number(valeur.value) / Number(decimal.value)) * Number(decimal.value));
});

reg('ru', (_e, [decimal, valeur]) => { // arrondi supérieur au multiple
  if (!decimal || !valeur || !isNbr(decimal) || !isNbr(valeur)) {
    throw new ExpCriticalException("ru(): n'accepte que des arguments numériques");
  }
  return nbr(Math.ceil(Number(valeur.value) / Number(decimal.value)) * Number(decimal.value));
});

reg('rn', (_e, [decimal, valeur]) => { // arrondi au plus proche multiple
  if (!decimal || !valeur || !isNbr(decimal) || !isNbr(valeur)) {
    throw new ExpCriticalException("rn(): n'accepte que des arguments numériques");
  }
  return nbr(Math.round(Number(valeur.value) / Number(decimal.value)) * Number(decimal.value));
});

/** Port de min()/max() PHP : comparaison numérique si TOUS les args sont
 * numériques, sinon lexicographique (sur chaînes). Type de sortie préservé. */
function minMax(args: MdValue[], nom: string, prendre: (a: any, b: any) => boolean): MdValue {
  if (args.length === 0) throw new ExpCriticalException(`${nom}(): aucun argument fourni`);
  const vals = args.map((a) => a.value);
  const tousNum = vals.every((x) => typeof x === 'number' || isNumericString(String(x)));
  let r = vals[0];
  for (const x of vals) {
    const gagne = tousNum ? prendre(Number(x), Number(r)) : prendre(String(x), String(r));
    if (gagne) r = x;
  }
  return tousNum ? nbr(r) : str(r);
}
reg('min', (_e, args) => minMax(args, 'min', (a, b) => a < b));
reg('max', (_e, args) => minMax(args, 'max', (a, b) => a > b));

reg('ln', (_e, [v]) => {
  const x = Number(v?.value);
  if (Number.isNaN(x)) throw new ExpCriticalException('ln() : argument doit être un nombre valide');
  return nbr(Math.log(x));
});

/* --- découpage --- */

reg('decoupe', (_e, [sep, chaine, tailleMax, valeurDefaut]) => {
  if (!sep || !chaine || !isStr(chaine) || !isStr(sep)) {
    throw new ExpCriticalException('decoupe(separateur, chaine): séparateur et chaine doivent être des chaines');
  }
  let res = String(chaine.value).split(String(sep.value));
  if (!tailleMax) return arr(res);
  const max = Number(tailleMax.value);
  if (max > res.length) {
    const def = valeurDefaut ? valeurDefaut.value : '';
    const fill = new Array(max).fill(def);
    res = [...fill, ...res];
  } else {
    res = res.slice(0, max);
  }
  return arr(res);
});

/* --- dates --- */

function fDate(arg?: MdValue): MdValue {
  if (arg && isDte(arg)) return arg;
  if (arg && isStr(arg)) {
    const lit = matchLiteralDate(String(arg.value));
    if (!lit) throw new ExpCriticalException(`date() : la chaine "${arg.value}" n'est pas un format de date reconnu.`);
    return fChaineVersDate(arg);
  }
  if (!arg || isVoid(arg)) return dte(todayLiteral());
  if (isNbr(arg)) {
    return dte(literalFromDays(Number(arg.value)));
  }
  throw new ExpCriticalException(`date(): type ${arg.type} non autorisé.`);
}
reg('date', (_e, [d]) => fDate(d));

reg('heure', (_e, [t]) => {
  if (t && isDte(t)) return t;
  const seconds = (t && isNbr(t)) ? Number(t.value) * 86400 : Date.now() / 1000;
  const d = new Date(seconds * 1000);
  return dte(`${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`);
});

function fNbJour(arg?: MdValue): MdValue {
  let d = arg;
  if (!d || isVoid(d)) d = fDate();
  if (!isDte(d!)) throw new ExpCriticalException("jour(): cette fonction n'accepte qu'un argument date.");
  return nbr(nbJourFromLiteral(String(d!.value)));
}
reg('nbJour', (_e, [d]) => fNbJour(d));

reg('dateMoins', (_e, [date1, date2]) => {
  if (!date1 || !isDte(date1)) throw new ExpCriticalException('dateMoins(): le 1er argument doit être une date');
  let d2 = date2!;
  if (d2 && isDte(d2)) d2 = fNbJour(d2);
  if (!d2 || !isNbr(d2)) throw new ExpCriticalException('dateMoins(): le 2e argument doit être une date ou un nombre');
  return nbr(Number(fNbJour(date1).value) - Number(d2.value));
});

reg('datePlus', (_e, [date1, date2]) => {
  if (!date1 || !isDte(date1)) throw new ExpCriticalException('datePlus(): le 1er argument doit être une date');
  let d2 = date2!;
  if (d2 && isDte(d2)) d2 = fNbJour(d2);
  if (!d2 || !isNbr(d2)) throw new ExpCriticalException('datePlus(): le 2e argument doit être une date ou un nombre');
  return nbr(Number(fNbJour(date1).value) + Number(d2.value));
});

function fAn(date: MdValue = voidVal(), decimal: MdValue = nbr(4)): MdValue {
  let d = date;
  if (isVoid(d)) d = fDate();
  if (isNbr(d)) d = fDate(d);
  if (!isDte(d)) throw new ExpCriticalException('an($date): $date doit être une date');
  if (!isNbr(decimal) || (Number(decimal.value) !== 2 && Number(decimal.value) !== 4)) {
    throw new ExpCriticalException('an($date, $decimal): $decimal doit valoir 2 ou 4');
  }
  const s = String(d.value);
  return nbr(Number(decimal.value) === 2 ? s.slice(6, 8) : s.slice(6));
}
reg('an', (_e, [d, dec]) => fAn(d ?? voidVal(), dec ?? nbr(4)));

reg('mois', (_e, [date]) => {
  let d = date!;
  if (d && isNbr(d)) d = fDate(d);
  if (!d || !isDte(d)) throw new ExpCriticalException('mois($date): $date doit être une date');
  return nbr(String(d.value).slice(3, 5));
});

reg('jour', (_e, [date]) => {
  let d = date!;
  if (d && isNbr(d)) d = fDate(d);
  if (!d || !isDte(d)) throw new ExpCriticalException('jour($date): $date doit être une date');
  return nbr(String(d.value).slice(0, 2));
});

reg('age', (_e, [date1, date2]) => {
  let d1 = date1!;
  if (d1 && isStr(d1)) d1 = fChaineVersDate(d1);
  if (d1 && isDte(d1)) d1 = fNbJour(d1);
  let d2 = date2 ?? fNbJour();
  if (isStr(d2)) d2 = fChaineVersDate(d2); // accepte une date de référence en chaine
  if (isDte(d2)) d2 = fNbJour(d2);
  const diff = Math.abs(Number(d2.value) - Number(d1.value));
  const annee = Number(fAn(nbr(diff)).value);
  return nbr(annee - 1970);
});

function fChaineVersDate(s: MdValue): MdValue {
  if (!isStr(s)) throw new ExpCriticalException("chaineVersDate(): l'argument doit être une chaine");
  const m = matchLiteralDate(String(s.value));
  if (!m) throw new ExpCriticalException(`chaineVersDate(): date malformée (attendu JJ-MM-AAAA), reçu '${s.value}'`);
  // Format littéral interne JJ-MM-AAAA (corrige une incohérence de l'original qui
  // produisait AAAA-MM-JJ alors que toutes les autres fonctions attendent JJ-MM-AAAA).
  return dte(`${m.d}-${m.m}-${m.y}`);
}
reg('chaineVersDate', (_e, [s]) => fChaineVersDate(s!));
reg('dateVersChaine', (_e, [s]) => s ?? voidVal()); // l'original retourne l'argument inchangé

reg('formateDate', (_e, [dateChaine, format]) => {
  const d = parseToDate(String(dateChaine?.value ?? ''));
  return str(phpDate(String(format?.value ?? 'd/m/Y'), d));
});

reg('dateLitterale', (_e, [date, format]) => {
  const d = parseToDate(String(date?.value ?? ''));
  return str(strftime(String(format?.value ?? '%d %B %G'), d));
});

reg('maintenant', () => {
  const d = new Date();
  return str(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`);
});

/* --- chaines --- */

reg('formate', (_e, args) => {
  if (args.length < 2) throw new ExpCriticalException('formate(): il faut au moins le format et une variable');
  const [fmt, ...rest] = args;
  return str(sprintf(String(fmt!.value), ...rest.map((a) => a.value)));
});

reg('devise', (engine, [valeur, decimal, symbole]) => {
  const dec = (!decimal || isVoid(decimal)) ? (engine.deviseDefaut?.decimal ?? 2) : Number(decimal.value);
  const sym = (!symbole || isVoid(symbole)) ? (engine.deviseDefaut?.symbole ?? '') : String(symbole.value);
  let v = valeur?.value;
  if (v === '' || v === undefined || v === null) v = 0;
  if (!isNumericString(String(v)) && typeof v !== 'number') return str('devise : valeur non numérique');
  const formatted = numberFormat(Math.round(Number(v) * 10 ** dec) / 10 ** dec, dec);
  return str(`${formatted} ${sym}`);
});

reg('remplace', (_e, [de, vers, chaine]) => {
  if (!de || !isStr(de) || !vers || !isStr(vers) || !chaine || !isStr(chaine)) {
    throw new ExpCriticalException('remplace(de, vers, chaine): les 3 arguments doivent être des chaines');
  }
  return str(String(chaine.value).split(String(de.value)).join(String(vers.value)));
});

reg('taille', (_e, [v]) => {
  if (!v) throw new ExpCriticalException("taille(): l'argument doit être une chaine ou un nombre");
  return nbr(String(v.value).length);
});

reg('cle', (_e, args) => str(args.map((a) => a.value).join('.')));

/* --- divers --- */

reg('modeConsole', (engine) => nbr(engine.isConsole ? 1 : 0));
reg('superAdmin', (engine) => nbr(engine.user?.superAdmin ? 1 : 0));
reg('niveauDroits', (engine) => nbr(engine.user?.niveau ?? 0));
reg('sautPage', () => str('</page><page>'));

reg('valeur', (engine, [nomVar, def]) => {
  const name = String(nomVar?.value);
  if (Object.prototype.hasOwnProperty.call(engine.variables, name)) {
    return str(engine.variables[name]);
  }
  if (def && !isVoid(def)) return def;
  throw new ExpCriticalException(`valeur(): variable '${name}' inconnue.`);
});

reg('existe', (engine, [nomVar]) => {
  if (!nomVar || !isStr(nomVar)) throw new ExpCriticalException('existe($nomVar): $nomVar doit être une chaine');
  return nbr(Object.prototype.hasOwnProperty.call(engine.variables, String(nomVar.value)) ? 1 : 0);
});

reg('calcul', (engine, [expression]) => engine.calcul(String(expression?.value ?? '')));

/* --- messages utilisateur --- */

const pushMsg = (engine: EvalEngine, type: any, text: string, niveau?: number) =>
  engine.messages.push({ type, text, niveau });
reg('messageErreur', (engine, [m]) => { pushMsg(engine, 'erreur', String(m?.value)); });
reg('messageAttention', (engine, [m]) => { pushMsg(engine, 'attention', String(m?.value)); });
reg('messageSucces', (engine, [m]) => { pushMsg(engine, 'succes', String(m?.value)); });
reg('messageAdmin', (engine, [m]) => { pushMsg(engine, 'admin', String(m?.value)); });
reg('messageDebug', (engine, [m, n]) => { pushMsg(engine, 'debug', String(m?.value), n ? Number(n.value) : undefined); });

/* --- navigation --- */

reg('goUrl', (engine, [url]) => {
  if (!engine.providers.nav) throw new ExpWarningException('goUrl(): navigation indisponible dans ce contexte');
  engine.providers.nav.goUrl(String(url?.value));
});
reg('goObe', (engine, [o, b, e]) => {
  if (!engine.providers.nav) throw new ExpWarningException('goObe(): navigation indisponible dans ce contexte');
  engine.providers.nav.goObe(String(o?.value ?? ''), String(b?.value ?? ''), String(e?.value ?? ''));
});

/* --- accès données (R4 / SQL) : nécessitent des fournisseurs injectés --- */

function numOrStr(v: string | number): MdValue {
  return (typeof v === 'number' || isNumericString(String(v))) ? nbr(v as any) : str(String(v));
}

reg('table', (engine, [nomTable, cle]) => {
  if (!engine.providers.params) throw new ExpWarningException('table(): fournisseur de paramètres indisponible');
  const r = engine.providers.params.table(String(nomTable?.value), String(cle?.value));
  if (r === null) throw new ExpWarningException(`table(): aucun enregistrement pour ${nomTable?.value}.${cle?.value}`);
  return numOrStr(r);
});

reg('tableInf', (engine, [nomTable, cle]) => {
  if (!engine.providers.params) throw new ExpWarningException('tableInf(): fournisseur de paramètres indisponible');
  const r = engine.providers.params.tableInf(String(nomTable?.value), String(cle?.value));
  if (r === null) throw new ExpWarningException(`tableInf(): aucun enregistrement pour ${nomTable?.value}.${cle?.value}`);
  return numOrStr(r);
});

reg('tableSup', (engine, [nomTable, cle]) => {
  if (!engine.providers.params) throw new ExpWarningException('tableSup(): fournisseur de paramètres indisponible');
  const r = engine.providers.params.tableSup(String(nomTable?.value), String(cle?.value));
  if (r === null) throw new ExpWarningException(`tableSup(): aucun enregistrement pour ${nomTable?.value}.${cle?.value}`);
  return numOrStr(r);
});

reg('aggregate', (engine, [operation, table, champ, filtre, fusion]) => {
  if (!engine.providers.data) throw new ExpWarningException('aggregate(): fournisseur de données indisponible');
  const r = engine.providers.data.aggregate(
    String(operation?.value), String(table?.value), String(champ?.value),
    String(filtre?.value), Boolean(fusion ? fusion.value : 0),
  );
  return nbr(r);
});

reg('requete', (engine, [requete]) => {
  if (!engine.providers.data) throw new ExpWarningException('requete(): fournisseur de données indisponible');
  if (!requete || !isStr(requete) || requete.value === '') throw new ExpWarningException('requete(): requête vide ou invalide');
  const rows = engine.providers.data.query(String(requete.value), engine.variables);
  return arr(rows[0] ?? {});
});

reg('chargeEnregistrement', (engine, [table, cle, init]) => {
  if (!engine.providers.data) throw new ExpWarningException('chargeEnregistrement(): fournisseur de données indisponible');
  const rec = engine.providers.data.loadRecord(String(table?.value), String(cle?.value), init ? Boolean(init.value) : true);
  if (rec === null) throw new ExpCriticalException(`chargeEnregistrement(): introuvable ${table?.value}.${cle?.value}`);
  return arr(rec as any);
});

reg('documentExiste', (engine, [patron, cle]) => {
  if (!engine.providers.data) throw new ExpWarningException('documentExiste(): fournisseur de données indisponible');
  return nbr(engine.providers.data.documentExists(String(patron?.value), String(cle?.value)) ? 1 : 0);
});

reg('indice', (engine, [code, date]) => {
  if (!engine.providers.params?.indice) throw new ExpWarningException('indice(): fournisseur indisponible');
  const dStr = date ? literalToMysql(String(date.value)) : literalToMysql(todayLiteral());
  const r = engine.providers.params.indice(String(code?.value), dStr);
  if (r === false) throw new ExpCriticalException(`indice(): l'indice ${code?.value} est inconnu`);
  return nbr(r);
});

/* --- dates : année bissextile (l'original était un stub vide) --- */

reg('bissextile', (_e, [date]) => {
  let d = date;
  if (d && isNbr(d)) d = fDate(d);
  if (d && isStr(d)) d = fChaineVersDate(d);
  if (!d || !isDte(d)) throw new ExpCriticalException('bissextile($date): $date doit être une date');
  const y = Number(String(d.value).slice(6));
  const leap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  return nbr(leap ? 1 : 0);
});

/* --- contexte écran (port des fFunc_* agissant sur $zzz / containerForm) --- */

function fEstNouveau(engine: EvalEngine): MdValue {
  if (engine.providers.form) return nbr(engine.providers.form.nouveauDoc() ? 1 : 0);
  const v = engine.variables['nouveauDoc'] ?? engine.variables['__nouveau'];
  return nbr(v ? 1 : 0);
}
reg('nouveauDoc', (engine) => fEstNouveau(engine));
reg('estNouveau', (engine) => fEstNouveau(engine));

reg('lectureSeule', (engine, [w]) => {
  if (!engine.providers.form) throw new ExpWarningException('lectureSeule(): écran indisponible dans ce contexte');
  engine.providers.form.lectureSeule(String(w?.value));
});
reg('active', (engine, [w]) => {
  if (!engine.providers.form) throw new ExpWarningException('active(): écran indisponible dans ce contexte');
  engine.providers.form.active(String(w?.value));
});
reg('desactive', (engine, [w, hard]) => {
  if (!engine.providers.form) throw new ExpWarningException('desactive(): écran indisponible dans ce contexte');
  engine.providers.form.desactive(String(w?.value), hard ? Boolean(hard.value) : true);
});
reg('desactiveForm', (engine, [saufBouton]) => {
  if (!engine.providers.form) throw new ExpWarningException('desactiveForm(): écran indisponible dans ce contexte');
  engine.providers.form.desactiveForm(saufBouton ? Boolean(saufBouton.value) : true);
});
reg('ajouteJScript', (engine, [script]) => {
  if (!engine.providers.form) throw new ExpWarningException('ajouteJScript(): écran indisponible dans ce contexte');
  engine.providers.form.ajouteJScript(String(script?.value ?? ''));
});

reg('include', (engine, [ecran]) => {
  if (!engine.providers.form) throw new ExpWarningException('include(): écran indisponible dans ce contexte');
  return str(engine.providers.form.include(String(ecran?.value)));
});

reg('loadGo', (engine, [page]) => {
  if (!engine.providers.form) throw new ExpWarningException('loadGo(): écran indisponible dans ce contexte');
  engine.providers.form.loadGo(String(page?.value));
});

/* --- accès client / requêtes tabulaires --- */

reg('variableClient', (engine, [nomVar, def]) => {
  // Port fidèle : REQUESTGET renvoie TOUJOURS une valeur (le défaut si absente,
  // au minimum la chaine vide) ; ne lève jamais.
  const name = String(nomVar?.value);
  const defaut: MdValue = def && !isVoid(def) ? def : str('');
  if (engine.providers.request) {
    const v = engine.providers.request.get(name, undefined);
    if (v !== undefined && v !== null) return numOrStr(v);
  }
  return defaut;
});

reg('tableauRequete', (engine, [requete, chaineSiVide, classe]) => {
  if (!engine.providers.data) throw new ExpWarningException('tableauRequete(): fournisseur de données indisponible');
  const rows = engine.providers.data.query(String(requete?.value ?? ''), engine.variables);
  if (!rows || rows.length === 0) return str(chaineSiVide ? String(chaineSiVide.value) : '');
  const cls = classe && !isVoid(classe) ? String(classe.value) : '';
  const cols = Object.keys(rows[0]!);
  const esc = (s: any) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let html = `<table${cls ? ` class="${esc(cls)}"` : ''}><thead><tr>`;
  for (const c of cols) html += `<th>${esc(c)}</th>`;
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (const c of cols) html += `<td>${esc((row as Record<string, any>)[c])}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  return str(html);
});

/* ------------------------------------------------------------------ */
/* Registre (built-ins + extensions applicatives)                      */
/* ------------------------------------------------------------------ */

/**
 * Enregistre une fonction du langage (port de specifique/expression.php :
 * une application peut ajouter ses propres fFunc_*). Insensible à la casse.
 */
export function registerFunction(name: string, fn: FnImpl): void {
  fns[name.toLowerCase()] = fn;
}

/** Retire une fonction (utile pour les tests et le rechargement à chaud). */
export function unregisterFunction(name: string): void {
  delete fns[name.toLowerCase()];
}

/** Snapshot des fonctions standard, pour introspection (clé en minuscules). */
export const standardFunctions: ReadonlyMap<string, FnImpl> = new Map(Object.entries(fns));

export function hasFunction(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(fns, name.toLowerCase());
}

export function getFunction(name: string): FnImpl | undefined {
  return fns[name.toLowerCase()];
}

import { describe, it, expect } from 'vitest';
import { MdExpression, evaluer, evaluerValeur } from '../src/expression/index.js';
import { ExpCriticalException } from '../src/expression/errors.js';

/** Helper : valeur brute du résultat. */
const v = (expr: string, opts?: any) => evaluerValeur(expr, opts);
/** Helper : jeton résultat. */
const j = (expr: string, opts?: any) => evaluer(expr, opts);

describe('arithmétique & précédence', () => {
  it('opérations de base', () => {
    expect(v('1 + 2')).toBe(3);
    expect(v('10 - 4')).toBe(6);
    expect(v('6 * 7')).toBe(42);
    expect(v('20 / 5')).toBe(4);
  });
  it('précédence * avant +', () => {
    expect(v('2 + 3 * 4')).toBe(14);
    expect(v('(2 + 3) * 4')).toBe(20);
  });
  it('puissance ^ (corrige un opérateur manquant de l’original)', () => {
    expect(v('2 ^ 10')).toBe(1024);
  });
  it('moins unaire (généralisé)', () => {
    expect(v('-5 + 2')).toBe(-3);
    expect(v('3 * -2')).toBe(-6);
    expect(v('-$x', { variables: { x: 5 } })).toBe(-5);
  });
  it('division par zéro lève une erreur', () => {
    expect(() => v('1 / 0')).toThrow(ExpCriticalException);
  });
});

describe('comparaisons', () => {
  it('numériques', () => {
    expect(v('5 > 3')).toBe(1);
    expect(v('5 < 3')).toBe(0);
    expect(v('5 >= 5')).toBe(1);
    expect(v('4 <= 3')).toBe(0);
    expect(v('2 = 2')).toBe(1);
    expect(v('2 <> 3')).toBe(1);
  });
});

describe('logique ET / OU / NON', () => {
  it('ET / OU', () => {
    expect(v('1 ET 1')).toBe(1);
    expect(v('1 ET 0')).toBe(0);
    expect(v('0 OU 1')).toBe(1);
    expect(v('0 OU 0')).toBe(0);
  });
  it('NON', () => {
    expect(v('NON VRAI')).toBe(0);
    expect(v('NON FAUX')).toBe(1);
    expect(v('NON (1 = 2)')).toBe(1);
  });
  it('précédence : ET avant OU', () => {
    expect(v('1 OU 0 ET 0')).toBe(1); // 1 OU (0 ET 0)
  });
});

describe('chaines & opérateurs ~= ~~ =~', () => {
  it('concaténation via +', () => {
    expect(v('"a" + "b"')).toBe('ab');
    expect(v('"x" + 1')).toBe('x1');
  });
  it('~= commence par', () => {
    expect(v('"abc" ~= "ab"')).toBe(1);
    expect(v('"abc" ~= "zz"')).toBe(0);
  });
  it('~~ contient (corrige un opérateur jamais tokenisé)', () => {
    expect(v('"ab" ~~ "xabz"')).toBe(1);
    expect(v('"qq" ~~ "xabz"')).toBe(0);
  });
  it('=~ se termine par (ordre d’opérandes fidèle à l’original)', () => {
    expect(v('"bc" =~ "abc"')).toBe(1);
    expect(v('"xy" =~ "abc"')).toBe(0);
  });
});

describe('constantes', () => {
  it('VRAI / FAUX', () => {
    expect(v('VRAI')).toBe(1);
    expect(v('FAUX')).toBe(0);
  });
  it('JOUR est un nombre', () => {
    expect(j('JOUR').type).toBe('nbr');
  });
  it('VOID', () => {
    expect(j('VOID').type).toBe('void');
  });
  it('UTI = login utilisateur', () => {
    expect(v('UTI', { user: { login: 'bob', superAdmin: false, niveau: 0 } })).toBe('bob');
  });
});

describe('SI(cond ? vrai : faux)', () => {
  it('branche vraie / fausse', () => {
    expect(v('SI(1 = 1 ? "oui" : "non")')).toBe('oui');
    expect(v('SI(5 > 10 ? "oui" : "non")')).toBe('non');
  });
  it('SI imbriqué', () => {
    expect(v('SI(1 = 1 ? SI(2 = 2 ? 10 : 20) : 30)')).toBe(10);
  });
  it('insensible à la casse', () => {
    expect(v('si(1 = 1 ? 7 : 8)')).toBe(7);
  });
});

describe('variables & dictionnaire de types', () => {
  it('variable simple numérique', () => {
    expect(v('$x + 1', { variables: { x: 5 } })).toBe(6);
  });
  it('variable inconnue -> 0', () => {
    expect(v('$inconnue + 1')).toBe(1);
  });
  it('variable typée date (MySQL -> littéral)', () => {
    const opts = { variables: { d: '2020-06-15' }, dico: { d: { type_champ: 'date' } } };
    expect(v('an($d)', opts)).toBe(2020);
    expect(v('mois($d)', opts)).toBe(6);
    expect(v('jour($d)', opts)).toBe(15);
  });
  it('accès indicé $x[i]', () => {
    expect(v('$t["a"]', { variables: { t: { a: 42 } } })).toBe(42);
  });
});

describe('affectations := et multi-instructions ;', () => {
  it('affectation puis usage', () => {
    expect(v('$x := 10 ; $x * 2')).toBe(20);
  });
  it('renvoie le résultat de la dernière instruction', () => {
    expect(v('$a := 3 ; $b := 4 ; $a + $b')).toBe(7);
  });
  it('expose les variables affectées', () => {
    const e = new MdExpression('$prime := 100 ; $prime * 1.2');
    expect(e.calcul().value).toBeCloseTo(120);
    expect(e.affectations.prime).toBe(100);
  });
});

describe('fonctions — numériques & chaines', () => {
  it('int / min / max / taille', () => {
    expect(v('int(3.9)')).toBe(3);
    expect(v('min(3, 1, 2)')).toBe(1);
    expect(v('max(3, 1, 2)')).toBe(3);
    expect(v('taille("hello")')).toBe(5);
  });
  it('arrondis au multiple rd / ru / rn', () => {
    expect(v('rd(10, 47)')).toBe(40);
    expect(v('ru(10, 41)')).toBe(50);
    expect(v('rn(10, 44)')).toBe(40);
    expect(v('rn(10, 45)')).toBe(50);
  });
  it('remplace', () => {
    expect(v('remplace("a", "b", "banana")')).toBe('bbnbnb');
  });
  it('formate (sprintf)', () => {
    expect(v('formate("%05.2f", 3.14159)')).toBe('03.14');
    expect(v('formate("%d-%d", 1, 2)')).toBe('1-2');
  });
  it('devise', () => {
    // espace insécable (U+00A0) entre montant et symbole, fidèle au &nbsp; de l'original
    expect(v('devise(1234.5, 2, "€")')).toBe('1 234,50 €');
  });
  it('cle', () => {
    expect(v('cle("a", 12, "b")')).toBe('a.12.b');
  });
});

describe('fonctions — dates', () => {
  it('date(0) = 01-01-1970', () => {
    expect(j('date(0)').value).toBe('01-01-1970');
  });
  it('nbJour', () => {
    expect(v('nbJour(date(0))')).toBe(0);
    expect(v('nbJour("02-01-1970")')).toBe(1);
  });
  it('arithmétique de dates (+ jour, - jours)', () => {
    expect(j('"01-01-1970" + 1').value).toBe('02-01-1970');
    expect(v('"10-01-1970" - "01-01-1970"')).toBe(9);
  });
  it('an / mois / jour sur date littérale', () => {
    expect(v('an("15-06-2020")')).toBe(2020);
    expect(v('mois("15-06-2020")')).toBe(6);
    expect(v('jour("15-06-2020")')).toBe(15);
  });
  it('age', () => {
    expect(v('age("01-01-2000", "01-01-2020")')).toBe(20);
  });
  it('comparaison de dates', () => {
    expect(v('"02-01-1970" > "01-01-1970"')).toBe(1);
    expect(v('"01-01-1970" = "01-01-1970"')).toBe(1);
  });
});

describe('sous-formules [nom] (via fournisseur R4 injecté)', () => {
  const providers = {
    params: {
      loadFormula: (name: string) => (name === 'majoration' ? '10 * 2' : null),
      table: (t: string, k: string) => (t === 'tarif' && k === 'A' ? 100 : null),
      tableInf: () => null,
      tableSup: () => null,
    },
  };
  it('charge et évalue une formule nommée', () => {
    expect(v('[majoration] + 5', { providers })).toBe(25);
  });
  it('formule inconnue -> erreur', () => {
    expect(() => v('[inexistante]', { providers })).toThrow();
  });
  it('fonction table() via fournisseur', () => {
    expect(v('table("tarif", "A") * 2', { providers })).toBe(200);
  });
});

describe('erreurs', () => {
  it('fonction inconnue', () => {
    expect(() => v('foobar(1)')).toThrow(ExpCriticalException);
  });
  it('expression vide -> void', () => {
    expect(j('').type).toBe('void');
    expect(j('   ').type).toBe('void');
  });
  it('commentaires ignorés', () => {
    expect(v('1 + /* commentaire */ 2')).toBe(3);
  });
});

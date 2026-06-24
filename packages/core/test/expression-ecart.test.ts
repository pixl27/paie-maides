/**
 * Tests des écarts comblés du moteur d'expressions (vs mdExpression.php /
 * mdExpressionFonctions.php) : constantes MOIS/AN, fonctions manquantes,
 * symétrie de <>, enregistrement de fonctions applicatives.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  evaluerValeur, registerFunction, unregisterFunction,
} from '../src/expression/index.js';
import { nbr, str } from '../src/expression/value.js';
import type { FormProvider } from '../src/expression/env.js';

const v = (expr: string, opts?: any) => evaluerValeur(expr, opts);

describe('constantes MOIS / AN (déclarées mais non résolues dans l’original)', () => {
  it('MOIS = mois courant, AN = année courante', () => {
    const now = new Date();
    expect(v('MOIS')).toBe(now.getUTCMonth() + 1);
    expect(v('AN')).toBe(now.getUTCFullYear());
  });
  it('utilisables dans une expression', () => {
    expect(v('AN > 2000')).toBe(1);
    expect(v('MOIS >= 1 ET MOIS <= 12')).toBe(1);
  });
});

describe('bissextile (stub vide dans l’original)', () => {
  it('détecte les années bissextiles', () => {
    expect(v('bissextile("29-02-2020")')).toBe(1); // 2020 bissextile
    expect(v('bissextile("01-01-2021")')).toBe(0); // 2021 non
    expect(v('bissextile("01-01-2000")')).toBe(1); // 2000 (÷400)
    expect(v('bissextile("01-01-1900")')).toBe(0); // 1900 (÷100 mais pas ÷400)
  });
});

describe('<> symétrique avec = (corrige une asymétrie de l’original)', () => {
  it('numérique', () => {
    expect(v('2 <> 3')).toBe(1);
    expect(v('2 <> 2')).toBe(0);
  });
  it('dates (ramenées en jours, comme =)', () => {
    // mêmes jours -> égales -> <> faux
    expect(v('"01-01-2020" <> "01-01-2020"')).toBe(0);
    expect(v('"01-01-2020" <> "02-01-2020"')).toBe(1);
  });
  it('cohérent avec = sur chaines numériques', () => {
    expect(v('$a = $b', { variables: { a: '5', b: 5 } })).toBe(1);
    expect(v('$a <> $b', { variables: { a: '5', b: 5 } })).toBe(0);
  });
});

describe('nouveauDoc / estNouveau', () => {
  it('via le fournisseur de formulaire', () => {
    const form = makeForm({ nouveau: true });
    expect(v('nouveauDoc()', { providers: { form } })).toBe(1);
    expect(v('estNouveau()', { providers: { form } })).toBe(1);
  });
  it('repli sur les variables magiques quand pas de formulaire', () => {
    expect(v('nouveauDoc()', { variables: { __nouveau: 1 } })).toBe(1);
    expect(v('nouveauDoc()', { variables: { nouveauDoc: 0 } })).toBe(0);
  });
});

describe('actions sur l’écran (lectureSeule, active/desactive, ajouteJScript, include, loadGo)', () => {
  it('délègue au fournisseur de formulaire', () => {
    const calls: string[] = [];
    const form = makeForm({ log: calls });
    v('lectureSeule("montant")', { providers: { form } });
    v('desactive("remise")', { providers: { form } });
    v('active("remise")', { providers: { form } });
    v('desactiveForm()', { providers: { form } });
    v('ajouteJScript("alert(1)")', { providers: { form } });
    v('loadGo("page2")', { providers: { form } });
    expect(calls).toEqual([
      'lectureSeule:montant', 'desactive:remise:true', 'active:remise',
      'desactiveForm:true', 'js:alert(1)', 'loadGo:page2',
    ]);
  });
  it('include renvoie le HTML du sous-écran', () => {
    const form = makeForm({ inclus: '<b>sous</b>' });
    expect(v('include("entete")', { providers: { form } })).toBe('<b>sous</b>');
  });
});

describe('variableClient', () => {
  it('lit une variable cliente avec repli sur défaut', () => {
    const request = { get: (n: string, d: any) => (n === 'mode' ? 'edition' : d), transferVars: () => null };
    expect(v('variableClient("mode")', { providers: { request } })).toBe('edition');
    expect(v('variableClient("absent", "defaut")', { providers: { request } })).toBe('defaut');
  });
});

describe('tableauRequete', () => {
  const data = {
    aggregate: () => 0,
    query: (_q: string) => [{ nom: 'Dupont', age: 30 }, { nom: 'Martin', age: 25 }],
    loadRecord: () => null,
    documentExists: () => false,
  };
  it('rend un tableau HTML échappé', () => {
    const html = v('tableauRequete("[liste]", "vide", "ma-classe")', { providers: { data } });
    expect(html).toContain('<table class="ma-classe">');
    expect(html).toContain('<th>nom</th>');
    expect(html).toContain('<td>Dupont</td>');
    expect(html).toContain('<td>25</td>');
  });
  it('rend la chaine de repli si aucun résultat', () => {
    const vide = { ...data, query: () => [] as any[] };
    expect(v('tableauRequete("[liste]", "rien")', { providers: { data: vide } })).toBe('rien');
  });
});

describe('registerFunction (port de specifique/expression.php)', () => {
  afterEach(() => {
    unregisterFunction('doubler');
    unregisterFunction('garActive');
  });
  it('permet d’ajouter une fonction applicative', () => {
    registerFunction('doubler', (_e, [x]) => nbr(Number(x?.value) * 2));
    expect(v('doubler(21)')).toBe(42);
    expect(v('doubler(21) + 1')).toBe(43);
  });
  it('la fonction applicative voit le moteur (variables, providers)', () => {
    registerFunction('garActive', (engine, [n]) => {
      const sel = engine.variables['garsel'] as string[];
      return str(sel?.[Number(n?.value) - 1] === 'O' ? 'O' : 'N');
    });
    const opts = { variables: { garsel: ['O', 'N', 'O'] } };
    expect(v('garActive(1)', opts)).toBe('O');
    expect(v('garActive(2)', opts)).toBe('N');
  });
});

/* ----------------------------- helpers ----------------------------- */

function makeForm(o: { nouveau?: boolean; log?: string[]; inclus?: string }): FormProvider {
  const log = o.log ?? [];
  return {
    nouveauDoc: () => !!o.nouveau,
    lectureSeule: (w) => { log.push(`lectureSeule:${w}`); },
    active: (w) => { log.push(`active:${w}`); },
    desactive: (w, hard) => { log.push(`desactive:${w}:${hard}`); },
    desactiveForm: (s) => { log.push(`desactiveForm:${s}`); },
    ajouteJScript: (s) => { log.push(`js:${s}`); },
    include: () => o.inclus ?? '',
    loadGo: (p) => { log.push(`loadGo:${p}`); },
  };
}

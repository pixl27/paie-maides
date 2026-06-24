/**
 * Tests de fidélité des expressions (corrections du ré-audit) :
 * min/max lexicographique, variableClient sans exception, devise() à défauts.
 */
import { describe, it, expect } from 'vitest';
import { evaluerValeur } from '../src/expression/index.js';

const v = (expr: string, opts?: any) => evaluerValeur(expr, opts);

describe('min / max', () => {
  it('numérique quand tous les arguments sont numériques', () => {
    expect(v('min(3, 1, 2)')).toBe(1);
    expect(v('max(3, 1, 2)')).toBe(3);
  });
  it('lexicographique sur des chaînes (port de min()/max() PHP)', () => {
    expect(v('max("a", "z", "m")')).toBe('z');
    expect(v('min("z", "a", "m")')).toBe('a');
  });
});

describe('variableClient — ne lève jamais (port de REQUESTGET)', () => {
  const request = { get: (n: string) => (n === 'mode' ? 'edition' : undefined), transferVars: () => null };
  it('renvoie la valeur présente', () => {
    expect(v('variableClient("mode")', { providers: { request } })).toBe('edition');
  });
  it('renvoie la chaine vide si absente et sans défaut (pas d’exception)', () => {
    expect(v('variableClient("absent")', { providers: { request } })).toBe('');
  });
  it('renvoie le défaut si absente', () => {
    expect(v('variableClient("absent", "X")', { providers: { request } })).toBe('X');
  });
  it('sans fournisseur request : défaut / chaine vide', () => {
    expect(v('variableClient("x")')).toBe('');
    expect(v('variableClient("x", "def")')).toBe('def');
  });
});

describe('devise — défauts injectables (DEVISE_DECIMAL / DEVISE_SYMBOLE)', () => {
  it('utilise les défauts du contexte quand les arguments sont omis', () => {
    const out = v('devise(1234.5)', { devise: { decimal: 2, symbole: '€' } });
    expect(out).toContain('€');
    expect(out).toMatch(/1\s234,50/);
  });
  it('défaut neutre (2 décimales, sans symbole) sans contexte', () => {
    expect(v('devise(10)')).toMatch(/10,00/);
  });
  it('les arguments explicites priment', () => {
    expect(v('devise(10, 0, "$")', { devise: { decimal: 2, symbole: '€' } })).toContain('$');
  });
});

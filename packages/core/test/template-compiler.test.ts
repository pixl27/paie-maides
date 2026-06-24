/**
 * Tests du compilateur de gabarit @ (port de compilateurTemplate.php).
 */
import { describe, it, expect } from 'vitest';
import { compileTemplate } from '../src/rendering/template-compiler.js';

const c = (tpl: string, ctx?: any) => compileTemplate(tpl, ctx);
/** Retire l'enveloppe d'affichage <span class="arob affRO"> pour lisibilité. */
const strip = (s: string) => s.replace(/<span class="arob affRO">/g, '').replace(/<\/span>/g, '');

describe('@si / @sinonsi / @sinon / @finsi', () => {
  it('branche vraie', () => {
    expect(c('@si($x > 5)grand@finsi', { variables: { x: 10 } })).toBe('grand');
    expect(c('@si($x > 5)grand@finsi', { variables: { x: 2 } })).toBe('');
  });
  it('sinon', () => {
    const tpl = '@si($x > 5)grand@sinon<br/>petit@finsi';
    expect(c(tpl, { variables: { x: 10 } })).toBe('grand');
    expect(c(tpl, { variables: { x: 2 } })).toBe('petit');
  });
  it('sinonsi en cascade (seule la branche prise est évaluée)', () => {
    const tpl = '@si($x = 1)un@sinonsi($x = 2)deux@sinon<br/>autre@finsi';
    expect(c(tpl, { variables: { x: 1 } })).toBe('un');
    expect(c(tpl, { variables: { x: 2 } })).toBe('deux');
    expect(c(tpl, { variables: { x: 9 } })).toBe('autre');
  });
  it('condition avec entités échappées (&gt;)', () => {
    expect(c('@si($x &gt; 5)ok@finsi', { variables: { x: 10 } })).toBe('ok');
  });
  it('imbrication @si dans @si', () => {
    const tpl = '@si($a)A@si($b)B@finsi@finsi';
    expect(c(tpl, { variables: { a: 1, b: 1 } })).toBe('AB');
    expect(c(tpl, { variables: { a: 1, b: 0 } })).toBe('A');
    expect(c(tpl, { variables: { a: 0, b: 1 } })).toBe('');
  });
});

describe('@pour / @finpour', () => {
  it('boucle croissante, variable accessible', () => {
    expect(strip(c('@pour($i de 1 a 3)@($i)-@finpour'))).toBe('1-2-3-');
  });
  it('boucle décroissante (sens auto)', () => {
    expect(strip(c('@pour($i de 3 a 1)@($i)@finpour'))).toBe('321');
  });
  it('combine avec @si à l’intérieur', () => {
    expect(strip(c('@pour($i de 1 a 4)@si($i ~~ "2 4")@($i)@finsi@finpour'))).toBe('24');
  });
});

describe('@(expr) affichage et @[expr] silencieux', () => {
  it('@(expr) affiche dans un span', () => {
    expect(c('@(2 + 3)')).toBe('<span class="arob affRO">5</span>');
  });
  it('@(expr) tableau/void n’affiche rien', () => {
    expect(c('@[$x := 5]@(VOID)')).toBe('');
  });
  it('@[expr] exécute sans afficher (affectation visible ensuite)', () => {
    expect(c('@[$t := 7]@($t + 1)')).toBe('<span class="arob affRO">8</span>');
  });
  it('@(devise(...)) conserve le HTML (non échappé)', () => {
    const out = c('@(devise(1234.5, 2, "€"))');
    expect(out).toContain('1 234,50');
    expect(out).toContain('€');
  });
});

describe('@variable', () => {
  it('scalaire', () => {
    expect(c('Bonjour @nom', { variables: { nom: 'Alice' } }))
      .toBe('Bonjour <span class="arob affRO">Alice</span>');
  });
  it('date formatée JJ/MM/AAAA', () => {
    expect(c('@d', { variables: { d: '2020-06-15' }, champs: { d: { type_champ: 'date' } } }))
      .toBe('<span class="arob affRO">15/06/2020</span>');
  });
  it('variable inconnue -> span vide + message', () => {
    expect(c('@absent')).toBe('<span class="arob affRO"></span>');
  });
  it('tableau indicé', () => {
    expect(c('@t[1]', { variables: { t: ['a', 'b', 'c'] } }))
      .toBe('<span class="arob affRO">b</span>');
  });
  it('tableau sans indice -> erreur', () => {
    expect(c('@t', { variables: { t: ['a'] } })).toContain('Variable tableau sans indice');
  });
});

describe('directives spéciales', () => {
  it('@sautPage', () => {
    expect(c('a@sautPage<br/>b')).toBe('a</page><page>b');
  });
  it('@page et @pageTotale', () => {
    expect(c('@page / @pageTotale')).toBe('[[page_cu]] / [[page_nb]]');
  });
  it('@date et @heure (format)', () => {
    expect(c('@date')).toMatch(/<span class="arob affRO">\d{2}\/\d{2}\/\d{4}<\/span>/);
    expect(c('@heure')).toMatch(/<span class="arob affRO">\d{2}:\d{2}<\/span>/);
  });
  it('commentaires supprimés', () => {
    expect(c('a/* commentaire */b')).toBe('ab');
  });
});

describe('sécurité', () => {
  it('rejette toute injection PHP', () => {
    expect(() => c('<?php echo 1; ?>')).toThrow(/injection/);
    expect(() => c('a<? b')).toThrow(/injection/);
    expect(() => c('a ?> b')).toThrow(/injection/);
  });
});

describe('texte sans directive', () => {
  it('laissé intact', () => {
    expect(c('<p>Bonjour le monde</p>')).toBe('<p>Bonjour le monde</p>');
  });
  it('@ littéral non suivi de directive', () => {
    expect(c('prix @ 5')).toBe('prix @ 5');
  });
});

import { describe, it, expect } from 'vitest';
import { renderWidget, renderEcran, enregistreWidget } from '../src/rendering/index.js';
import type { Zzz } from '../src/runtime/index.js';

function zzzFactice(overrides: Partial<Zzz> = {}): Zzz {
  return {
    e: 'test', o: 8, patEcran: 'scr', cle: ['1'], ficMaitre: 'facture',
    champs: {}, valeurs: {}, champsExtra: {}, valeursExtra: {},
    nouveauDoc: false, erreurBloquante: false, messages: [],
    ...overrides,
  };
}

describe('rendu des widgets', () => {
  it('texte avec valeur et libellé', () => {
    const html = renderWidget({ nomChamp: 'client', widget: { type_widget: 'text', libelle: 'Client' }, valeur: 'ACME' });
    expect(html).toContain('<input');
    expect(html).toContain('name="client"');
    expect(html).toContain('value="ACME"');
    expect(html).toContain('<label for="client">Client</label>');
  });
  it('échappe les valeurs (anti-injection)', () => {
    const html = renderWidget({ nomChamp: 'x', widget: { type_widget: 'text' }, valeur: '<script>"&' });
    expect(html).toContain('value="&lt;script&gt;&quot;&amp;"');
    expect(html).not.toContain('<script>');
  });
  it('lecture seule', () => {
    const html = renderWidget({ nomChamp: 'total', widget: { type_widget: 'decimal', est_lecture_seule: 1 }, valeur: 300 });
    expect(html).toContain('readonly');
  });
  it('select avec options', () => {
    const html = renderWidget({
      nomChamp: 'type', valeur: 'B',
      widget: { type_widget: 'select', options: [{ value: 'A', libelle: 'Auto' }, { value: 'B', libelle: 'Habitation' }] },
    });
    expect(html).toContain('<select');
    expect(html).toContain('<option value="B" selected>Habitation</option>');
  });
  it('messages d’erreur de validation', () => {
    const html = renderWidget({ nomChamp: 'qte', widget: { type_widget: 'integer' }, valeur: 0, erreurs: ['Obligatoire'] });
    expect(html).toContain('md-erreur');
    expect(html).toContain('Obligatoire');
  });
});

describe('rendu d’écran via gabarit', () => {
  const zzz = zzzFactice({
    champs: {
      client: { type_widget: 'text', libelle: 'Client' },
      total: { type_widget: 'decimal', est_lecture_seule: 1 },
    },
    valeurs: { client: 'ACME', total: 300 },
  });

  it('mode formulaire : placeholders -> widgets + champs cachés de contexte', () => {
    zzz.ecran = { nom_ecran: 'test', template: 'Client: $client Total: $total', champs: zzz.champs };
    const html = renderEcran(zzz, { mode: 'form' });
    expect(html).toContain('<form');
    expect(html).toContain('name="b"');
    expect(html).toContain('name="client"');
    expect(html).toContain('value="ACME"');
    expect(html).toContain('value="300"');
  });

  it('mode document (lettre) : substitution de valeurs', () => {
    const lettre = zzzFactice({
      patEcran: 'let',
      champs: { client: { type_widget: 'text' } },
      valeurs: { client: 'ACME', montant: '1 234,50 €' },
      ecran: { nom_ecran: 'courrier', template: 'Cher $client, vous devez $montant.', champs: { client: {} } },
    });
    const html = renderEcran(lettre);
    expect(html).toBe('Cher ACME, vous devez 1 234,50 €.');
  });
});

describe('catalogue de widgets étendu', () => {
  const w = (type_widget: string, valeur: any, widget: any = {}) =>
    renderWidget({ nomChamp: 'c', widget: { type_widget, ...widget }, valeur });

  it('saisies typées (password, email, color, range, time, datetime)', () => {
    expect(w('password', 'x')).toContain('type="password"');
    expect(w('email', 'a@b.fr')).toContain('type="email"');
    expect(w('color', '#fff')).toContain('type="color"');
    expect(w('range', 5, { val_min: 0, val_max: 10 })).toContain('type="range"');
    expect(w('time', '10:00')).toContain('type="time"');
    expect(w('datetime', '')).toContain('type="datetime-local"');
  });
  it('montant en lecture seule : formaté', () => {
    expect(w('montant', 1234.5, { est_lecture_seule: 1, devise: '€' })).toContain('234');
  });
  it('radio / multiselect / checkboxGroup depuis options', () => {
    const opts = { options: [{ value: 'a', libelle: 'A' }, { value: 'b', libelle: 'B' }] };
    expect(w('radio', 'b', opts)).toContain('type="radio"');
    expect(w('multiselect', ['a'], opts)).toContain('<select multiple');
    expect(w('checkboxGroup', ['a'], opts)).toContain('type="checkbox"');
  });
  it('titre, séparateur, lien', () => {
    expect(w('titre', '', { libelle: 'Section' })).toContain('<h3');
    expect(w('separateur', '')).toContain('<hr');
    expect(w('lien', 'https://x.fr', { libelle: 'Voir' })).toContain('href="https://x.fr"');
  });
});

describe('extensibilité du rendu', () => {
  it('on peut enregistrer un nouveau type de widget', () => {
    enregistreWidget('etoiles', (ctx) => `<span class="etoiles">${'★'.repeat(Number(ctx.valeur) || 0)}</span>`);
    const html = renderWidget({ nomChamp: 'note', widget: { type_widget: 'etoiles' }, valeur: 3 });
    expect(html).toContain('★★★');
  });
});

/** Tests du widget arbre et de la suite scanner (catalogue de widgets). */
import { describe, it, expect } from 'vitest';
import { getWidgetRenderer, typesWidgetsSupportes } from '../src/rendering/widgets.js';

function ctrl(type: string, opts: { valeur?: any; widget?: any; lectureSeule?: boolean } = {}): string {
  return getWidgetRenderer(type)({
    nomChamp: 'champ', widget: { type_widget: type, ...(opts.widget ?? {}) },
    valeur: opts.valeur, lectureSeule: opts.lectureSeule,
  });
}

describe('catalogue : arbre + suite scanner enregistrés', () => {
  it('types présents', () => {
    const types = typesWidgetsSupportes();
    for (const t of ['arbre', 'scanInit', 'scanScan', 'scanScanUpload', 'scanUpload', 'scanSave',
      'scanEdit', 'scanFileUpload', 'scanSelectSource', 'scanSetDuplex', 'scanSetAutoFeed']) {
      expect(types, `manque ${t}`).toContain(t);
    }
  });
});

describe('widget arbre', () => {
  it('rend une hiérarchie récursive', () => {
    const h = ctrl('arbre', { valeur: [
      { id: 'a', label: 'Racine A', enfants: [{ id: 'a1', label: 'Feuille A1' }] },
      { id: 'b', label: 'Racine B' },
    ] });
    expect(h).toContain('class="md-arbre"');
    expect(h).toContain('Racine A');
    expect(h).toContain('Feuille A1');
    expect(h).toContain('data-cle="a1"');
    // imbrication : un <ul> enfant sous A
    expect(h).toMatch(/Racine A<\/span><ul>.*Feuille A1/s);
  });
  it('arbre vide', () => {
    expect(ctrl('arbre', { valeur: [] })).toContain('<ul></ul>');
  });
});

describe('suite scanner', () => {
  it('scanInit (vide) propose un téléversement de fichier (équivalent natif de l’acquisition)', () => {
    const h = ctrl('scanInit', { widget: { option_type_widget: 'largeur=440\ntable=adr' } });
    expect(h).toContain('md-upload');
    expect(h).toContain('md-upload-input');
    expect(h).toContain('md-upload-btn');
  });
  it('scanInit affiche le document si présent', () => {
    const h = ctrl('scanInit', { valeur: 'doc.pdf', widget: { format: 'pdf', option_type_widget: 'table=adr' } });
    expect(h).toContain('<embed'); // délégué à zoneDoc/zonePDF
  });
  it('scanFileUpload rend un input file', () => {
    const h = ctrl('scanFileUpload', { widget: { option_type_widget: 'champ=fichier' } });
    expect(h).toContain('type="file"');
    expect(h).toContain('data-scan="fileUpload"');
    expect(h).toContain('data-champ="fichier"');
  });
  it('widgets scanner vides en lecture seule (sauf affichage)', () => {
    expect(ctrl('scanScan', { lectureSeule: true })).toBe('');
    expect(ctrl('scanSelectSource', { lectureSeule: true })).toBe('');
  });
  it('scanSelectSource / duplex / autoFeed', () => {
    expect(ctrl('scanSelectSource')).toContain('data-scan="selectSource"');
    expect(ctrl('scanSetDuplex')).toContain('data-scan="duplex"');
    expect(ctrl('scanSetAutoFeed')).toContain('data-scan="autoFeed"');
  });
});

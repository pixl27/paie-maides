/**
 * Tests du catalogue de widgets complété (port de jyWidget.php) : widgets liés
 * aux données, documents, éditeurs riches, sous-écrans, quérabilité.
 */
import { describe, it, expect } from 'vitest';
import {
  renderWidget, getWidgetRenderer, typesWidgetsSupportes, type WidgetDataAcces,
} from '../src/rendering/widgets.js';

/** Rend le contrôle nu d'un widget (sans l'enveloppe libellé/erreurs). */
function ctrl(type: string, opts: { valeur?: any; widget?: any; acces?: WidgetDataAcces; lectureSeule?: boolean; cle?: string } = {}): string {
  return getWidgetRenderer(type)({
    nomChamp: 'champ',
    widget: { type_widget: type, ...(opts.widget ?? {}) },
    valeur: opts.valeur,
    acces: opts.acces,
    lectureSeule: opts.lectureSeule,
    cle: opts.cle,
  });
}

const acces: WidgetDataAcces = {
  lireTable: (t) => (t === 'civ' ? [{ cle: 'M', libelle: 'Monsieur' }, { cle: 'F', libelle: 'Madame' }] : []),
  lireFic: (s) => (s.table === 'pays' ? [{ value: 'FR', libelle: 'France' }, { value: 'BE', libelle: 'Belgique' }] : []),
  lignes: (s) => (s.table ? [{ __cle__: '1', nom: 'Dupont', ville: 'Paris' }, { __cle__: '2', nom: 'Martin', ville: 'Lyon' }] : []),
  aggregate: () => 1234,
  champsDe: () => ['con_1', 'con_2'],
  rendSousEcran: (e, v) => `<i>${e}:${v['nom'] ?? ''}</i>`,
  urlDocument: (t, c, ch) => `/doc/${t}/${c}/${ch}`,
};

describe('catalogue : tous les types attendus sont enregistrés', () => {
  it('liste des types', () => {
    const types = typesWidgetsSupportes();
    for (const t of [
      'selectTable', 'selectFic', 'selectAggregate', 'recordList', 'selectList',
      'arrayList', 'dataReport', 'editableArray', 'sousEcranMulti', 'querabilitePopup',
      'querabiliteList', 'ordreCle', 'ordreClePar', 'autoInc', 'listeVariables',
      'currency', 'display', 'textZone', 'hiddenData', 'iFrame', 'CKEditor',
      'codeEditor', 'zoneDoc', 'zonePDF', 'zoneImg', 'execScreen',
    ]) {
      expect(types, `manque ${t}`).toContain(t);
    }
  });
});

describe('widgets d’affichage / spéciaux', () => {
  it('display', () => expect(ctrl('display', { valeur: 'Bonjour' })).toContain('Bonjour'));
  it('textZone (option contenu)', () => {
    expect(ctrl('textZone', { widget: { option_type_widget: 'contenu=Mention légale' } })).toContain('Mention légale');
  });
  it('autoInc', () => expect(ctrl('autoInc', { valeur: 42 })).toContain('42'));
  it('hiddenData (span + input caché)', () => {
    const h = ctrl('hiddenData', { valeur: 'V' });
    expect(h).toContain('type="hidden"');
    expect(h).toContain('champ_lib');
  });
  it('currency (lecture seule formatée + symbole)', () => {
    const h = ctrl('currency', { valeur: 1234.5, lectureSeule: true, widget: { option_type_widget: 'symbole=€' } });
    expect(h).toContain('€');
    expect(h).toMatch(/1\s234,50/);
  });
  it('iFrame', () => expect(ctrl('iFrame', { widget: { url: 'https://x' } })).toContain('<iframe'));
});

describe('éditeurs riches', () => {
  it('CKEditor', () => expect(ctrl('CKEditor', { valeur: '<p>x</p>' })).toContain('md-ckeditor'));
  it('codeEditor (mode)', () => expect(ctrl('codeEditor', { widget: { option_type_widget: 'mode=javascript' } })).toContain('md-codeeditor'));
});

describe('selects liés aux données', () => {
  it('selectTable (table de paramètres)', () => {
    const h = ctrl('selectTable', { valeur: 'F', widget: { option_type_widget: 'table=civ' }, acces });
    expect(h).toContain('M - Monsieur');
    expect(h).toContain('<option value="F" selected>F - Madame</option>');
  });
  it('selectFic (table/vue)', () => {
    const h = ctrl('selectFic', { valeur: 'BE', widget: { option_type_widget: 'table=pays\ncle=code' }, acces });
    expect(h).toContain('France');
    expect(h).toContain('<option value="BE" selected>Belgique</option>');
  });
  it('selectFic editable -> datalist', () => {
    const h = ctrl('selectFic', { widget: { option_type_widget: 'table=pays\ncle=code\neditable=1' }, acces });
    expect(h).toContain('<datalist');
    expect(h).toContain('list="champ_list"');
  });
  it('selectAggregate', () => {
    const h = ctrl('selectAggregate', { widget: { option_type_widget: 'operation=somme\ntable=pai\nchamp=montant' }, acces });
    expect(h).toContain('1234');
  });
  it('listeVariables', () => {
    const h = ctrl('listeVariables', { widget: { option_type_widget: 'table=con' }, acces });
    expect(h).toContain('data-variables="con_1,con_2"');
  });
});

describe('listes / tableaux liés', () => {
  it('recordList rend une table avec lien d’ouverture', () => {
    const h = ctrl('recordList', { widget: { option_type_widget: 'index=vue_adr\ncols=nom:Nom;ville:Ville\necran=aax_adr' }, acces });
    expect(h).toContain('record-list');
    expect(h).toContain('<th>Nom</th>');
    expect(h).toContain('Dupont');
    expect(h).toContain("goPage('?o=1&amp;e=aax_adr&amp;b=1')");
  });
  it('arrayList depuis un tableau mémoire', () => {
    const h = ctrl('arrayList', { valeur: [{ a: 1, b: 2 }], widget: {} });
    expect(h).toContain('record-list array');
  });
  it('editableArray rend des inputs éditables nommés _ml_', () => {
    const h = ctrl('editableArray', { widget: { option_type_widget: 'secran=ligne_pai\ncols=nom:Nom' }, acces });
    expect(h).toContain('editable-record-list');
    expect(h).toContain('name="_ml_nom[1]"');
    expect(h).toContain('data-eaf="1"');             // champ éditable identifiable
    expect(h).toContain('data-name="nom"');          // collecte par nom de colonne
    expect(h).toContain('data-e="ligne_pai"');       // sous-écran cible de la ligne
    expect(h).toContain('data-template="insert"');   // ligne-modèle pour l'ajout
    expect(h).toContain('name="__insert__nom"');     // champs de la ligne-modèle
    expect(h).toContain('md-ea-add');                // bouton « Ajouter une ligne »
    expect(h).toContain('md-ea-suppr');              // bouton suppression de ligne
  });
  it('editableArray en lecture seule : pas de boutons ni de data-eaf', () => {
    const h = ctrl('editableArray', { lectureSeule: true, widget: { option_type_widget: 'secran=ligne_pai\ncols=nom:Nom' }, acces });
    expect(h).not.toContain('data-eaf');
    expect(h).not.toContain('md-ea-add');
  });
  it('sousEcranMulti rend un sous-écran par ligne', () => {
    const h = ctrl('sousEcranMulti', { widget: { option_type_widget: 'secran=bloc' }, acces });
    expect(h).toContain('secran-multi-container');
    expect(h).toContain('bloc:Dupont');
  });
});

describe('quérabilité & clés', () => {
  it('querabilitePopup (input + bouton + data)', () => {
    const h = ctrl('querabilitePopup', { widget: { option_type_widget: 'table=adr\ncle=adr_1\nretour=con_1' }, acces });
    expect(h).toContain('querabilite-popup');
    expect(h).toContain('data-table="adr"');
    expect(h).toContain('data-retour="con_1"');
    expect(h).toContain('data-cible="champ"'); // le bouton sait quel champ remplir
  });
  it('ordreCle', () => expect(ctrl('ordreCle', { valeur: '5' })).toContain('data-ordre-cle="1"'));
});

describe('documents / sous-écran', () => {
  it('zonePDF (embed via urlDocument)', () => {
    const h = ctrl('zonePDF', { valeur: 'doc.pdf', cle: '4000', widget: { option_type_widget: 'table=adr' }, acces });
    expect(h).toContain('<embed');
    expect(h).toContain('/doc/adr/4000/champ');
  });
  it('zonePDF vide', () => expect(ctrl('zonePDF', { valeur: '' })).toContain('Aucun document'));
  it('zoneDoc image -> img', () => {
    const h = ctrl('zoneDoc', { valeur: 'photo.jpg', cle: '4000', widget: { format: '', option_type_widget: 'table=adr' }, acces });
    expect(h).toContain('<img');
  });
  it('execScreen injecte le sous-écran', () => {
    const h = ctrl('execScreen', { valeur: { nom: 'Z' }, widget: { option_type_widget: 'secran=detail' }, acces });
    expect(h).toContain('detail:Z');
  });
  it('scanInit (vide) propose un téléversement de fichier ; (rempli) affiche le doc', () => {
    const vide = ctrl('scanInit', { valeur: '', cle: '4000', widget: { option_type_widget: 'table=adr' }, acces });
    expect(vide).toContain('md-upload');
    expect(vide).toContain('md-upload-input');
    expect(vide).toContain('data-table="adr"');
    const plein = ctrl('scanInit', { valeur: 'scan.pdf', cle: '4000', widget: { option_type_widget: 'table=adr' }, acces });
    expect(plein).toContain('<embed');
  });
});

describe('enveloppe renderWidget', () => {
  it('ajoute libellé et messages d’erreur', () => {
    const h = renderWidget({ nomChamp: 'montant', widget: { type_widget: 'currency', libelle: 'Montant' }, valeur: 10, erreurs: ['obligatoire'], acces });
    expect(h).toContain('<label for="montant">Montant</label>');
    expect(h).toContain('md-erreur');
  });
});

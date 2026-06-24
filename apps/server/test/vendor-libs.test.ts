import { describe, it, expect } from 'vitest';
import { renderPage } from '../src/page.js';

describe('intégration des bibliothèques d’origine (vendor)', () => {
  it('charge jQuery / jQuery UI sur les pages applicatives', () => {
    const h = renderPage('X', '<p>x</p>', [], { user: 'u' });
    expect(h).toContain('/vendor/jquery.js');
    expect(h).toContain('/vendor/jquery-ui.js');
    expect(h).toContain('/vendor/jquery-ui.css');
  });

  it('ne charge pas les libs lourdes (CKEditor/CodeMirror/jstree) par défaut', () => {
    const h = renderPage('X', '<p>x</p>', [], { user: 'u' });
    expect(h).not.toContain('/vendor/ckeditor');
    expect(h).not.toContain('/vendor/codemirror');
    expect(h).not.toContain('/vendor/jstree');
  });

  it('charge CKEditor / CodeMirror / jstree quand l’écran les utilise', () => {
    const h = renderPage('X', '<p>x</p>', [], { user: 'u', libs: { ck: true, cm: true, tree: true } });
    expect(h).toContain('/vendor/ckeditor/ckeditor.js');
    expect(h).toContain('/vendor/codemirror/codemirror.js');
    expect(h).toContain('/vendor/jstree.min.js');
    expect(h).toContain('/vendor/jstree/default/style.min.css');
  });

  it('page de connexion : aucune bibliothèque vendor', () => {
    const h = renderPage('X', '<p>x</p>', [], { hideNav: true });
    expect(h).not.toContain('/vendor/');
  });
});

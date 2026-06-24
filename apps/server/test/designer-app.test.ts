import { describe, it, expect, beforeEach } from 'vitest';
import { creerAppDemo } from '../src/demo.js';
import type { MaidesApp } from '../src/app.js';
import type { UserInfo } from '@maides/core';

const ADMIN: UserInfo = { login: 'admin', superAdmin: true, niveau: 0 };
const USER: UserInfo = { login: 'u', superAdmin: false, niveau: 3 };

describe('designer visuel — construire une appli dans le navigateur', () => {
  let app: MaidesApp;
  beforeEach(() => { app = creerAppDemo(); });

  it('accueil du designer (super-admin) : liste tables/écrans + formulaires', () => {
    const r = app.handle({ method: 'GET', ecran: 'designer', query: {}, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.body).toContain('Créer la table');
    expect(r.body).toContain('factureSaisie'); // écran existant listé
  });

  it('réservé aux super-administrateurs', () => {
    const r = app.handle({ method: 'GET', ecran: 'designer', query: {}, user: USER });
    expect(r.status).toBe(403);
  });

  it('flux complet : créer table + champs + écran + widgets, puis LANCER l’appli', () => {
    // 1) créer la table
    let r = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'creerTable', nomTable: 'produit', emplacement: 'D' } });
    expect(r.status).toBe(302);

    // 2) champs (dont la clé)
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'ajouteChamp', table: 'produit', nom_champ: 'ref', type_champ: 'string', est_cle: '1' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'ajouteChamp', table: 'produit', nom_champ: 'qte', type_champ: 'integer' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'ajouteChamp', table: 'produit', nom_champ: 'pu', type_champ: 'decimal' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'ajouteChamp', table: 'produit', nom_champ: 'total', type_champ: 'decimal' } });

    // la table montre ses champs + la clé
    r = app.handle({ method: 'GET', ecran: 'designer', query: { table: 'produit' }, user: ADMIN });
    expect(r.body).toContain('ref');
    expect(r.body).toContain('🔑'); // clé marquée

    // 3) créer l'écran
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'creerEcran', nom: 'produitSaisie', table_liee: 'produit', template: '$ref $qte $pu $total' } });

    // 4) placer les widgets (dont un champ calculé)
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'placeWidget', ecran: 'produitSaisie', nom_champ: 'ref', type_widget: 'text', est_notnull: '1' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'placeWidget', ecran: 'produitSaisie', nom_champ: 'qte', type_widget: 'integer' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'placeWidget', ecran: 'produitSaisie', nom_champ: 'pu', type_widget: 'decimal' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'placeWidget', ecran: 'produitSaisie', nom_champ: 'total', type_widget: 'decimal', formule_calcul: '$qte * $pu' } });

    // 5) LANCER l'écran conçu (édition)
    r = app.handle({ method: 'GET', ecran: 'produitSaisie', query: { o: '8', b: 'A1' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.body).toContain('name="ref"');
    expect(r.body).toContain('name="qte"');

    // 6) sauvegarder via l'appli conçue : la formule calcule le total
    r = app.handle({ method: 'POST', ecran: 'produitSaisie', query: {}, user: ADMIN, body: { o: '9', b: 'A1', ref: 'A1', qte: '6', pu: '10' } });
    expect(r.body).toContain('sauvegardé');
    expect(r.body).toContain('value="60"');
  });

  it('modifier un champ existant : type + renommage + clé (comme pStructurePopup)', () => {
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'creerTable', nomTable: 'cli', emplacement: 'D' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'ajouteChamp', table: 'cli', nom_champ: 'code', type_champ: 'string' } });

    // le clic « ✎ » ouvre un formulaire d'édition pré-rempli
    const edit = app.handle({ method: 'GET', ecran: 'designer', query: { table: 'cli', champ: 'code' }, user: ADMIN });
    expect(edit.body).toContain('value="modifChamp"');
    expect(edit.body).toContain('value="code"');

    // modifie : renomme code -> ref, type integer, devient clé
    const r = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'modifChamp', table: 'cli', ancien_nom: 'code', nom_champ: 'ref', type_champ: 'integer', est_cle: '1' } });
    expect(r.status).toBe(302);

    const v = app.handle({ method: 'GET', ecran: 'designer', query: { table: 'cli' }, user: ADMIN });
    expect(v.body).toContain('ref');           // nouveau nom présent
    expect(v.body).not.toContain('>code<');    // ancien nom disparu
    expect(v.body).toContain('integer');       // type modifié
    expect(v.body).toContain('🔑');            // ref est désormais clé
  });

  it('éditer un widget posé : libellé + ordre de focus (pOrdreFocus)', () => {
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'modifieWidget', ecran: 'factureSaisie', nom_champ: 'client', libelle: 'Client X', tabindex: '3' } });
    const e = app.handle({ method: 'GET', ecran: 'designer', query: { ecran: 'factureSaisie', widget: 'client' }, user: ADMIN });
    expect(e.body).toContain('value="modifieWidget"');
    expect(e.body).toContain('value="Client X"');
    expect(e.body).toContain('value="3"'); // tabindex pré-rempli
  });

  it('structure table : cloner et supprimer (pStructure)', () => {
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'creerTable', nomTable: 'src', emplacement: 'D' } });
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'ajouteChamp', table: 'src', nom_champ: 'id', type_champ: 'string', est_cle: '1' } });
    const clone = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'cloneTable', table: 'src', cible: 'src2' } });
    expect(clone.status).toBe(302);
    expect(app.handle({ method: 'GET', ecran: 'designer', query: { table: 'src2' }, user: ADMIN }).body).toContain('id');
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'supprimeTable', table: 'src' } });
    const apres = app.handle({ method: 'GET', ecran: 'designer', query: { table: 'src' }, user: ADMIN });
    expect(apres.body).toMatch(/erreur|introuvable/i); // table supprimée
  });

  it('séquences d’écrans (o6/o7) : définir + lister', () => {
    const r = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defSequence', nom: 'saisie', ecrans: 'factureSaisie, autreEcran' } });
    expect(r.status).toBe(302);
    const v = app.handle({ method: 'GET', ecran: 'designer', query: { config: 'sequence' }, user: ADMIN });
    expect(v.body).toContain('saisie');
    expect(v.body).toContain('factureSaisie');
  });

  it('requetteur : SELECT validé accepté, requête d’écriture refusée', () => {
    const ok = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defRequete', nom: 'q1', sql: 'SELECT * FROM facture' } });
    expect(ok.status).toBe(302);
    expect(app.handle({ method: 'GET', ecran: 'designer', query: { config: 'requete' }, user: ADMIN }).body).toContain('q1');
    const ko = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defRequete', nom: 'q2', sql: 'DELETE FROM facture' } });
    expect(ko.body).toMatch(/refus/i);
  });

  it('grille des droits (pDroitTable) : matrice champs × niveaux', () => {
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defDroit', table: 'facture', champ: 'client', niveau: '3', valeur: 'L' } });
    const g = app.handle({ method: 'GET', ecran: 'designer', query: { config: 'droit', dt: 'facture' }, user: ADMIN });
    expect(g.body).toContain('client'); // ligne du champ
    expect(g.body).toContain('N3');     // colonne niveau 3
  });

  it('paramétrage : définir une vue (o_genererVue) puis la lister', () => {
    const r = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defVue', nom_vue: 'impayes', patron: 'facture', cle: 'num', conditions: 'total > 0', champs: 'num,client' } });
    expect(r.status).toBe(302);
    const v = app.handle({ method: 'GET', ecran: 'designer', query: { config: 'vue' }, user: ADMIN });
    expect(v.body).toContain('impayes');
    expect(v.body).toContain('facture');
  });

  it('paramétrage : landing + création d’une entrée de menu persistée', () => {
    const r0 = app.handle({ method: 'GET', ecran: 'designer', query: { config: '' }, user: ADMIN });
    expect(r0.body).toContain('Paramétrage');
    expect(r0.body).toContain('Formules nommées');

    // créer une entrée de menu
    const rp = app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defMenu', menu_position: 'z110', menu_libelle: 'Vues', menu_script: '?o=1&e=azxVue', menu_droit: '0' } });
    expect(rp.status).toBe(302);
    // elle apparaît dans la vue menus
    const rm = app.handle({ method: 'GET', ecran: 'designer', query: { config: 'menu' }, user: ADMIN });
    expect(rm.body).toContain('z110');
    expect(rm.body).toContain('Vues');

    // formule nommée
    app.handle({ method: 'POST', ecran: 'designer', query: {}, user: ADMIN, body: { action: 'defFormule', nom: 'majoration', corps: '10 * 2' } });
    const rf = app.handle({ method: 'GET', ecran: 'designer', query: { config: 'formule' }, user: ADMIN });
    expect(rf.body).toContain('majoration');
  });
});

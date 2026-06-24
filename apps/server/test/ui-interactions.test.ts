import { describe, it, expect, beforeEach } from 'vitest';
import { creerAppDemo } from '../src/demo.js';
import type { MaidesApp } from '../src/app.js';
import type { UserInfo } from '@maides/core';

const ADMIN: UserInfo = { login: 'admin', superAdmin: true, niveau: 0 };

/** Crée une facture (ACME) pour avoir des données à rechercher / lister. */
function avecFacture(app: MaidesApp): void {
  app.handle({ method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, body: { o: '9', b: '1', client: 'ACME', qte: '3', pu: '100' } });
}

describe('interactivité UI — web services, confirmation, fragments AJAX', () => {
  let app: MaidesApp;
  beforeEach(() => { app = creerAppDemo(); });

  it('/_ws recherche : renvoie les lignes correspondantes en JSON', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'recherche', table: 'facture', q: 'ACME' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('application/json');
    const data = JSON.parse(r.body);
    expect(Array.isArray(data.rows)).toBe(true);
    expect(data.rows.some((l: Record<string, unknown>) => l.client === 'ACME')).toBe(true);
  });

  it('/_ws recherche : terme absent -> aucune ligne', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'recherche', table: 'facture', q: 'introuvable' }, user: ADMIN });
    expect(JSON.parse(r.body).rows).toHaveLength(0);
  });

  it('/_ws cles : renvoie les clés de la table', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'cles', table: 'facture' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).cles).toContain('1');
  });

  it('/_ws : table manquante -> 400', () => {
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'recherche' }, user: ADMIN });
    expect(r.status).toBe(400);
  });

  it('/_ws : protégé par authentification', () => {
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'cles', table: 'facture' } });
    expect(r.status).toBe(302);
    expect(r.headers?.Location).toBe('/login');
  });

  it('consultation : la suppression demande confirmation (data-confirm)', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '1' }, user: ADMIN });
    expect(r.body).toContain('data-confirm');
    expect(r.body).toContain('Supprimer définitivement');
  });

  it('/_obe o=9 : enregistre une ligne et renvoie tuple + obe.b (avec recalcul)', () => {
    const r = app.handle({
      method: 'POST', ecran: '_obe', query: {}, user: ADMIN,
      body: { e: 'factureSaisie', b: '2', o: '9', num: '2', client: 'Beta', qte: '2', pu: '50' },
    });
    expect(r.status).toBe(200);
    const data = JSON.parse(r.body);
    expect(data.obe.b).toEqual(['2']);
    expect(data.tuple.client.v).toBe('Beta');
    expect(data.tuple.client.ne).toBe(true);   // pas d'erreur sur ce champ
    expect(String(data.tuple.total.v)).toBe('100'); // formule $qte*$pu recalculée serveur
  });

  it('/_obe o=9 invalide : 422 + erreur de champ dans tuple.ne', () => {
    const r = app.handle({
      method: 'POST', ecran: '_obe', query: {}, user: ADMIN,
      body: { e: 'factureSaisie', b: '3', o: '9', num: '3', client: '', qte: '0', pu: '5' },
    });
    expect(r.status).toBe(422);
    const data = JSON.parse(r.body);
    // format genereSortieJson : ne = tableau des messerr (ou true si pas d'erreur)
    expect(Array.isArray(data.tuple.client.ne)).toBe(true);
    expect(data.tuple.client.ro).toBe(false); // champ éditable
    expect(data.obe).toHaveProperty('m'); // obe = {b,e,m,n,p}
  });

  it('/_obe o=4 : supprime une ligne existante', () => {
    avecFacture(app); // crée la ligne b=1
    const r = app.handle({ method: 'POST', ecran: '_obe', query: {}, user: ADMIN, body: { e: 'factureSaisie', b: '1', o: '4' } });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).supprime).toBe(true);
    const v = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'recherche', table: 'facture', q: 'ACME' }, user: ADMIN });
    expect(JSON.parse(v.body).rows).toHaveLength(0);
  });

  it('/_obe : GET refusé (405) et protégé par auth', () => {
    expect(app.handle({ method: 'GET', ecran: '_obe', query: {}, user: ADMIN }).status).toBe(405);
    expect(app.handle({ method: 'POST', ecran: '_obe', query: {}, body: { e: 'x', o: '9' } }).status).toBe(302);
  });

  it('/_upload + /doc : téléverse un document GED et le ressert', () => {
    avecFacture(app); // facture b=1
    const data = 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64');
    const up = app.handle({ method: 'POST', ecran: '_upload', query: {}, user: ADMIN, body: { table: 'facture', b: '1', champ: 'scan', nom: 'scan.png', type: 'image/png', data } });
    expect(up.status).toBe(200);
    expect(JSON.parse(up.body).ok).toBe(true);
    const doc = app.handle({ method: 'GET', ecran: 'doc', query: { t: 'facture', b: '1', c: 'scan' }, user: ADMIN });
    expect(doc.status).toBe(200);
    expect(doc.contentType).toBe('image/png');
    expect(doc.bodyBinaire?.toString()).toBe('PNGDATA');
  });

  it('/doc inconnu -> 404 ; /_upload GET -> 405 ; auth requise', () => {
    expect(app.handle({ method: 'GET', ecran: 'doc', query: { t: 'x', b: '1', c: 'y' }, user: ADMIN }).status).toBe(404);
    expect(app.handle({ method: 'GET', ecran: '_upload', query: {}, user: ADMIN }).status).toBe(405);
    expect(app.handle({ method: 'POST', ecran: '_upload', query: {}, body: { table: 'x', champ: 'y' } }).status).toBe(302);
  });

  it('navigation o=2/o=3 : document suivant / précédent', () => {
    app.handle({ method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, body: { o: '9', b: '1', client: 'ACME', qte: '1', pu: '1' } });
    app.handle({ method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, body: { o: '9', b: '2', client: 'Beta', qte: '1', pu: '1' } });
    const suiv = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '2', b: '1' }, user: ADMIN });
    expect(suiv.status).toBe(200);
    expect(suiv.body).toContain('value="Beta"'); // passé au document suivant (clé 2)
    const prec = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '3', b: '2' }, user: ADMIN });
    expect(prec.body).toContain('value="ACME"'); // revenu au document précédent (clé 1)
  });

  it('o=7 sans séquence définie : rend l’écran courant sans erreur', () => {
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '7', b: '1' }, user: ADMIN });
    expect(r.status).toBe(200);
  });

  it('/_upload : filtre `accept` -> 415 si type non autorisé', () => {
    avecFacture(app);
    const data = 'data:image/png;base64,' + Buffer.from('X').toString('base64');
    const r = app.handle({ method: 'POST', ecran: '_upload', query: {}, user: ADMIN, body: { table: 'facture', b: '1', champ: 'scan', nom: 'x.png', type: 'image/png', data, accept: '.pdf,application/pdf' } });
    expect(r.status).toBe(415);
  });

  it('o=14 : export PDF de l’écran (Content-Type application/pdf)', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '14', b: '1' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.contentType).toBe('application/pdf');
    expect(r.bodyBinaire?.slice(0, 4).toString()).toBe('%PDF');
  });

  it('o=5 : duplication vers une nouvelle clé', () => {
    avecFacture(app); // facture 1 = ACME
    const r = app.handle({ method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, body: { o: '5', b: '1', cleCible: '99' } });
    expect(r.status).toBe(200);
    const v = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '99' }, user: ADMIN });
    expect(v.body).toContain('value="ACME"'); // la copie reprend les valeurs
  });

  it('pile de navigation : o=-1 revient à l’écran précédent (port gestionPile)', () => {
    app.handle({ method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, body: { o: '9', b: '1', client: 'A', qte: '1', pu: '1' } });
    app.handle({ method: 'POST', ecran: 'factureSaisie', query: {}, user: ADMIN, body: { o: '9', b: '2', client: 'B', qte: '1', pu: '1' } });
    const etat: Record<string, any> = {}; // sac de session partagé entre requêtes
    app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '1' }, user: ADMIN, etatSession: etat });
    app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '2' }, user: ADMIN, etatSession: etat });
    const back = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '-1', b: '2' }, user: ADMIN, etatSession: etat });
    expect(back.status).toBe(302);
    expect(back.headers?.Location).toBe('/factureSaisie?o=1&b=1');
  });

  it('pile vide : o=-1 -> retour au menu', () => {
    const back = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '-1', b: '1' }, user: ADMIN, etatSession: {} });
    expect(back.headers?.Location).toBe('/menu');
  });

  it('o=2 au dernier document : message « Dernier document » (port O2/O3)', () => {
    avecFacture(app); // une seule facture (clé 1)
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '2', b: '1' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.body).toContain('Dernier document');
  });

  it('o=12 : visu si le document existe, édition sinon', () => {
    avecFacture(app);
    const exist = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '12', b: '1' }, user: ADMIN });
    expect(exist.body).toContain('value="ACME"');
    const neuf = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '12', b: '777' }, user: ADMIN });
    expect(neuf.body).toContain('Création'); // bascule en édition (nouveau doc)
  });

  it('/_ws op=calcul : évalue une expression dans le contexte de l’écran', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'calcul', e: 'factureSaisie', b: '1', expr: '2 + 3' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).valeur).toBe(5);
  });

  it('gestion utilisateurs : liste, création, accès super-admin only', () => {
    const liste = app.handle({ method: 'GET', ecran: 'utilisateurs', query: {}, user: ADMIN });
    expect(liste.status).toBe(200);
    expect(liste.body).toContain('admin');
    const cree = app.handle({ method: 'POST', ecran: 'utilisateurs', query: {}, user: ADMIN, body: { action: 'defUser', login: 'bob', motdepasse: 'secret', niveau: '3', actif: '1' } });
    expect(cree.status).toBe(302);
    const apres = app.handle({ method: 'GET', ecran: 'utilisateurs', query: {}, user: ADMIN });
    expect(apres.body).toContain('bob');
    // bob peut se connecter avec le mot de passe défini
    const login = app.handle({ method: 'POST', ecran: 'login', query: {}, body: { login: 'bob', motdepasse: 'secret' } });
    expect(login.session?.user?.login).toBe('bob');
    // non super-admin -> 403
    const refus = app.handle({ method: 'GET', ecran: 'utilisateurs', query: {}, user: { login: 'u', superAdmin: false, niveau: 3 } });
    expect(refus.status).toBe(403);
  });

  it('/_ws op=ecrans : liste les écrans (équivalent JSON pEcrans)', () => {
    const r = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'ecrans' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).ecrans.some((e: any) => e.nom === 'factureSaisie')).toBe(true);
  });

  it('o=14 avec saisie invalide : réaffiche l’écran au lieu du PDF (port boucle O14)', () => {
    avecFacture(app);
    const r = app.handle({ method: 'POST', ecran: 'factureSaisie', query: { o: '14', b: '1' }, user: ADMIN, body: { o: '14', b: '1', client: '', qte: '0', pu: '5' } });
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('text/html'); // pas un PDF
    expect(r.body).toMatch(/corrigez les erreurs/i);
  });

  it('/_ws op=droit et op=tabulation : web services d’admin (a=10/a=11)', () => {
    const d = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'droit', table: 'facture', champ: 'client', niveau: '3', valeur: 'L' }, user: ADMIN });
    expect(JSON.parse(d.body).ok).toBe(true);
    const g = app.handle({ method: 'GET', ecran: 'designer', query: { config: 'droit', dt: 'facture' }, user: ADMIN });
    expect(g.body).toContain('client'); // le droit posé est visible dans la grille
    const t = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'tabulation', e: 'factureSaisie', champ: 'client', tabindex: '5' }, user: ADMIN });
    expect(JSON.parse(t.body).ok).toBe(true);
    // non super-admin -> 403
    const refus = app.handle({ method: 'GET', ecran: '_ws', query: { op: 'droit', table: 'facture', champ: 'client', niveau: '3', valeur: 'L' }, user: { login: 'u', superAdmin: false, niveau: 3 } });
    expect(refus.status).toBe(403);
  });

  it('OBE : o non-numérique exécute l’ordre personnalisé o=<nom> (port o_<nom>.php)', () => {
    avecFacture(app); // facture 1 = ACME, qte 3
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: 'doubler', b: '1' }, user: ADMIN });
    expect(r.status).toBe(200);
    expect(r.body).toContain('Quantité doublée');
    expect(r.body).toContain('value="6"'); // qte 3 -> 6
  });

  it('OBE : o=<nom> inconnu -> 404 (ordre personnalisé introuvable)', () => {
    avecFacture(app);
    const r = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: 'inexistant', b: '1' }, user: ADMIN });
    expect(r.status).toBe(404);
    expect(r.body).toMatch(/introuvable|personnalisé/i);
  });

  it('AJAX : renvoie un fragment (#md-vue), pas la page complète', () => {
    avecFacture(app);
    const complet = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '1' }, user: ADMIN });
    const fragment = app.handle({ method: 'GET', ecran: 'factureSaisie', query: { o: '1', b: '1' }, user: ADMIN, ajax: true });
    // la page complète embarque le bandeau ; le fragment ne contient que le contenu de #md-vue
    expect(complet.body).toContain('class="topbar"');
    expect(fragment.body).not.toContain('class="topbar"');
    expect(fragment.body).toContain('crumbs'); // mais bien le contenu de l'écran
  });
});

/**
 * Application HTTP maides : shell complet (login -> menu -> écrans).
 *
 * Indépendant du transport (testable sans port). La gestion de session/cookie
 * est déléguée à l'adaptateur HTTP : `handle()` indique via `session` quand
 * ouvrir/fermer une session.
 */

import {
  R4, Runtime, renderEcran, authentifier, toUserInfo, construitMenu, feuillesMenu, entreesMenuOuDefaut, lireOptions, parseOrdre,
  genererImpression, documentImprimable, htmlVersPdf, hashPassword, PileNavigation,
  DroitEditor, EcranEditor,
  type Zzz, type ExpMessage, type UserStore, type MenuEntry, type UserInfo, type LayerStore, type WidgetDataAcces,
  type SpecifiqueRegistry, type EntreePile, type ValeurDroit,
} from '@maides/core';
import { renderPage, renderAuthPage, renderFragment } from './page.js';
import { DesignerApp } from './designer-app.js';

export interface RequeteMaides {
  method: 'GET' | 'POST';
  /** Premier segment d'URL : écran, ou 'login' / 'logout' / 'menu' / ''. */
  ecran: string;
  query: Record<string, string>;
  body?: Record<string, any>;
  /** Utilisateur courant résolu depuis la session (null si anonyme). */
  user?: UserInfo | null;
  /** Format de réponse souhaité (html par défaut, json pour les SPA/intégrations). */
  format?: 'html' | 'json';
  /** Requête AJAX (échange de fragment plutôt que page complète). */
  ajax?: boolean;
  /** Sac d'état persistant par session (pile de navigation…), fourni par l'adaptateur HTTP. */
  etatSession?: Record<string, any>;
}

/** Données résolues d'un widget lié (options de select, lignes de liste) pour la SPA. */
function donneesWidget(w: any, acces?: WidgetDataAcces): { options?: any[]; lignes?: any[] } {
  if (!acces) return {};
  const o = lireOptions(w);
  switch (w.type_widget) {
    case 'select':
      return { options: w.options ?? [] };
    case 'selectTable':
      return { options: (acces.lireTable?.(o['table'] ?? w.table ?? '') ?? []).map((l) => ({ value: l.cle, libelle: `${l.cle} - ${l.libelle}` })) };
    case 'selectFic':
      return { options: acces.lireFic?.({ table: o['table'] ?? w.table ?? '', cle: o['cle'] ?? w.cle ?? '', libelle: o['libelle'] }) ?? [] };
    case 'recordList':
      return { lignes: acces.lignes?.({ table: o['index'] ?? w.index ?? '', filtre: o['filtre'], tri: o['tri'] }) ?? [] };
    case 'selectList':
    case 'querabiliteList':
      return { lignes: acces.lignes?.({ table: o['table'] ?? w.table ?? '', filtre: o['filtre'], tri: o['tri'] }) ?? [] };
    default:
      return {};
  }
}

/** Sérialisation JSON de l'état d'un écran (pour un front SPA ou une intégration). */
export function serialiseZzz(zzz: Zzz, acces?: WidgetDataAcces): Record<string, any> {
  const champs: Record<string, any> = {};
  for (const [nom, w] of Object.entries(zzz.champs)) {
    const droit = zzz.droits?.[nom];
    if (droit?.masque) continue; // droit 'P' : champ non exposé à la SPA
    champs[nom] = {
      type_widget: w.type_widget,
      type_champ: w.type_champ,
      libelle: w.libelle,
      est_lecture_seule: w.est_lecture_seule === 1 || !!droit?.ro,
      formule_calcul: w.formule_calcul,
      messerr: w.messerr ?? [],
      ...donneesWidget(w, acces),
    };
  }
  return {
    ecran: zzz.e,
    o: zzz.o,
    cle: zzz.cle,
    ficMaitre: zzz.ficMaitre,
    nouveauDoc: zzz.nouveauDoc,
    erreurBloquante: zzz.erreurBloquante,
    champs,
    valeurs: zzz.valeurs,
    messages: zzz.messages,
  };
}

export interface ReponseMaides {
  status: number;
  contentType: string;
  body: string;
  /** Corps binaire (documents GED) ; prioritaire sur `body` côté adaptateur HTTP. */
  bodyBinaire?: Buffer;
  headers?: Record<string, string>;
  /** Action de session à appliquer par l'adaptateur HTTP. */
  session?: { action: 'set' | 'clear'; user?: UserInfo };
}

export interface MaidesAppOptions {
  titre?: string;
  userStore?: UserStore;
  menuEntries?: MenuEntry[];
  /** Couche de paramétrage pour activer le designer visuel (/designer). */
  designerStore?: LayerStore;
  /** Code spécifique : ordres personnalisés `o=<nom>` (port des programmes o_<nom>.php). */
  specifiques?: SpecifiqueRegistry;
}

const CONTROLE = new Set(['o', 'e', 'b', 'cle', 'login', 'motdepasse']);

export class MaidesApp {
  private titre: string;
  private userStore?: UserStore;
  private menuEntries: MenuEntry[];
  private designer?: DesignerApp;
  private menuStore?: LayerStore;
  private specifiques?: SpecifiqueRegistry;
  /** GED en mémoire : documents téléversés, indexés par `<table>/<cle>/<champ>`. */
  private ged = new Map<string, { nom: string; type: string; buf: Buffer }>();

  constructor(private r4: R4, options: MaidesAppOptions = {}) {
    this.titre = options.titre ?? 'Maxima';
    this.userStore = options.userStore;
    this.menuEntries = options.menuEntries ?? [];
    this.specifiques = options.specifiques;
    this.menuStore = options.designerStore; // la table 'menu' éditée dans le Designer y est stockée
    if (options.designerStore) this.designer = new DesignerApp(options.designerStore, `${this.titre} — Designer`);
  }

  /**
   * Entrées de menu effectives = menu de base (config) + entrées de la table
   * 'menu' éditées dans le Designer (celles-ci priment, par menu_position).
   * C'est ce qui rend visible sur l'Accueil ce qu'on ajoute dans Paramétrage › Menus.
   */
  private entreesMenu(): MenuEntry[] {
    const parPosition = new Map<string, MenuEntry>();
    for (const e of this.menuEntries) parPosition.set(e.menu_position, e);
    for (const r of this.menuStore?.listAll('menu') ?? []) {
      parPosition.set(String(r['menu_position']), {
        menu_position: String(r['menu_position']),
        menu_libelle: String(r['menu_libelle'] ?? ''),
        menu_script: r['menu_script'] || undefined,
        menu_droit: r['menu_droit'] !== undefined && r['menu_droit'] !== '' ? Number(r['menu_droit']) : undefined,
      });
    }
    return [...parPosition.values()];
  }

  /** Authentification requise si un UserStore est configuré. */
  private get authRequise(): boolean { return !!this.userStore; }

  handle(req: RequeteMaides): ReponseMaides {
    try {
      switch (req.ecran) {
        case 'login': return this.handleLogin(req);
        case 'logout': return req.format === 'json'
          ? { ...this.json(200, { ok: true }), session: { action: 'clear' } }
          : this.handleLogout();
        case '':
        case 'menu': return this.exigeUser(req) ?? this.handleMenu(req.user!, req.format === 'json');
        case 'aide': return this.exigeUser(req) ?? this.handleAide(req.user?.login);
        case '_ws': return this.exigeUser(req) ?? this.handleWs(req);
        case '_obe': return this.exigeUser(req) ?? this.handleObe(req);
        case '_upload': return this.exigeUser(req) ?? this.handleUpload(req);
        case 'doc': return this.exigeUser(req) ?? this.handleDoc(req);
        case 'utilisateurs': return this.exigeUser(req) ?? this.handleUtilisateurs(req);
        case 'designer': return this.exigeUser(req) ?? this.handleDesigner(req);
        default: return this.exigeUser(req) ?? this.handleEcran(req);
      }
    } catch (e: any) {
      return this.html(500, renderPage('Erreur', `<pre>${this.escape(e?.message ?? String(e))}</pre>`));
    }
  }

  /* ------------------------- authentification ------------------------- */

  private exigeUser(req: RequeteMaides): ReponseMaides | null {
    if (this.authRequise && !req.user) {
      // Requête AJAX/API sans session (souvent expirée après un redémarrage) :
      // on ne renvoie PAS le HTML de connexion (qui s'injecterait dans le
      // contenu) ; on signale 401 pour que le client recharge proprement /login.
      if (req.ajax || req.format === 'json') return this.json(401, { erreur: 'non_authentifie' });
      return this.redirect('/login');
    }
    return null;
  }

  private handleLogin(req: RequeteMaides): ReponseMaides {
    const json = req.format === 'json';
    if (req.method === 'GET' || !this.userStore) {
      return json ? this.json(200, { authentifie: !!req.user, user: req.user ?? null }) : this.pageLogin();
    }
    const login = String(req.body?.login ?? '');
    const motdepasse = String(req.body?.motdepasse ?? '');
    const compte = authentifier(this.userStore, login, motdepasse);
    if (!compte) {
      return json
        ? { ...this.json(401, { ok: false, erreur: 'Identifiants invalides.' }) }
        : this.pageLogin('Identifiants invalides.');
    }
    const user = toUserInfo(compte);
    if (json) return { ...this.json(200, { ok: true, user }), session: { action: 'set', user } };
    return { ...this.redirect('/menu'), session: { action: 'set', user } };
  }

  private handleLogout(): ReponseMaides {
    return { ...this.redirect('/login'), session: { action: 'clear' } };
  }

  private pageLogin(erreur = ''): ReponseMaides {
    const msg = erreur
      ? `<div class="msg msg--erreur" style="margin-bottom:16px"><span class="msg__i">✕</span>${this.escape(erreur)}</div>`
      : '';
    const form = `<form class="auth" method="post" action="/login">
      <span class="eyebrow">${this.escape(this.titre)}</span>
      <h1>Connexion</h1>
      <p class="lede" style="margin:6px 0 18px">Identifiez-vous pour entrer dans l'atelier.</p>
      ${msg}
      <div class="md-champ"><label>Identifiant</label><input name="login" autofocus /></div>
      <div class="md-champ"><label>Mot de passe</label><input type="password" name="motdepasse" /></div>
      <button type="submit" style="width:100%;margin-top:6px">Se connecter</button>
      <p style="font-size:12px;color:var(--muted);margin:16px 0 0">Compte de démonstration : <code>admin</code> / <code>admin</code></p>
    </form>`;
    return this.html(200, renderAuthPage(form));
  }

  /* ------------------------- menu ------------------------- */

  private handleMenu(user: UserInfo, json = false): ReponseMaides {
    // menu de base + table 'menu' éditée dans le Designer, puis repli par défaut (super-admin)
    const entries = entreesMenuOuDefaut(this.entreesMenu(), user);
    if (json) {
      return this.json(200, { user, entrees: feuillesMenu(construitMenu(entries, user)) });
    }
    const hero =
      `<div class="hero"><span class="eyebrow">Atelier low-code</span>` +
      `<h1>Bonjour ${this.escape(user.login)}</h1>` +
      `<p>Ici, on <strong>construit des applications de gestion sans coder</strong> : on définit des ` +
      `tables, des écrans et des règles de calcul, et l'application fonctionne aussitôt. ` +
      `Cliquez une tuile pour ouvrir une application, ou créez la vôtre.</p>` +
      (user.superAdmin ? '<a class="cta" href="/designer">＋ Créer / modifier une application</a> ' : '') +
      `<a class="btn secondaire" href="/aide">Comment ça marche ?</a></div>`;
    const lanceur = entries.length
      ? this.renderLanceur(entries)
      : '<div class="vide">Aucune application pour l’instant.' +
        (user.superAdmin ? ' Ouvrez le <a href="/designer">Designer</a> pour en créer une.' : '') + '</div>';
    return this.html(200, renderPage('Accueil', hero + lanceur, [], { user: user.login, section: 'menu' }));
  }

  /** Rend le menu en tuiles d'action groupées (entrées sans script = titres de section). */
  private renderLanceur(entries: MenuEntry[]): string {
    const tries = [...entries].sort((a, b) => a.menu_position.localeCompare(b.menu_position));
    const sections: { titre: string; items: MenuEntry[] }[] = [];
    let courante: { titre: string; items: MenuEntry[] } | null = null;
    for (const e of tries) {
      if (!e.menu_script) { courante = { titre: e.menu_libelle, items: [] }; sections.push(courante); continue; }
      if (!courante) { courante = { titre: 'Applications', items: [] }; sections.push(courante); }
      courante.items.push(e);
    }
    const vus = new Set<string>(); // dédoublonnage des cibles identiques (ex. Designer en double)
    return sections.map((s) => {
      const tiles = s.items.map((it) => {
        const href = this.hrefMenu(it.menu_script!);
        if (vus.has(href)) return '';
        vus.add(href);
        const sub = this.escape(this.cibleLisible(it.menu_script!));
        return `<a class="tile" href="${this.escape(href)}"${href.startsWith('/') && !href.startsWith('/designer') && !href.startsWith('/logout') ? ' data-md-ajax' : ''}>` +
          `<span class="tile__ico">▸</span><span class="tile__txt"><span class="tile__lbl">${this.escape(it.menu_libelle)}</span>` +
          `<span class="tile__sub">${sub}</span></span></a>`;
      }).join('');
      return tiles ? `<section class="launcher-grp"><h2>${this.escape(s.titre)}</h2><div class="tiles">${tiles}</div></section>` : '';
    }).join('');
  }

  /** Convertit un script de menu en URL utilisable par le shell HTML. */
  private hrefMenu(script: string): string {
    const s = script.trim();
    if (s === '') return '#';
    if (s.startsWith('/') || s.startsWith('http')) return s;
    if (s.startsWith('?')) {
      const q = new URLSearchParams(s.slice(1));
      const e = q.get('e');
      if (e) return `/${e}?o=${q.get('o') ?? '1'}&b=${q.get('b') ?? ''}`;
      return s;
    }
    return s;
  }

  /** Libellé court de la cible (pour le sous-titre de la tuile). */
  private cibleLisible(script: string): string {
    const s = script.trim();
    if (s.startsWith('/')) return s.split('?')[0]!.replace(/^\//, '') || 'accueil';
    const q = new URLSearchParams(s.replace(/^\?/, ''));
    return q.get('e') ?? q.get('module') ?? s;
  }

  /* ------------------------- aide intégrée ------------------------- */

  private handleAide(userLogin?: string): ReponseMaides {
    const corps =
      `<div class="guide-section"><span class="eyebrow">Aide</span>` +
      `<h1>Comment ça marche</h1>` +
      `<p>Maxima est un <strong>atelier pour fabriquer des applications de gestion sans programmer</strong>. ` +
      `On décrit des <strong>tables</strong> (où sont rangées les données), des <strong>écrans</strong> (les formulaires) ` +
      `et des <strong>règles de calcul</strong> ; l'application fonctionne aussitôt.</p></div>` +

      `<h2>Construire une application en 3 étapes</h2>` +
      `<div class="steps">` +
      `<div class="step"><span class="step__n">1</span><div class="step__b"><h3>Créer une table</h3>` +
      `<p>Designer → « Nouvelle table ». Donnez-lui un nom (ex. <code>client</code>), puis ajoutez ses ` +
      `champs (ex. <code>nom</code>, <code>ville</code>) en cochant « clé » pour le champ identifiant.</p></div></div>` +
      `<div class="step"><span class="step__n">2</span><div class="step__b"><h3>Créer un écran</h3>` +
      `<p>Designer → « Nouvel écran », reliez-le à votre table, puis posez un <em>widget</em> (contrôle de saisie) ` +
      `sur chaque champ. Un champ peut être calculé par une <strong>formule</strong> (ex. <code>$qte * $pu</code>).</p></div></div>` +
      `<div class="step"><span class="step__n">3</span><div class="step__b"><h3>Lancer</h3>` +
      `<p>Cliquez « ▶ lancer » : vous saisissez et enregistrez des fiches, les calculs se font tout seuls. ` +
      `Ajoutez l'écran au menu (étape ci-dessous) pour le retrouver sur l'Accueil.</p></div></div>` +
      `</div>` +

      `<h2>Repères pour ne pas se perdre</h2>` +
      `<div class="card"><p><strong>Naviguer</strong> : la barre du haut (<span class="kbd">Accueil</span> / ` +
      `<span class="kbd">Designer</span>) est toujours là ; chaque écran a un bouton <span class="kbd">← Menu</span>.</p>` +
      `<p><strong>Le menu</strong> s'édite dans <em>Designer → ⚙ Paramétrage → Menus</em> et s'affiche sur l'<em>Accueil</em>. ` +
      `Une entrée <strong>sans</strong> « script » devient un titre de section ; <strong>avec</strong> un script, une tuile cliquable.</p>` +
      `<p><strong>Champ « Script » d'un menu</strong> :<br>` +
      `• ouvrir un écran (création) → <code>/monEcran?o=8&amp;b=</code><br>` +
      `• ouvrir une fiche précise → <code>/monEcran?o=1&amp;b=&lt;clé&gt;</code><br>` +
      `• ouvrir le Designer → <code>/designer</code></p>` +
      `<p><strong>Formules</strong> : <code>$champ</code> pour une valeur, opérateurs <code>+ - * /</code>, ` +
      `condition <code>SI(test ? siVrai : siFaux)</code>. Exemple : <code>$qte * $pu</code>.</p>` +
      `<p><strong>Droits par champ</strong> : <code>C</code> complet · <code>N</code> modifiable à la création · ` +
      `<code>L</code> lecture seule · <code>P</code> masqué.</p></div>` +
      `<p class="aide">Manuel détaillé : fichier <code>MANUEL.md</code> à la racine du projet.</p>`;
    return this.html(200, renderPage('Aide', corps, [], { user: userLogin, section: 'aide', retour: { href: '/menu', label: 'Retour à l’accueil' } }));
  }

  /* ------------------------- web services (recherche / clés) ------------------------- */

  /** Endpoint JSON pour l'autocomplétion et la recherche popup (quérabilité). */
  private handleWs(req: RequeteMaides): ReponseMaides {
    const rt = new Runtime(this.r4, { user: req.user ?? { login: '', superAdmin: true, niveau: 0 }, specifiques: this.specifiques });
    const op = String(req.query.op ?? '');
    // op=calcul : évalue une expression dans le contexte d'un écran (port de bax_webs a=5)
    if (op === 'calcul') {
      const cleStr = String(req.query.b ?? '');
      const c = cleStr ? cleStr.split('.') : [];
      return this.json(200, { valeur: rt.calculSurEcran(String(req.query.e ?? ''), c, String(req.query.expr ?? '')) });
    }
    // op=ecrans : liste des écrans (équivalent JSON de pEcrans)
    if (op === 'ecrans') {
      const ecrans = (this.menuStore?.listAll('scr') ?? []).map((e: any) => ({ nom: e.nom_ecran, table: e.table_liee ?? '' }));
      return this.json(200, { ecrans });
    }
    // op=droit (port bax_webs a=10 WBS_gestionDroits) : fixe un droit champ × niveau
    if (op === 'droit') {
      if (!req.user?.superAdmin || !this.menuStore) return this.json(403, { erreur: 'réservé super-admin' });
      new DroitEditor(this.menuStore).definitDroit(
        String(req.query.table ?? ''), String(req.query.champ ?? ''),
        Number(req.query.niveau ?? 0), String(req.query.valeur ?? 'C') as ValeurDroit);
      return this.json(200, { ok: true });
    }
    // op=tabulation (port bax_webs a=11 WBS_gestionTabulation) : fixe l'ordre de focus d'un widget
    if (op === 'tabulation') {
      if (!req.user?.superAdmin || !this.menuStore) return this.json(403, { erreur: 'réservé super-admin' });
      new EcranEditor(this.menuStore, 'scr').modifieWidget(
        String(req.query.e ?? ''), String(req.query.champ ?? ''), { tabindex: Number(req.query.tabindex ?? 0) });
      return this.json(200, { ok: true });
    }
    const table = String(req.query.table ?? '');
    if (!table) return this.json(400, { erreur: 'table manquante' });
    if (op === 'recherche') {
      return this.json(200, { rows: rt.rechercheComplete(table, String(req.query.q ?? ''), 20) });
    }
    if (op === 'cles') {
      const p = String(req.query.prefixe ?? '');
      return this.json(200, { cles: rt.chercheCles(table, p ? p.split('.') : [], 20) });
    }
    if (op === 'valeur') {
      // lookup d'un libellé/valeur par clé (port de bax_webs a=12 getValueFromTable)
      const v = rt.valeurParametre(table, String(req.query.v ?? req.query.cle ?? ''));
      return this.json(200, { valeur: v });
    }
    return this.json(400, { erreur: 'op inconnue' });
  }

  /**
   * Endpoint OBE JSON pour les tableaux éditables / sous-écrans multi-lignes
   * (port de bax_obe_ajax) : enregistre (o=9) ou supprime (o=4) une ligne du
   * sous-écran `e` de clé `b`, et renvoie { tuple:{col:{v,ne}}, obe:{b,e} }.
   */
  private handleObe(req: RequeteMaides): ReponseMaides {
    if (req.method !== 'POST') return this.json(405, { erreur: 'POST requis' });
    const runtime = new Runtime(this.r4, { user: req.user ?? { login: '', superAdmin: true, niveau: 0 }, specifiques: this.specifiques });
    const body = req.body ?? {};
    const e = String(body.e ?? '');
    const o = Number(body.o ?? 9);
    const b = String(body.b ?? '');
    const cle = b ? b.split('.') : [];
    if (!e) return this.json(400, { erreur: 'sous-écran manquant' });

    if (o === 4) {
      const zzz = runtime.supprime(e, cle);
      const refuse = zzz.erreurBloquante;
      return this.json(refuse ? 403 : 200, { supprime: !refuse, tuple: {}, obe: { b: [], e }, messages: zzz.messages });
    }

    const saisies: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'e' || k === 'b' || k === 'o') continue;
      saisies[k] = v;
    }
    const { zzz, validation } = runtime.sauvegarde(e, cle, saisies);
    // Format EXACT du legacy genereSortieJson : { obe:{b,e,m,n,p}, tuple:{champ:{v,ro,ne}} }.
    const sortie = runtime.serialiseJson(zzz);
    return this.json(validation.erreurBloquante ? 422 : 200,
      { ...sortie, ok: !validation.erreurBloquante, messages: zzz.messages });
  }

  /* ------------------------- GED : téléversement / service de documents ------------------------- */

  private cleGed(table: string, cle: string, champ: string): string {
    return `${table}/${cle}/${champ}`;
  }

  /**
   * Téléversement d'un document (équivalent natif de l'acquisition scanner WebTWAIN).
   * POST JSON { table, b|cle, champ|c, nom, type, data(base64|dataURL) } : stocke le
   * blob en GED et enregistre la référence (nom) dans le champ du document maître.
   */
  private handleUpload(req: RequeteMaides): ReponseMaides {
    if (req.method !== 'POST') return this.json(405, { erreur: 'POST requis' });
    const b = req.body ?? {};
    const table = String(b.table ?? '');
    const cleStr = String(b.b ?? b.cle ?? '');
    const champ = String(b.champ ?? b.c ?? '');
    const nom = String(b.nom ?? 'document');
    let type = String(b.type ?? 'application/octet-stream');
    let data = String(b.data ?? '');
    if (!table || !champ) return this.json(400, { erreur: 'table/champ manquants' });
    const m = /^data:([^;]+);base64,(.*)$/s.exec(data);
    if (m) { type = m[1]!; data = m[2]!; }
    // filtre serveur selon `accept` (port du contrôle de type) : extensions (.pdf) ou types MIME (image/*)
    const accept = String(b.accept ?? '').trim();
    if (accept) {
      const ext = (nom.split('.').pop() ?? '').toLowerCase();
      const ok = accept.split(',').map((s) => s.trim().toLowerCase()).some((tok) =>
        tok === `.${ext}` || tok === type || (tok.endsWith('/*') && type.startsWith(tok.slice(0, -1))));
      if (!ok) return this.json(415, { erreur: `Type non autorisé (attendu : ${accept})` });
    }
    let buf: Buffer;
    try { buf = Buffer.from(data, 'base64'); } catch { return this.json(400, { erreur: 'données invalides' }); }
    if (buf.length === 0) return this.json(400, { erreur: 'document vide' });
    this.ged.set(this.cleGed(table, cleStr, champ), { nom, type, buf });
    // persiste la référence dans l'enregistrement maître (si présent)
    const cle = cleStr ? cleStr.split('.') : [];
    const store = this.r4.dataLayer() as unknown as { putWithKey?: (t: string, c: string[], r: Record<string, any>) => void } | undefined;
    const sr = this.r4.search(table, cle);
    if (sr && store?.putWithKey) store.putWithKey(table, cle, { ...sr.record, [champ]: nom });
    return this.json(200, { ok: true, nom, url: `/doc?t=${encodeURIComponent(table)}&b=${encodeURIComponent(cleStr)}&c=${encodeURIComponent(champ)}` });
  }

  /** Sert un document de la GED (port de pDocument). GET /doc?t=&b=&c= */
  private handleDoc(req: RequeteMaides): ReponseMaides {
    const table = String(req.query.t ?? '');
    const cleStr = String(req.query.b ?? '');
    const champ = String(req.query.c ?? '');
    const doc = this.ged.get(this.cleGed(table, cleStr, champ));
    if (!doc) return this.html(404, '<p>Document introuvable.</p>');
    return {
      status: 200,
      contentType: doc.type || 'application/octet-stream',
      body: '',
      bodyBinaire: doc.buf,
      headers: { 'Content-Disposition': `inline; filename="${doc.nom.replace(/[^\w.-]/g, '_')}"` },
    };
  }

  /* ------------------------- gestion des utilisateurs (port azxUtilisateur) ------------------------- */

  private handleUtilisateurs(req: RequeteMaides): ReponseMaides {
    if (!req.user?.superAdmin) return this.html(403, renderPage('Utilisateurs', '<p>Réservé aux super-administrateurs.</p>', [], { user: req.user?.login }));
    const store = this.userStore;
    if (!store || !store.liste) return this.html(404, renderPage('Utilisateurs', '<p>Gestion des utilisateurs indisponible.</p>', [], { user: req.user?.login }));

    if (req.method === 'POST') {
      const b = req.body ?? {};
      if (String(b.action) === 'suppUser' && store.supprime) { store.supprime(String(b.login)); return this.redirect('/utilisateurs'); }
      if (String(b.action) === 'defUser') {
        const login = String(b.login ?? '').trim();
        if (login) {
          const existant = store.findByLogin(login);
          store.save({
            login,
            password: b.motdepasse ? hashPassword(String(b.motdepasse)) : (existant?.password ?? hashPassword('changeme')),
            super_admin: b.super_admin === '1' ? 'O' : 'N',
            niveau: b.niveau !== '' && b.niveau != null ? Number(b.niveau) : 0,
            actif: b.actif === '1',
            nom: b.nom || undefined,
            email: b.email || undefined,
          });
        }
      }
      return this.redirect('/utilisateurs');
    }

    const edit = req.query.u ? store.findByLogin(String(req.query.u)) : null;
    const lignes = store.liste().map((c) => {
      const sa = (c.super_admin === 'O' || c.super_admin === true) ? '★' : '';
      return `<tr><td>${this.escape(c.login)}</td><td>${c.niveau ?? ''}</td><td>${sa}</td><td>${c.actif === false ? 'inactif' : 'actif'}</td>`
        + `<td><a class="btn secondaire" href="?u=${encodeURIComponent(c.login)}" title="Modifier">✎</a>`
        + `<form method="post" style="display:inline" data-confirm="Supprimer ${this.escape(c.login)} ?"><input type="hidden" name="action" value="suppUser"/><input type="hidden" name="login" value="${this.escape(c.login)}"/><button class="secondaire">✕</button></form></td></tr>`;
    }).join('');
    const coche = (b: boolean) => (b ? ' checked' : '');
    const form = `<h2>${edit ? `Modifier « ${this.escape(edit.login)} »` : 'Nouvel utilisateur'}</h2>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defUser"/>
        <div class="md-champ"><label>Login</label><input name="login" required value="${edit ? this.escape(edit.login) : ''}"${edit ? ' readonly' : ''}/></div>
        <div class="md-champ"><label>Mot de passe${edit ? ' (vide = inchangé)' : ''}</label><input name="motdepasse" type="password"${edit ? '' : ' required'}/></div>
        <div class="md-champ"><label>Niveau (0 = le plus privilégié)</label><input name="niveau" type="number" value="${edit?.niveau ?? 0}"/></div>
        <div class="md-champ"><label><input type="checkbox" name="super_admin" value="1"${coche(!!edit && (edit.super_admin === 'O' || edit.super_admin === true))}/> Super-administrateur</label></div>
        <div class="md-champ"><label><input type="checkbox" name="actif" value="1"${coche(!edit || edit.actif !== false)}/> Actif</label></div>
        <div class="md-toolbar"><button type="submit">Enregistrer</button>${edit ? '<a class="btn secondaire" href="/utilisateurs">Annuler</a>' : ''}</div>
      </form>`;
    const corps = `<table class="md-liste"><thead><tr><th>Login</th><th>Niveau</th><th>Admin</th><th>État</th><th></th></tr></thead><tbody>${lignes}</tbody></table>${form}`;
    return this.html(200, renderPage('Utilisateurs', corps, [],
      { user: req.user?.login, section: 'utilisateurs', retour: { href: '/menu', label: 'Retour à l’accueil' } }));
  }

  /* ------------------------- designer ------------------------- */

  private handleDesigner(req: RequeteMaides): ReponseMaides {
    if (!this.designer) return this.html(404, renderPage('Designer', '<p>Designer non activé.</p>'));
    if (req.user && !req.user.superAdmin) return this.html(403, renderPage('Designer', '<p>Réservé aux super-administrateurs.</p>'));
    return this.designer.handle(req);
  }

  /* ------------------------- écrans ------------------------- */

  private handleEcran(req: RequeteMaides): ReponseMaides {
    const runtime = new Runtime(this.r4, { user: req.user ?? { login: '', superAdmin: true, niveau: 0 }, specifiques: this.specifiques });
    const acces = runtime.accesDonnees();
    const cle = this.cleDe(req);
    // ordre + option (port de recupRequest : o = "9:8" -> sauvegarde puis mode 8)
    const { ordre, option } = parseOrdre((req.body?.o ?? req.query.o) ?? (req.method === 'POST' ? 9 : 1));
    const o = Number(ordre);
    const json = req.format === 'json';

    // OBE : o non-numérique -> ordre personnalisé `o=<nom>` (port de bax.php :
    // `else { o_<nom>.php }`). Cherché par écran puis en global ('*').
    if (ordre !== '' && Number.isNaN(o)) {
      try {
        const zzz = runtime.executeOrdrePersonnalise(req.ecran, cle, ordre, this.saisies(req.body ?? {}));
        return json ? this.json(200, serialiseZzz(zzz, acces)) : this.rendu(zzz, zzz.messages, req.user?.login, req.ajax, acces);
      } catch (e) {
        const msg = (e as Error).message;
        return json ? this.json(404, { erreur: msg })
          : this.html(404, renderPage(req.ecran, `<p class="md-erreur">${this.escape(msg)}</p>`, [], { user: req.user?.login, retour: { href: '/menu', label: 'Retour à l’accueil' } }));
      }
    }

    // Pile de navigation (port de gestionPile). o négatif -> dépile et revient en arrière.
    if (req.method === 'GET' && Number.isInteger(o) && o < 0) {
      const pile = this.restaurePile(req);
      const cible = pile.navigueOrdreNegatif(o);
      this.sauvePile(req, pile);
      if (cible) return this.redirect(`/${encodeURIComponent(cible.e)}?o=${encodeURIComponent(String(cible.o ?? 1))}&b=${encodeURIComponent(cible.b)}`);
      return this.redirect('/menu'); // pile vide -> retour au menu (port o=0)
    }

    if (req.method === 'GET') {
      // o=6/o=7 : navigation dans une séquence d'écrans (param `seq` = nom de séquence)
      if (o === 6 || o === 7) {
        const seq = String(req.query.seq ?? '');
        const cible = o === 7 ? runtime.ecranSuivant(seq, req.ecran) : runtime.ecranPrecedent(seq, req.ecran);
        if (cible) return this.redirect(`/${encodeURIComponent(cible)}?o=1${seq ? `&seq=${encodeURIComponent(seq)}` : ''}`);
        // pas de voisin : on reste, avec un message (port des messageAttention de O6/O7)
        const zzzC = runtime.visu(req.ecran, cle);
        const msgC: ExpMessage[] = [{ type: 'attention', text: o === 7 ? 'Dernier écran de la séquence.' : 'Premier écran de la séquence.' }];
        return json ? this.json(200, serialiseZzz(zzzC, acces)) : this.rendu(zzzC, msgC, req.user?.login, req.ajax, acces);
      }
      // o=13/o=14 : aperçu / impression -> PDF (port de pPdf / executeO13-O14).
      // Si des saisies sont postées, on les poste + valide ; en cas d'erreur on
      // réaffiche l'écran au lieu de produire le PDF (port de la boucle d'erreur de O14).
      if (o === 13 || o === 14) {
        const saisies = this.saisies(req.body ?? {});
        if (Object.keys(saisies).length > 0) {
          const { zzz, validation } = runtime.postageSeul(req.ecran, cle, saisies);
          if (validation.erreurBloquante) {
            zzz.o = 8;
            return this.rendu(zzz, [{ type: 'erreur', text: 'Corrigez les erreurs avant l’impression.' }, ...zzz.messages], req.user?.login, req.ajax, acces);
          }
          return this.pdfDeHtml(documentImprimable(renderEcran(zzz, { mode: 'document', acces }), { titre: req.ecran }), req.ecran);
        }
        return this.pdfReponse(runtime, req.ecran, cle, acces);
      }
      // o=2/o=3 : document suivant/précédent, avec message si déjà au bout (port O2/O3)
      if (o === 2 || o === 3) {
        const zzzN = o === 2 ? runtime.documentSuivant(req.ecran, cle) : runtime.documentPrecedent(req.ecran, cle);
        const auBout = zzzN.cle.join('.') === cle.join('.'); // pas de voisin : la clé n'a pas changé
        const msgN: ExpMessage[] = auBout ? [{ type: 'attention', text: o === 2 ? 'Dernier document.' : 'Premier document.' }] : [];
        return json ? this.json(200, serialiseZzz(zzzN, acces)) : this.rendu(zzzN, [...zzzN.messages, ...msgN], req.user?.login, req.ajax, acces);
      }
      const zzz =
        o === 8 ? runtime.edition(req.ecran, cle)
        : o === 12 ? runtime.visuOuEdition(req.ecran, cle)
        : o === 20 ? runtime.creeDocumentParametrage('let', req.ecran, cle)
        : o === 21 ? runtime.creeDocumentParametrage('scr', req.ecran, cle)
        : runtime.visu(req.ecran, cle);
      // empilage en consultation (port gestionPile : on empile quand o==1)
      if (o === 1 && !zzz.nouveauDoc) this.empile(req, zzz.e, zzz.cle.join('.'));
      return json ? this.json(200, serialiseZzz(zzz, acces)) : this.rendu(zzz, zzz.messages, req.user?.login, req.ajax, acces);
    }
    // o=5 : duplication du document courant vers une nouvelle clé (cleCible)
    if (o === 5) {
      const cibleStr = String(req.body?.cleCible ?? req.query.cleCible ?? '');
      const cleCible = cibleStr ? cibleStr.split('.') : cle;
      const { zzz, validation } = runtime.duplique(req.ecran, cle, cleCible, this.saisies(req.body ?? {}));
      const messages: ExpMessage[] = validation.erreurBloquante
        ? [{ type: 'erreur', text: 'Duplication refusée.' }, ...zzz.messages]
        : [{ type: 'succes', text: 'Document dupliqué.' }, ...zzz.messages];
      if (!validation.erreurBloquante) zzz.o = 8;
      if (json) return this.json(validation.erreurBloquante ? 422 : 200, { ...serialiseZzz(zzz, acces), validation, messages });
      return this.rendu(zzz, messages, req.user?.login, req.ajax, acces);
    }
    if (o === 4) {
      const zzz = runtime.supprime(req.ecran, cle);
      const refuse = zzz.erreurBloquante;
      const messages: ExpMessage[] = refuse ? zzz.messages : [{ type: 'succes', text: 'Document supprimé.' }];
      if (json) return this.json(refuse ? 403 : 200, { ...serialiseZzz(zzz, acces), supprime: !refuse, messages });
      return this.rendu(zzz, messages, req.user?.login, req.ajax, acces);
    }
    const { zzz, validation } = runtime.sauvegarde(req.ecran, cle, this.saisies(req.body ?? {}));
    const messages: ExpMessage[] = [...zzz.messages];
    if (validation.erreurBloquante) {
      messages.unshift({ type: 'erreur', text: 'Enregistrement refusé : corrigez les erreurs.' });
      zzz.o = 8;
    } else {
      messages.unshift({ type: 'succes', text: 'Enregistrement sauvegardé.' });
      // option d'ordre (o=9:8) : enchaîne sur le mode demandé après sauvegarde
      if (option && !Number.isNaN(Number(option))) zzz.o = Number(option);
    }
    if (json) return this.json(validation.erreurBloquante ? 422 : 200, { ...serialiseZzz(zzz, acces), validation, messages });
    return this.rendu(zzz, messages, req.user?.login, req.ajax, acces);
  }

  private json(status: number, data: any): ReponseMaides {
    return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(data) };
  }

  /* ------------------------- pile de navigation (port gestionPile) ------------------------- */

  private restaurePile(req: RequeteMaides): PileNavigation {
    const pile = new PileNavigation();
    const arr = req.etatSession?.['pile'];
    if (Array.isArray(arr)) for (const e of arr as EntreePile[]) pile.empile(e);
    return pile;
  }

  private sauvePile(req: RequeteMaides, pile: PileNavigation): void {
    if (req.etatSession) req.etatSession['pile'] = [...pile.entrees()];
  }

  /** Empile l'écran/clé courant s'il diffère du sommet (port de l'empilage de gestionPile). */
  private empile(req: RequeteMaides, e: string, b: string): void {
    const pile = this.restaurePile(req);
    const top = pile.sommet();
    if (!top || top.e !== e || top.b !== b) {
      pile.empile({ e, b, o: 1 });
      this.sauvePile(req, pile);
    }
  }

  /** Génère le PDF imprimable d'un écran/lettre (port de pPdf). Synchrone via htmlVersPdf. */
  private pdfReponse(runtime: Runtime, e: string, cle: string[], acces?: WidgetDataAcces): ReponseMaides {
    const estLettre = !!this.r4.chargeEcran(e, 'let');
    const html = estLettre
      ? genererImpression(runtime, e, cle, { titre: e })
      : documentImprimable(renderEcran(runtime.visu(e, cle), { mode: 'document', acces }), { titre: e });
    return this.pdfDeHtml(html, e);
  }

  /** Encapsule un HTML imprimable en réponse PDF binaire. */
  private pdfDeHtml(html: string, nom: string): ReponseMaides {
    return {
      status: 200,
      contentType: 'application/pdf',
      body: '',
      bodyBinaire: Buffer.from(htmlVersPdf(html)),
      headers: { 'Content-Disposition': `inline; filename="${nom.replace(/[^\w.-]/g, '_')}.pdf"` },
    };
  }

  private rendu(zzz: Zzz, messages: ExpMessage[], userLogin?: string, ajax?: boolean, acces?: WidgetDataAcces): ReponseMaides {
    const html = renderEcran(zzz, { lectureSeule: zzz.o === 1, acces });
    const mode = zzz.o === 1 ? 'Consultation' : zzz.nouveauDoc ? 'Création' : 'Modification';
    const cle = zzz.cle.join('.');
    const entete =
      `<div class="crumbs"><a href="/menu">Accueil</a> › <strong>${this.escape(zzz.e)}</strong></div>` +
      `<h1>${this.escape(zzz.e)} <span class="badge">${this.escape(mode)}${cle ? ' · ' + this.escape(cle) : ''}</span></h1>`;
    const inner = entete + html + this.toolbar(zzz);
    if (ajax) return this.html(200, renderFragment(inner, messages));
    // ne charge CKEditor/CodeMirror/jstree que si l'écran utilise ces widgets
    const types = new Set(Object.values(zzz.champs).map((w) => String(w.type_widget)));
    const libs = {
      ck: types.has('richtext') || types.has('CKEditor'),
      cm: types.has('codeEditor'),
      tree: types.has('arbre'),
    };
    return this.html(200, renderPage(this.escape(zzz.e), inner, messages,
      { user: userLogin, retour: { href: '/menu', label: 'Retour à l’accueil' }, libs }));
  }

  private toolbar(zzz: Zzz): string {
    const cle = zzz.cle.join('.');
    const q = `b=${encodeURIComponent(cle)}`;
    const menu = '<a class="btn secondaire" href="/menu">← Menu</a>';
    if (zzz.o === 1) {
      const supprimer =
        `<form method="post" style="display:inline" action="?o=4&${q}" data-md-ajax data-confirm="Supprimer définitivement ce document ?">` +
        `<input type="hidden" name="o" value="4" /><input type="hidden" name="b" value="${this.escape(cle)}" />` +
        `<button class="secondaire" type="submit">Supprimer</button></form>`;
      const nav = `<a class="btn secondaire" data-md-ajax href="?o=3&${q}" title="Document précédent">◀</a>`
        + `<a class="btn secondaire" data-md-ajax href="?o=2&${q}" title="Document suivant">▶</a>`;
      const imprimer = `<a class="btn secondaire" href="?o=14&${q}" target="_blank" title="Imprimer / PDF">🖨 PDF</a>`;
      const dupliquer = `<button class="secondaire" type="button" data-md-dup`
        + ` data-e="${this.escape(zzz.e)}" data-b="${this.escape(cle)}" title="Dupliquer vers une nouvelle clé">⎘ Dupliquer</button>`;
      return `<div class="md-toolbar">${nav}<a class="btn" data-md-ajax href="?o=8&${q}">✎ Modifier</a>${dupliquer}${imprimer}${supprimer}${menu}</div>`;
    }
    // édition : « Enregistrer » soumet le formulaire des champs (md-form) avec o=9
    return `<div class="md-toolbar">` +
      `<button type="submit" form="md-form" name="o" value="9">✓ Enregistrer</button>` +
      `<a class="btn secondaire" data-md-ajax href="?o=1&${q}">Annuler</a>${menu}</div>`;
  }

  /* ------------------------- utilitaires ------------------------- */

  private cleDe(req: RequeteMaides): string[] {
    const b = String(req.body?.b ?? req.query.b ?? '');
    return b === '' ? [] : b.split('.');
  }

  private saisies(body: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) if (!CONTROLE.has(k)) out[k] = v;
    return out;
  }

  private redirect(location: string): ReponseMaides {
    return { status: 302, contentType: 'text/html; charset=utf-8', body: '', headers: { Location: location } };
  }

  private html(status: number, body: string): ReponseMaides {
    return { status, contentType: 'text/html; charset=utf-8', body };
  }

  private escape(s: any): string {
    return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  }
}

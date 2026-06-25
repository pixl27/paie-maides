/** Gabarit de page HTML (thème « table à dessin ») et parsing de formulaire. */

import type { ExpMessage } from '@maides/core';

/** Parse un corps application/x-www-form-urlencoded en objet (gère name et name[idx]). */
export function parseForm(raw: string): Record<string, any> {
  const out: Record<string, any> = {};
  if (!raw) return out;
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const [kRaw, vRaw = ''] = pair.split('=');
    const key = decodeURIComponent(kRaw!.replace(/\+/g, ' '));
    const val = decodeURIComponent(vRaw.replace(/\+/g, ' '));
    const m = /^(\w+)\[(\d+)\]$/.exec(key);
    if (m) {
      const [, base, idx] = m;
      if (!Array.isArray(out[base!])) out[base!] = [];
      out[base!][Number(idx)] = val;
    } else {
      out[key] = val;
    }
  }
  return out;
}

const ICONE_MSG: Record<string, string> = {
  erreur: '✕', attention: '!', succes: '✓', admin: '·', debug: '·',
};

function escape(s: any): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function renderMessages(messages: ExpMessage[]): string {
  if (!messages.length) return '';
  return `<div class="msgs">${messages
    .map((m) => `<div class="msg msg--${escape(m.type)}"><span class="msg__i">${ICONE_MSG[m.type] ?? '·'}</span>${escape(m.text)}</div>`)
    .join('')}</div>`;
}

export interface PageOptions {
  /** Login de l'utilisateur connecté (affiché dans la barre). */
  user?: string;
  /** Masque la navigation (page de connexion). */
  hideNav?: boolean;
  /** Onglet de navigation actif ('menu' | 'designer' | autre). */
  section?: string;
  /** Lien de retour contextuel (affiché en tête de contenu). */
  retour?: { href: string; label: string };
  /** Bibliothèques lourdes à charger selon les widgets présents (CKEditor/CodeMirror/jstree). */
  libs?: { ck?: boolean; cm?: boolean; tree?: boolean };
}

/** Enveloppe un contenu dans une page HTML complète. */
export function renderPage(titre: string, contenu: string, messages: ExpMessage[] = [], options: PageOptions = {}): string {
  const marque = options.hideNav
    ? `<span class="brand"><b>Maxima</b><i>gestion</i></span>`
    : `<a class="brand" href="/menu"><b>Maxima</b><i>gestion</i></a>`;
  const lien = (href: string, label: string, sec: string) =>
    `<a class="topnav__a${options.section === sec ? ' is-actif' : ''}" href="${href}">${label}</a>`;
  const nav = options.hideNav ? '' :
    `<nav class="topnav">${lien('/menu', 'Accueil', 'menu')}${lien('/designer', 'Designer', 'designer')}${lien('/aide', '? Aide', 'aide')}</nav>`;
  const actions = options.user
    ? `<div class="topbar__user"><span class="chip">${escape(options.user)}</span><a class="btn btn--ghost" href="/logout">Déconnexion</a></div>`
    : '';
  const titrePage = titre && !options.hideNav ? `<span class="topbar__ctx">${escape(titre)}</span>` : '';
  const retour = options.retour
    ? `<a class="backlink" href="${options.retour.href}">← ${escape(options.retour.label)}</a>`
    : '';
  // Bibliothèques d'origine de maides. jQuery/jQuery UI (autocomplétion, datepicker)
  // sur toutes les pages applicatives ; CKEditor/CodeMirror/jstree seulement si l'écran
  // utilise les widgets correspondants (évite de charger 5 Mo inutilement).
  const libs = options.libs ?? {};
  const vendorCss = options.hideNav ? '' :
    `<link rel="stylesheet" href="/vendor/jquery-ui.css" />`
    + (libs.tree ? `<link rel="stylesheet" href="/vendor/jstree/default/style.min.css" />` : '')
    + (libs.cm ? `<link rel="stylesheet" href="/vendor/codemirror/codemirror.css" />` : '');
  const vendorJs = options.hideNav ? '' :
    `<script src="/vendor/jquery.js"></script>`
    + `<script src="/vendor/jquery-ui.js"></script>`
    + (libs.tree ? `<script src="/vendor/jstree.min.js"></script>` : '')
    + (libs.ck ? `<script src="/vendor/ckeditor/ckeditor.js"></script>` : '')
    + (libs.cm ? `<script src="/vendor/codemirror/codemirror.js"></script><script src="/vendor/codemirror/javascript.js"></script>` : '');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(titre)} — Maxima</title>
<style>
  :root{
    --bg:#e6ebf2; --surface:#ffffff; --ink:#1b2433; --muted:#5d6b7e;
    --line:#d2dbe6; --line-strong:#b9c4d3;
    --brand:#21426b; --brand-2:#2d5a91; --brand-ink:#eaf1fb;
    --accent:#bd7a22; --accent-soft:#f6ecdb;
    --ok:#256c46; --ok-soft:#e3f1e9; --err:#b5302a; --err-soft:#f7e4e3; --warn:#9a6212; --warn-soft:#f8eccf;
    --radius:9px; --shadow:0 1px 2px rgba(27,36,51,.06), 0 6px 20px rgba(27,36,51,.05);
    --mono:ui-monospace,'Cascadia Code','SF Mono',Consolas,'Liberation Mono',monospace;
    --sans:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0; font-family:var(--sans); color:var(--ink); line-height:1.5;
    background-color:var(--bg);
    background-image:
      linear-gradient(rgba(33,66,107,.045) 1px,transparent 1px),
      linear-gradient(90deg,rgba(33,66,107,.045) 1px,transparent 1px);
    background-size:26px 26px;
  }
  a{color:var(--brand-2); text-decoration:none}
  a:hover{text-decoration:underline}

  /* Barre supérieure (bandeau de plan) */
  .topbar{
    position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:18px;
    padding:0 22px; height:56px; background:var(--brand); color:var(--brand-ink);
    border-bottom:2px solid var(--accent);
  }
  .brand{display:flex; align-items:baseline; gap:8px; color:#fff}
  .brand:hover{text-decoration:none}
  .brand b{font-size:18px; font-weight:800; letter-spacing:.04em}
  .brand i{font-family:var(--mono); font-style:normal; font-size:10px; letter-spacing:.28em; text-transform:uppercase; color:#aebfd6}
  .topbar__ctx{font-family:var(--mono); font-size:12px; color:#a9bbd3; letter-spacing:.04em; padding-left:18px; border-left:1px solid rgba(255,255,255,.18)}
  .topbar__user{margin-left:auto; display:flex; align-items:center; gap:14px; font-size:13px}
  .chip{font-family:var(--mono); font-size:12px; background:rgba(255,255,255,.12); padding:4px 10px; border-radius:999px}
  .topbar__logout{color:#cfe0f5}

  /* Conteneur */
  .shell{max-width:880px; margin:34px auto; padding:0 22px}
  h1{font-size:21px; font-weight:800; letter-spacing:-.01em; margin:0 0 4px}
  h2{font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:30px 0 12px}
  .eyebrow{font-family:var(--mono); font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--accent)}

  /* Carte (table à dessin : traits de coupe en signature) */
  .md-ecran,.card{
    position:relative; background:var(--surface); border:1px solid var(--line);
    border-radius:var(--radius); padding:22px 22px 18px; margin:0 0 18px; box-shadow:var(--shadow);
  }
  .md-ecran::before,.md-ecran::after{
    content:""; position:absolute; width:10px; height:10px; pointer-events:none;
    border:1.5px solid var(--accent);
  }
  .md-ecran::before{top:8px; left:8px; border-right:0; border-bottom:0}
  .md-ecran::after{bottom:8px; right:8px; border-left:0; border-top:0}

  /* Champs */
  .md-champ{display:flex; flex-direction:column; gap:5px; margin:0 0 14px}
  .md-champ>label{font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.01em}
  .md-champ input,.md-champ select,.md-champ textarea,
  .auth input{
    font-family:var(--sans); font-size:14px; color:var(--ink); background:#fff;
    border:1px solid var(--line-strong); border-radius:6px; padding:9px 11px; width:100%;
    transition:border-color .12s, box-shadow .12s;
  }
  .md-champ textarea{min-height:84px; resize:vertical}
  .md-champ input:focus,.md-champ select:focus,.md-champ textarea:focus,.auth input:focus{
    outline:none; border-color:var(--brand-2); box-shadow:0 0 0 3px rgba(45,90,145,.16);
  }
  .md-champ input[readonly]{background:#f3f6fa; color:var(--muted)}
  .md-erreur-champ input{border-color:var(--err); box-shadow:0 0 0 3px rgba(181,48,42,.12)}
  .md-erreur{color:var(--err); font-size:12px}
  code{font-family:var(--mono); font-size:12.5px; background:#eef2f7; padding:1px 6px; border-radius:4px; color:#33415a}

  /* Boutons */
  .md-toolbar{display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; padding-top:16px; border-top:1px dashed var(--line)}
  button,.btn{
    font-family:var(--sans); font-size:13.5px; font-weight:600; cursor:pointer;
    background:var(--brand); color:#fff; border:1px solid var(--brand); border-radius:6px; padding:9px 16px;
    transition:background .12s, transform .04s;
  }
  button:hover,.btn:hover{background:var(--brand-2); border-color:var(--brand-2)}
  button:active{transform:translateY(1px)}
  button.secondaire,.btn.secondaire{background:#fff; color:var(--brand); border-color:var(--line-strong)}
  button.secondaire:hover,.btn.secondaire:hover{background:#f1f5fa; border-color:var(--brand-2)}
  a.btn{display:inline-block; text-decoration:none}
  a.btn:hover{text-decoration:none; color:#fff}
  a.btn.secondaire:hover{color:var(--brand)}
  :focus-visible{outline:2px solid var(--accent); outline-offset:2px}

  /* Listes / tableaux (registre) */
  .md-liste{width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; font-size:13.5px}
  .md-liste th{font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.08em; text-align:left; color:var(--muted); background:#f3f6fa; padding:9px 12px; border-bottom:1px solid var(--line)}
  .md-liste td{padding:9px 12px; border-bottom:1px solid var(--line)}
  .md-liste tr:last-child td{border-bottom:0}
  .md-liste tbody tr:hover{background:#f7fafd}
  .md-liste td:first-child{font-family:var(--mono)}
  .md-liste form{margin:0}
  .md-liste button{background:transparent; color:var(--muted); border:0; padding:2px 6px; font-size:14px}
  .md-liste button:hover{color:var(--err); background:transparent}

  /* Listes du registre (recordList, dataReport, querabiliteList) : lignes cliquables */
  table.list,table.report-list{width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; font-size:13.5px; margin:6px 0}
  table.list th,table.report-list th{font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.08em; text-align:left; color:var(--muted); background:#f3f6fa; padding:9px 12px; border-bottom:1px solid var(--line)}
  table.list td,table.report-list td{padding:9px 12px; border-bottom:1px solid var(--line)}
  table.list tr:last-child td,table.report-list tr:last-child td{border-bottom:0}
  table.list tr[data-wrl-row]{cursor:pointer; transition:background .1s}
  table.list tr[data-wrl-row]:hover{background:#eef4fb}
  .querabilite-lib{margin-left:8px; color:var(--muted); font-size:13px}
  input.querabilite{width:auto; min-width:120px}
  button.querabilite-popup{padding:6px 10px; margin-left:6px}

  /* Arbre pliable */
  .md-arbre ul{list-style:none; margin:0; padding-left:18px}
  .md-arbre>ul{padding-left:0}
  .md-arbre li{margin:2px 0}
  .md-arbre-noeud{display:inline-flex; align-items:center; gap:6px; padding:2px 7px; border-radius:5px}
  .md-arbre li:has(>ul)>.md-arbre-noeud{cursor:pointer}
  .md-arbre li:has(>ul)>.md-arbre-noeud::before{content:"▾"; font-size:10px; color:var(--muted); width:10px; display:inline-block; text-align:center}
  .md-arbre li.plie:has(>ul)>.md-arbre-noeud::before{content:"▸"}
  .md-arbre li:not(:has(>ul))>.md-arbre-noeud{padding-left:18px}
  .md-arbre-noeud:hover{background:#f1f5fa}
  .md-arbre li.plie>ul{display:none}

  /* Tableaux éditables (editableArray) */
  table.editable-record-list{width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; font-size:13.5px; margin:6px 0}
  table.editable-record-list th{font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.06em; text-align:left; color:var(--muted); background:#f3f6fa; padding:7px 10px; border-bottom:1px solid var(--line)}
  table.editable-record-list td{padding:4px 8px; border-bottom:1px solid var(--line); vertical-align:top}
  table.editable-record-list input{width:100%}
  td.md-ea-actions{white-space:nowrap; width:1%}
  .md-ea-actions button{background:transparent; color:var(--muted); border:0; padding:3px 7px; font-size:14px}
  .md-ea-actions .md-ea-save:hover{color:var(--ok)} .md-ea-actions .md-ea-suppr:hover{color:var(--err)}
  .md-ea-barre{margin:6px 0 14px}
  .md-ea-barre .md-ea-add{background:#fff; color:var(--brand); border:1px dashed var(--line-strong); font-weight:600}
  .md-ea-barre .md-ea-add:hover{background:#f1f5fa; border-color:var(--brand-2)}
  tr.md-erreur-champ input,input.md-erreur-champ{border-color:var(--err); box-shadow:0 0 0 2px rgba(181,48,42,.12)}
  .error-label{display:inline-block; background:var(--err-soft); color:var(--err); font-size:11px; padding:1px 6px; border-radius:5px; margin-top:2px}

  /* Texte riche (équivalent CKEditor) */
  .md-rt{border:1px solid var(--line-strong); border-radius:7px; overflow:hidden; background:#fff}
  .md-rt-bar{display:flex; gap:2px; padding:5px; background:#f3f6fa; border-bottom:1px solid var(--line)}
  .md-rt-b{background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:5px; padding:3px 9px; font-size:12px; font-weight:600}
  .md-rt-b:hover{background:var(--brand); color:#fff; border-color:var(--brand)}
  .md-rt-ed{min-height:140px; padding:10px 12px; font-size:14px; line-height:1.5; outline:none}
  .md-rt-ed:focus{box-shadow:inset 0 0 0 2px rgba(45,90,145,.12)}

  /* Éditeur de code (équivalent CodeMirror) */
  textarea.md-codeeditor.md-code-actif{font-family:var(--mono); font-size:12.5px; line-height:1.5; tab-size:2; background:#1b2433; color:#e6ecf5; border-color:#33415a; min-height:160px; white-space:pre}

  /* Arbre : feuille sélectionnée */
  .md-arbre-noeud.sel{background:var(--brand); color:#fff}

  /* Quérabilité : libellé introuvable */
  .querabilite-lib.md-lookup-ko{color:var(--err); font-weight:600}

  /* Notifications transitoires (toasts) */
  .md-toast{position:fixed; right:18px; bottom:18px; z-index:6000; background:var(--ink); color:#fff; padding:10px 16px; border-radius:8px; box-shadow:var(--shadow); font-size:13.5px; margin-top:8px; opacity:1; transition:opacity .3s, transform .3s}
  .md-toast--succes{background:var(--ok)} .md-toast--erreur{background:var(--err)} .md-toast--attention{background:var(--warn)}
  .md-toast.part{opacity:0; transform:translateY(8px)}

  /* Téléversement GED (équivalent scanner) */
  .md-upload{display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:14px; border:1px dashed var(--line-strong); border-radius:8px; background:#fafbfd}
  .md-upload-etat{font-size:12px; color:var(--muted)}
  .md-upload-ok{color:var(--ok); font-weight:600; margin-bottom:8px}
  .md-zone-img{max-width:100%; border:1px solid var(--line); border-radius:6px}
  .md-doc-vide{color:var(--muted); font-style:italic; padding:14px}

  /* Modales (confirmation, recherche) */
  .md-dialog{border:1px solid var(--line-strong); border-radius:12px; padding:0; box-shadow:var(--shadow); width:min(440px,92vw); background:#fff; color:var(--ink)}
  .md-dialog::backdrop{background:rgba(20,32,52,.4)}
  .md-dialog__t{font-size:15px; font-weight:700; margin:0; padding:16px 18px 0}
  .md-dialog__msg{margin:0; padding:20px 18px; font-size:14px; line-height:1.5}
  .md-dialog__q{display:block; margin:14px 18px; width:calc(100% - 36px); padding:9px 11px; border:1px solid var(--line-strong); border-radius:7px; font-size:14px; font-family:var(--sans)}
  .md-dialog__res{max-height:46vh; overflow:auto; padding:0 18px 4px}
  .md-dialog__res .aide{padding:0 0 10px; margin:0}
  .md-dialog__res .md-liste{margin:0 0 8px}
  .md-dialog__actions{display:flex; justify-content:flex-end; gap:10px; padding:14px 18px; border-top:1px solid var(--line); background:#fafbfd; border-radius:0 0 12px 12px}

  /* Messages */
  .msgs{display:flex; flex-direction:column; gap:8px; margin:0 0 18px}
  .msg{display:flex; align-items:center; gap:10px; font-size:13.5px; padding:10px 13px; border-radius:7px; border:1px solid var(--line); background:#fff}
  .msg__i{display:grid; place-items:center; width:18px; height:18px; border-radius:999px; font-size:11px; font-weight:700; color:#fff; background:var(--muted)}
  .msg--succes{background:var(--ok-soft); border-color:#bfe0cd} .msg--succes .msg__i{background:var(--ok)}
  .msg--erreur{background:var(--err-soft); border-color:#eccac8} .msg--erreur .msg__i{background:var(--err)}
  .msg--attention{background:var(--warn-soft); border-color:#ecd8ac} .msg--attention .msg__i{background:var(--warn)}

  /* Menu (établi) */
  ul.menu{list-style:none; margin:0; padding:0; display:grid; gap:10px}
  ul.menu li{margin:0}
  ul.menu>li>a,ul.menu>li>span{
    display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--line);
    border-left:3px solid var(--accent); border-radius:8px; padding:13px 16px; color:var(--ink);
    font-weight:600; box-shadow:var(--shadow); transition:border-color .12s, transform .04s;
  }
  ul.menu>li>a::before{content:"→"; color:var(--accent); font-family:var(--mono)}
  ul.menu>li>a:hover{text-decoration:none; border-color:var(--brand-2); transform:translateX(2px)}
  ul.menu ul{list-style:none; margin:6px 0 0 18px; padding:0; display:grid; gap:6px}
  ul.menu ul a{font-weight:500; font-size:13.5px}

  .lede{color:var(--muted); margin:0 0 22px; max-width:60ch}
  .crumbs{font-family:var(--mono); font-size:12px; color:var(--muted); margin:0 0 16px}
  .crumbs a{color:var(--muted)}
  h1 .badge{font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.04em; vertical-align:middle;
    color:var(--brand-2); background:var(--brand-ink); border:1px solid var(--line); border-radius:999px; padding:3px 10px; margin-left:8px}

  /* Navigation persistante (bandeau) */
  .topnav{display:flex; gap:4px; padding-left:16px; border-left:1px solid rgba(255,255,255,.18)}
  .topnav__a{color:#cfddf0; font-size:13px; font-weight:600; padding:6px 12px; border-radius:6px}
  .topnav__a:hover{text-decoration:none; background:rgba(255,255,255,.10); color:#fff}
  .topnav__a.is-actif{background:rgba(255,255,255,.16); color:#fff}
  .btn--ghost{background:transparent; border:1px solid rgba(255,255,255,.28); color:#eaf1fb; padding:6px 12px; font-size:12.5px}
  .btn--ghost:hover{background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.5); color:#fff}

  /* Lien de retour (en tête de contenu) */
  .backlink{display:inline-flex; align-items:center; gap:6px; font-family:var(--mono); font-size:12.5px;
    color:var(--brand-2); background:#fff; border:1px solid var(--line); border-radius:999px; padding:6px 14px; margin:0 0 18px}
  .backlink:hover{text-decoration:none; border-color:var(--brand-2); background:#f1f5fa}

  /* Lanceur d'applications (menu en tuiles) */
  .launcher-grp{margin:0 0 26px}
  .launcher-grp h2{margin:0 0 12px}
  .tiles{display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px}
  .tile{display:flex; align-items:center; gap:12px; background:#fff; border:1px solid var(--line);
    border-left:3px solid var(--accent); border-radius:9px; padding:15px 16px; color:var(--ink);
    font-weight:600; box-shadow:var(--shadow); transition:border-color .12s, transform .05s, box-shadow .12s}
  .tile:hover{text-decoration:none; border-color:var(--brand-2); transform:translateY(-1px);
    box-shadow:0 2px 4px rgba(27,36,51,.08),0 10px 26px rgba(27,36,51,.08)}
  .tile__ico{display:grid; place-items:center; width:34px; height:34px; flex:0 0 34px; border-radius:8px;
    background:var(--accent-soft); color:var(--accent); font-family:var(--mono); font-size:16px}
  .tile__txt{display:flex; flex-direction:column; gap:1px; min-width:0}
  .tile__lbl{font-size:14px}
  .tile__sub{font-family:var(--mono); font-size:11px; font-weight:500; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
  .vide{color:var(--muted); font-style:italic; background:#fff; border:1px dashed var(--line-strong); border-radius:9px; padding:16px}

  /* Accompagnement : héros d'accueil, étapes, aides contextuelles */
  .hero{background:linear-gradient(180deg,#fff, #f7faff); border:1px solid var(--line); border-left:3px solid var(--brand-2);
    border-radius:var(--radius); padding:22px 22px 20px; margin:0 0 22px; box-shadow:var(--shadow)}
  .hero h1{margin:2px 0 6px}
  .hero p{color:var(--muted); margin:0 0 16px; max-width:62ch}
  .cta{display:inline-flex; align-items:center; gap:8px; font-size:14px; font-weight:700;
    background:var(--accent); border-color:var(--accent); color:#fff; padding:11px 18px}
  .cta:hover{background:#a86a1c; border-color:#a86a1c; color:#fff; text-decoration:none}

  .steps{display:grid; gap:12px; margin:0 0 8px}
  .step{display:flex; gap:14px; align-items:flex-start; background:#fff; border:1px solid var(--line);
    border-radius:9px; padding:16px 18px; box-shadow:var(--shadow)}
  .step__n{flex:0 0 30px; display:grid; place-items:center; width:30px; height:30px; border-radius:999px;
    background:var(--brand); color:#fff; font-weight:800; font-family:var(--mono)}
  .step__b{min-width:0}
  .step__b h3{margin:2px 0 4px; font-size:15px}
  .step__b p{margin:0; color:var(--muted); font-size:13.5px; line-height:1.5}

  .aide{font-size:12px; color:var(--muted); margin:4px 0 0; line-height:1.45}
  .aide code{font-size:11.5px}
  .guide-section{margin:0 0 22px}
  .guide-section p{color:var(--ink); line-height:1.6}
  .kbd{font-family:var(--mono); font-size:12px; background:#eef2f7; border:1px solid var(--line); border-bottom-width:2px; border-radius:5px; padding:1px 7px}

  /* Connexion */
  .auth-wrap{min-height:calc(100vh - 56px); display:grid; place-items:center; padding:22px}
  .auth{width:min(380px,100%); background:#fff; border:1px solid var(--line); border-radius:12px; padding:30px 28px; box-shadow:var(--shadow); position:relative}
  .auth h1{margin:0 0 2px}
  .auth .eyebrow{display:block; margin-bottom:18px}
  .auth label{display:block; font-size:12px; font-weight:600; color:var(--muted); margin:0 0 5px}
  .auth .md-champ{margin-bottom:16px}

  @media (max-width:560px){ .topbar__ctx{display:none} .shell{margin:22px auto} }
  @media (prefers-reduced-motion:reduce){ *{transition:none!important} }
</style>
${vendorCss}
</head>
<body>
<header class="topbar">${marque}${nav}${titrePage}${actions}</header>
<main class="shell">
<div id="md-vue">
${retour}
${renderMessages(messages)}
${contenu}
</div>
</main>
${vendorJs}
<script type="module" src="/maides-client.js"></script>
</body>
</html>`;
}

/** Fragment HTML (contenu de #md-vue) renvoyé lors d'un échange AJAX. */
export function renderFragment(contenu: string, messages: ExpMessage[] = []): string {
  return renderMessages(messages) + contenu;
}

/** Page de connexion (mise en page centrée dédiée). */
export function renderAuthPage(corps: string): string {
  return renderPage('Connexion', `<div class="auth-wrap">${corps}</div>`, [], { hideNav: true });
}

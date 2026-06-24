/**
 * Rendu HTML des widgets (port modernisé de jyWidget.php).
 *
 * Chaque type de widget produit le HTML d'un contrôle de formulaire. Le rendu
 * est extensible via un registre (comme le registre de fonctions du langage),
 * pour ajouter de nouveaux widgets sans modifier le moteur.
 */

import { Widget } from '../runtime/ecran.js';
import { escapeHtml, attrs } from './html.js';

/**
 * Accès aux données pour les widgets liés (selectTable/Fic, recordList,
 * selectList, dataReport, querabilite, selectAggregate, sous-écrans).
 * Injecté par le runtime ; les widgets dégradent proprement s'il est absent.
 */
export interface WidgetDataAcces {
  /** Options d'une table de paramètres 'tab' (port de lireTable : WHERE tab1=table). */
  lireTable?(nomTable: string): { cle: string; libelle: string }[];
  /** Options depuis une table/vue (port de lireFic). */
  lireFic?(spec: { table: string; cle: string; libelle?: string; filtre?: string; tri?: string }): { value: string; libelle: string }[];
  /** Enregistrements d'une table/vue (recordList, selectList, dataReport, querabiliteList). */
  lignes?(spec: { table: string; filtre?: string; tri?: string }): Record<string, any>[];
  /** Agrégat (selectAggregate). */
  aggregate?(op: string, table: string, champ: string, filtre: string): number;
  /** Noms de champs d'une table (listeVariables). */
  champsDe?(table: string): string[];
  /** Rend un sous-écran (execScreen, editableArray, sousEcranMulti). */
  rendSousEcran?(nomEcran: string, valeurs: Record<string, any>): string;
  /** URL d'accès à un document attaché (zoneDoc/zonePDF/zoneImg). */
  urlDocument?(table: string, cle: string, champ: string): string;
}

export interface RenderContexte {
  nomChamp: string;
  widget: Widget;
  valeur: any;
  /** Messages d'erreur du champ (validation). */
  erreurs?: string[];
  /** Mode lecture seule global (ex. ordre visu o1). */
  lectureSeule?: boolean;
  /** Accès données pour les widgets liés. */
  acces?: WidgetDataAcces;
  /** Clé du document courant (pour les liens / documents). */
  cle?: string;
}

/**
 * Lit les options d'un widget : attributs directs + parsing de la chaine
 * `option_type_widget` (lignes `clé=valeur`, port de nettoyageOptionsWidget).
 */
export function lireOptions(widget: Widget): Record<string, string> {
  const opts: Record<string, string> = {};
  const brut = widget.option_type_widget;
  if (typeof brut === 'string') {
    for (const ligne of brut.split(/\r?\n/)) {
      const idx = ligne.indexOf('=');
      if (idx > 0) opts[ligne.slice(0, idx).trim()] = ligne.slice(idx + 1).trim();
    }
  } else if (brut && typeof brut === 'object') {
    Object.assign(opts, brut);
  }
  return opts;
}

/** Signature d'un moteur de rendu de widget : renvoie le HTML du contrôle. */
export type WidgetRenderer = (ctx: RenderContexte) => string;

const renderers: Record<string, WidgetRenderer> = {};
const enregistre = (type: string, r: WidgetRenderer) => { renderers[type] = r; };

function estLectureSeule(ctx: RenderContexte): boolean {
  return ctx.lectureSeule === true || ctx.widget.est_lecture_seule === 1;
}

function baseAttrs(ctx: RenderContexte, extra: Record<string, any> = {}): Record<string, any> {
  return {
    name: ctx.nomChamp,
    id: ctx.nomChamp,
    class: ctx.widget.css_class || null,
    title: ctx.widget.title || null,
    tabindex: ctx.widget.tabindex || null,
    // indices pour la validation côté client
    required: ctx.widget.est_notnull === 1 ? true : null,
    'data-md-type': ctx.widget.type_champ || ctx.widget.type_widget || null,
    'data-md-min': ctx.widget.val_min ?? null,
    'data-md-max': ctx.widget.val_max ?? null,
    ...extra,
  };
}

/* ------------------------- widgets standard ------------------------- */

enregistre('text', (ctx) => {
  const ro = estLectureSeule(ctx);
  return `<input${attrs(baseAttrs(ctx, {
    type: 'text', value: ctx.valeur ?? '', readonly: ro,
    maxlength: ctx.widget.option_type_champ || null,
  }))} />`;
});

enregistre('integer', (ctx) => {
  return `<input${attrs(baseAttrs(ctx, {
    type: 'number', step: '1', value: ctx.valeur ?? '', readonly: estLectureSeule(ctx),
    min: ctx.widget.val_min || null, max: ctx.widget.val_max || null,
  }))} />`;
});

enregistre('decimal', (ctx) => {
  return `<input${attrs(baseAttrs(ctx, {
    type: 'number', step: 'any', value: ctx.valeur ?? '', readonly: estLectureSeule(ctx),
    min: ctx.widget.val_min || null, max: ctx.widget.val_max || null,
  }))} />`;
});

enregistre('date', (ctx) => {
  return `<input${attrs(baseAttrs(ctx, {
    type: 'date', value: ctx.valeur ?? '', readonly: estLectureSeule(ctx),
  }))} />`;
});

enregistre('textarea', (ctx) => {
  return `<textarea${attrs(baseAttrs(ctx, { readonly: estLectureSeule(ctx) }))}>${escapeHtml(ctx.valeur ?? '')}</textarea>`;
});

enregistre('hidden', (ctx) => {
  return `<input${attrs({ type: 'hidden', name: ctx.nomChamp, id: ctx.nomChamp, value: ctx.valeur ?? '' })} />`;
});

enregistre('boolean', (ctx) => {
  const coche = ctx.valeur === 1 || ctx.valeur === '1' || ctx.valeur === true;
  return `<input${attrs(baseAttrs(ctx, { type: 'checkbox', value: '1', checked: coche, disabled: estLectureSeule(ctx) }))} />`;
});

enregistre('select', (ctx) => {
  const options: { value: any; libelle: any }[] = ctx.widget.options ?? [];
  const opts = options.map((o) => {
    const sel = String(o.value) === String(ctx.valeur);
    return `<option${attrs({ value: o.value, selected: sel })}>${escapeHtml(o.libelle ?? o.value)}</option>`;
  }).join('');
  return `<select${attrs(baseAttrs(ctx, { disabled: estLectureSeule(ctx) }))}>${opts}</select>`;
});

enregistre('label', (ctx) => `<span${attrs(baseAttrs(ctx))}>${escapeHtml(ctx.valeur ?? '')}</span>`);

enregistre('button', (ctx) => {
  return `<button${attrs(baseAttrs(ctx, { type: 'button' }))}>${escapeHtml(ctx.widget.libelle ?? ctx.nomChamp)}</button>`;
});

enregistre('ordreBoutonObe', (ctx) => {
  // logique de soumission OBE (port de wBoutonOBE) : o/b/e/m/n/p + confirm
  const opt = lireOptions(ctx.widget);
  const g = (k: string): string => String(ctx.widget[k] ?? opt[k] ?? '');
  const data: Record<string, any> = {
    type: 'button', class: 'button md-obe',
    'data-o': g('o') || null, 'data-b': g('b') || null, 'data-e': g('e') || null,
    'data-m': g('m') || null, 'data-n': g('n') || null, 'data-p': g('p') || null,
    'data-confirm': g('confirm') || null,
  };
  const lib = String(ctx.widget.libelle ?? opt['libelle'] ?? ctx.nomChamp);
  // libellé [x] -> raccourci souligné (port de la convention PHP)
  const html = lib.replace(/\[([^\]]+)\]/g, '<u>$1</u>');
  return `<button${attrs(data)}>${html}</button>`;
});

/** Bouton de fermeture (popup/dialogue) — port de wBoutonClose. */
enregistre('buttonClose', (ctx) =>
  `<button${attrs({ type: 'button', class: 'button secondaire md-close', 'data-md-close': '1', id: ctx.nomChamp })}>${escapeHtml(ctx.widget.libelle ?? 'Fermer')}</button>`);

/** Champs de recherche legacy (autocomplete via web services bax_webs). */
const champRecherche = (mode: string): WidgetRenderer => (ctx) =>
  `<input${attrs(baseAttrs(ctx, { type: 'search', class: `text md-${mode}`, value: ctx.valeur ?? '', 'data-search': mode, autocomplete: 'off', readonly: estLectureSeule(ctx) }))} />`;
enregistre('bigSearch', champRecherche('bigSearch'));
enregistre('simpleSearch', champRecherche('simpleSearch'));
enregistre('fullSearch', champRecherche('fullSearch'));

enregistre('richtext', (ctx) => {
  // zone éditable enrichie : une lib front (ex. CKEditor) rehausse .md-richtext
  return `<textarea${attrs(baseAttrs(ctx, { class: `md-richtext ${ctx.widget.css_class ?? ''}`.trim(), readonly: estLectureSeule(ctx) }))}>${escapeHtml(ctx.valeur ?? '')}</textarea>`;
});

enregistre('file', (ctx) => {
  const cache = `<input${attrs({ type: 'hidden', name: ctx.nomChamp, id: ctx.nomChamp, value: ctx.valeur ?? '' })} />`;
  return `${cache}<input${attrs(baseAttrs(ctx, { name: `${ctx.nomChamp}__upload`, id: `${ctx.nomChamp}__upload`, type: 'file', disabled: estLectureSeule(ctx) }))} />`;
});

enregistre('image', (ctx) => {
  const src = ctx.valeur ?? '';
  if (!src) return `<span class="md-image-vide" id="${ctx.nomChamp}"></span>`;
  return `<img${attrs({ id: ctx.nomChamp, src, alt: ctx.widget.libelle ?? ctx.nomChamp, class: ctx.widget.css_class ?? 'md-image' })} />`;
});

enregistre('array', (ctx) => {
  const lignes: any[] = Array.isArray(ctx.valeur) ? ctx.valeur : [];
  const corps = lignes.map((v, i) =>
    `<tr><td><input${attrs({ name: `${ctx.nomChamp}[${i}]`, value: v ?? '', readonly: estLectureSeule(ctx) })} /></td></tr>`,
  ).join('');
  return `<table class="md-array" id="${ctx.nomChamp}"><tbody>${corps}</tbody></table>`;
});

/* ------------------------- types de saisie additionnels ------------------------- */

const inputSimple = (type: string): WidgetRenderer => (ctx) =>
  `<input${attrs(baseAttrs(ctx, { type, value: ctx.valeur ?? '', readonly: estLectureSeule(ctx) }))} />`;

enregistre('password', inputSimple('password'));
enregistre('email', inputSimple('email'));
enregistre('tel', inputSimple('tel'));
enregistre('url', inputSimple('url'));
enregistre('color', inputSimple('color'));
enregistre('time', inputSimple('time'));
enregistre('datetime', inputSimple('datetime-local'));

enregistre('range', (ctx) =>
  `<input${attrs(baseAttrs(ctx, { type: 'range', value: ctx.valeur ?? '', min: ctx.widget.val_min ?? 0, max: ctx.widget.val_max ?? 100, disabled: estLectureSeule(ctx) }))} />`);

/** Montant : affichage formaté en lecture, saisie numérique sinon. */
enregistre('montant', (ctx) => {
  if (estLectureSeule(ctx)) {
    const n = Number(ctx.valeur) || 0;
    const fmt = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<span class="md-montant" id="${ctx.nomChamp}">${escapeHtml(fmt)}${ctx.widget.devise ? ' ' + escapeHtml(ctx.widget.devise) : ''}</span>`;
  }
  return `<input${attrs(baseAttrs(ctx, { type: 'number', step: '0.01', value: ctx.valeur ?? '' }))} />`;
});

/** Boutons radio à partir des options. */
enregistre('radio', (ctx) => {
  const options: { value: any; libelle: any }[] = ctx.widget.options ?? [];
  return `<span class="md-radios" id="${ctx.nomChamp}">${options.map((o, i) => {
    const checked = String(o.value) === String(ctx.valeur);
    return `<label class="md-radio"><input${attrs({ type: 'radio', name: ctx.nomChamp, id: `${ctx.nomChamp}_${i}`, value: o.value, checked, disabled: estLectureSeule(ctx) })} /> ${escapeHtml(o.libelle ?? o.value)}</label>`;
  }).join('')}</span>`;
});

/** Groupe de cases à cocher (valeur = tableau). */
enregistre('checkboxGroup', (ctx) => {
  const options: { value: any; libelle: any }[] = ctx.widget.options ?? [];
  const valeurs: any[] = Array.isArray(ctx.valeur) ? ctx.valeur : [];
  return `<span class="md-checks" id="${ctx.nomChamp}">${options.map((o, i) => {
    const checked = valeurs.map(String).includes(String(o.value));
    return `<label class="md-check"><input${attrs({ type: 'checkbox', name: `${ctx.nomChamp}[${i}]`, value: o.value, checked, disabled: estLectureSeule(ctx) })} /> ${escapeHtml(o.libelle ?? o.value)}</label>`;
  }).join('')}</span>`;
});

/** Sélection multiple. */
enregistre('multiselect', (ctx) => {
  const options: { value: any; libelle: any }[] = ctx.widget.options ?? [];
  const valeurs = (Array.isArray(ctx.valeur) ? ctx.valeur : []).map(String);
  const opts = options.map((o) => `<option${attrs({ value: o.value, selected: valeurs.includes(String(o.value)) })}>${escapeHtml(o.libelle ?? o.value)}</option>`).join('');
  return `<select multiple${attrs(baseAttrs(ctx, { disabled: estLectureSeule(ctx) }))}>${opts}</select>`;
});

/** Lien hypertexte (value = URL, libelle = texte). */
enregistre('lien', (ctx) =>
  `<a${attrs({ id: ctx.nomChamp, href: ctx.valeur || '#', class: ctx.widget.css_class || null })}>${escapeHtml(ctx.widget.libelle ?? ctx.valeur)}</a>`);

/** Titre / séparateur de section (pas un champ de saisie). */
enregistre('titre', (ctx) => `<h3 class="md-titre" id="${ctx.nomChamp}">${escapeHtml(ctx.widget.libelle ?? '')}</h3>`);
enregistre('separateur', () => '<hr class="md-sep" />');

/** Sous-écran : injecte le rendu du sous-écran (port d'execScreen). */
enregistre('execScreen', (ctx) => {
  const o = lireOptions(ctx.widget);
  const nomEcran = o['secran'] ?? o['ecran'] ?? (typeof ctx.widget.option_type_widget === 'string' && !ctx.widget.option_type_widget.includes('=') ? ctx.widget.option_type_widget : '') ?? '';
  const contenu = ctx.acces?.rendSousEcran && nomEcran
    ? ctx.acces.rendSousEcran(nomEcran, (ctx.valeur && typeof ctx.valeur === 'object') ? ctx.valeur : {})
    : escapeHtml(ctx.valeur ?? '');
  return `<div class="md-sous-ecran" id="${ctx.nomChamp}" data-sous-ecran="${escapeHtml(nomEcran)}">${contenu}</div>`;
});

/* ------------------------- spéciaux / affichage ------------------------- */

/** Affichage pur d'une valeur (jamais éditable). */
enregistre('display', (ctx) => `<span${attrs(baseAttrs(ctx, { class: 'text' }))}>${escapeHtml(ctx.valeur ?? '')}</span>`);

/** Zone de texte statique (contenu via option `contenu`). */
enregistre('textZone', (ctx) => `<span${attrs(baseAttrs(ctx))}>${escapeHtml(lireOptions(ctx.widget)['contenu'] ?? ctx.widget.contenu ?? '')}</span>`);

/** Compteur auto-incrémenté (lecture seule). */
enregistre('autoInc', (ctx) => `<span${attrs(baseAttrs(ctx))}>${escapeHtml(ctx.valeur ?? '(auto)')}</span>`);

/** Span visible + input caché synchronisés (port de hiddenData). */
enregistre('hiddenData', (ctx) => {
  const id = ctx.nomChamp;
  return `<span id="${id}_lib" class="md-hiddendata">${escapeHtml(ctx.valeur ?? '')}</span>`
    + `<input${attrs({ type: 'hidden', name: id, id, value: ctx.valeur ?? '' })} />`;
});

/** Monnaie (port de currency) : symbole DEVISE, formaté en lecture. */
enregistre('currency', (ctx) => {
  const o = lireOptions(ctx.widget);
  const symbole = o['symbole'] ?? ctx.widget.devise ?? '€';
  if (estLectureSeule(ctx)) {
    const n = Number(ctx.valeur) || 0;
    const fmt = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<span class="md-currency" id="${ctx.nomChamp}">${escapeHtml(fmt)} ${escapeHtml(symbole)}</span>`;
  }
  return `<input${attrs(baseAttrs(ctx, { type: 'number', step: 'any', value: ctx.valeur ?? '' }))} /> <span class="md-devise">${escapeHtml(symbole)}</span>`;
});

/** Cadre externe (port de iFrame). */
enregistre('iFrame', (ctx) => {
  const o = lireOptions(ctx.widget);
  const url = o['url'] ?? ctx.widget.url ?? ctx.valeur ?? '';
  return `<iframe${attrs({ id: ctx.nomChamp, src: url, class: 'md-iframe', width: o['largeur'] ?? null, height: o['hauteur'] ?? null })}></iframe>`;
});

/* ------------------------- éditeurs riches ------------------------- */

enregistre('CKEditor', (ctx) =>
  `<textarea${attrs(baseAttrs(ctx, { class: `md-ckeditor ${ctx.widget.css_class ?? ''}`.trim(), readonly: estLectureSeule(ctx) }))}>${escapeHtml(ctx.valeur ?? '')}</textarea>`);

enregistre('codeEditor', (ctx) => {
  const o = lireOptions(ctx.widget);
  return `<textarea${attrs(baseAttrs(ctx, { class: 'md-codeeditor', 'data-mode': o['mode'] ?? 'javascript', 'data-readonly': estLectureSeule(ctx) ? '1' : null }))}>${escapeHtml(ctx.valeur ?? '')}</textarea>`;
});

/* ------------------------- selects liés aux données ------------------------- */

function optionsHtml(options: { value: any; libelle: any }[], valeur: any, ajoutVide: boolean): string {
  const vide = ajoutVide ? '<option value=""></option>' : '';
  return vide + options.map((o) =>
    `<option${attrs({ value: o.value, selected: String(o.value) === String(valeur) })}>${escapeHtml(o.libelle ?? o.value)}</option>`).join('');
}

/** Select sourcé d'une table de paramètres 'tab' (port de selectTable). */
enregistre('selectTable', (ctx) => {
  const o = lireOptions(ctx.widget);
  const table = o['table'] ?? ctx.widget.table ?? '';
  const lignes = ctx.acces?.lireTable?.(table) ?? [];
  const cacheCle = o['cache_cle'] === '1';
  const options = lignes.map((l) => ({ value: l.cle, libelle: cacheCle ? l.libelle : `${l.cle} - ${l.libelle}` }));
  return `<select${attrs(baseAttrs(ctx, { class: 'text select', disabled: estLectureSeule(ctx) }))}>${optionsHtml(options, ctx.valeur, o['lvide'] === '1')}</select>`;
});

/** Select (ou saisie libre) sourcé d'une table/vue (port de selectFic). */
enregistre('selectFic', (ctx) => {
  const o = lireOptions(ctx.widget);
  const spec = { table: o['table'] ?? ctx.widget.table ?? '', cle: o['cle'] ?? ctx.widget.cle ?? '', libelle: o['libelle'], filtre: o['filtre'], tri: o['tri'] };
  const lignes = ctx.acces?.lireFic?.(spec) ?? [];
  const options = lignes.map((l) => ({ value: l.value, libelle: l.libelle }));
  if (o['editable'] === '1') {
    const listId = `${ctx.nomChamp}_list`;
    const dl = `<datalist id="${listId}">${options.map((op2) => `<option${attrs({ value: op2.value })}>${escapeHtml(op2.libelle)}</option>`).join('')}</datalist>`;
    return `<input${attrs(baseAttrs(ctx, { list: listId, value: ctx.valeur ?? '', readonly: estLectureSeule(ctx) }))} />${dl}`;
  }
  return `<select${attrs(baseAttrs(ctx, { class: 'text select', disabled: estLectureSeule(ctx) }))}>${optionsHtml(options, ctx.valeur, o['lvide'] === '1')}</select>`;
});

/** Résultat d'agrégat affiché (port de selectAggregate). */
enregistre('selectAggregate', (ctx) => {
  const o = lireOptions(ctx.widget);
  const res = ctx.acces?.aggregate?.(o['operation'] ?? 'somme', o['table'] ?? '', o['champ'] ?? '', o['filtre'] ?? '') ?? 0;
  return `<span${attrs(baseAttrs(ctx, { class: 'md-aggregate' }))}>${escapeHtml(res)}</span>`;
});

/** Liste d'aide aux variables d'une table (port de listeVariables). */
enregistre('listeVariables', (ctx) => {
  const o = lireOptions(ctx.widget);
  const champs = ctx.acces?.champsDe?.(o['table'] ?? ctx.widget.table ?? '') ?? [];
  return `<input${attrs(baseAttrs(ctx, { value: ctx.valeur ?? '', readonly: estLectureSeule(ctx), 'data-variables': champs.join(',') }))} />`;
});

/* ------------------------- listes / tableaux liés ------------------------- */

function colonnesDepuisOption(spec: string | undefined): { champ: string; libelle: string }[] {
  if (!spec) return [];
  // format "dbcol:Label;dbcol2:Label2"
  return spec.split(';').filter(Boolean).map((c) => {
    const [champ, libelle] = c.split(':');
    return { champ: (champ ?? '').trim(), libelle: (libelle ?? champ ?? '').trim() };
  });
}

function renderTableListe(ctx: RenderContexte, lignes: Record<string, any>[], classe: string): string {
  const o = lireOptions(ctx.widget);
  let colonnes = colonnesDepuisOption(o['cols']);
  if (colonnes.length === 0 && lignes.length > 0) {
    colonnes = Object.keys(lignes[0]!).filter((k) => !k.startsWith('_')).map((k) => ({ champ: k, libelle: k }));
  }
  const ecranCible = o['ecran'] ?? ctx.widget.e ?? '';
  const thead = colonnes.map((c) => `<th>${escapeHtml(c.libelle)}</th>`).join('');
  const corps = lignes.map((rec) => {
    const cle = rec['__cle__'] ?? rec['_id'] ?? '';
    const onclick = ecranCible ? ` onclick="goPage('?o=1&amp;e=${escapeHtml(ecranCible)}&amp;b=${escapeHtml(cle)}')"` : '';
    const cells = colonnes.map((c) => `<td>${escapeHtml(rec[c.champ] ?? '')}</td>`).join('');
    return `<tr data-wrl-row${onclick}>${cells}</tr>`;
  }).join('');
  return `<table${attrs({ id: ctx.nomChamp, class: classe })}><thead><tr>${thead}</tr></thead><tbody>${corps}</tbody></table>`;
}

/** Liste d'enregistrements depuis une vue (port de recordList). */
enregistre('recordList', (ctx) => {
  const o = lireOptions(ctx.widget);
  const lignes = ctx.acces?.lignes?.({ table: o['index'] ?? ctx.widget.index ?? '', filtre: o['filtre'], tri: o['tri'] }) ?? [];
  return renderTableListe(ctx, lignes, 'list record-list');
});

/** Liste construite par sélection sur une table (port de selectList). */
enregistre('selectList', (ctx) => {
  const o = lireOptions(ctx.widget);
  const lignes = ctx.acces?.lignes?.({ table: o['table'] ?? ctx.widget.table ?? '', filtre: o['filtre'], tri: o['tri'] }) ?? [];
  return renderTableListe(ctx, lignes, 'list record-list');
});

/** Liste depuis un tableau en mémoire (port de arrayList). */
enregistre('arrayList', (ctx) => {
  const lignes: Record<string, any>[] = Array.isArray(ctx.valeur) ? ctx.valeur : [];
  return renderTableListe(ctx, lignes, 'list record-list array');
});

/** Rapport paginé depuis une requête (port de dataReport). */
enregistre('dataReport', (ctx) => {
  const o = lireOptions(ctx.widget);
  const lignes = ctx.acces?.lignes?.({ table: o['requete'] ?? ctx.widget.requete ?? '', filtre: o['filtre'], tri: o['tri'] }) ?? [];
  const parPage = Number(o['ligne_par_page'] ?? 30);
  return renderTableListe({ ...ctx, widget: { ...ctx.widget, option_type_widget: ctx.widget.option_type_widget } }, lignes.slice(0, parPage), 'report-list');
});

/* ------------------------- tableaux éditables / sous-écrans ------------------------- */

/** Tableau éditable multi-lignes via un sous-écran (port de editableArray).
 *  Chaque ligne est un sous-document du sous-écran `secran`, enregistré/supprimé
 *  à la ligne via l'endpoint OBE (?o=9 / ?o=4). Structure fidèle au legacy :
 *  - <tr class="ligne-multi-container" data-e data-b data-tag>
 *  - cellules <input data-eaf data-name data-col name="_ml_<champ>[<cle>]">
 *  - ligne-modèle cachée data-template="insert" (clonée côté client à l'ajout). */
enregistre('editableArray', (ctx) => {
  const o = lireOptions(ctx.widget);
  const secran = o['secran'] ?? ctx.widget.secran ?? '';
  const ro = estLectureSeule(ctx);
  const lignes = ctx.acces?.lignes?.({ table: o['table'] ?? secran, filtre: o['filtre'], tri: o['tri'] }) ?? [];
  const colonnes = colonnesDepuisOption(o['cols']);
  const cols = colonnes.length ? colonnes
    : (lignes[0] ? Object.keys(lignes[0]).filter((k) => !k.startsWith('_')).map((k) => ({ champ: k, libelle: k })) : []);
  const slug = (s: string) => String(s).replace(/[^a-zA-Z0-9]+/g, '_');
  const cellule = (champ: string, idx: number, cle: string, valeur: any, tpl: boolean): string => {
    const at: Record<string, any> = {
      name: tpl ? `__insert__${champ}` : `_ml_${champ}[${cle}]`,
      value: valeur ?? '', 'data-name': champ, 'data-col': idx, readonly: ro, class: 'text',
    };
    if (!ro) at['data-eaf'] = '1';
    return `<td><input${attrs(at)} /></td>`;
  };
  const actions = (suppr: boolean): string => ro ? '' :
    `<td class="md-ea-actions"><button type="button" class="md-ea-save" title="Enregistrer la ligne">✓</button>`
    + `${suppr ? '<button type="button" class="md-ea-suppr" title="Supprimer la ligne">🗑</button>' : ''}</td>`;
  const thead = `<tr>${cols.map((c) => `<th>${escapeHtml(c.libelle)}</th>`).join('')}${ro ? '' : '<th></th>'}</tr>`;
  const corps = lignes.map((rec) => {
    const cle = String(rec['__cle__'] ?? rec['_id'] ?? '');
    const cells = cols.map((c, i) => cellule(c.champ, i, cle, rec[c.champ], false)).join('');
    return `<tr class="ligne-multi-container"${attrs({ 'data-e': secran, 'data-b': cle, 'data-tag': slug(cle) })}>${cells}${actions(true)}</tr>`;
  }).join('');
  const tpl = ro ? '' :
    `<tr class="ligne-multi-container" data-template="insert"${attrs({ 'data-e': secran, 'data-b': '' })} style="display:none">`
    + `${cols.map((c, i) => cellule(c.champ, i, '', '', true)).join('')}${actions(false)}</tr>`;
  const barre = ro ? '' :
    `<div class="md-ea-barre"><button type="button" class="md-ea-add" data-cible="${escapeHtml(ctx.nomChamp)}">+ Ajouter une ligne</button></div>`;
  return `<table${attrs({ id: ctx.nomChamp, class: 'editable-record-list', 'data-secran': secran })}>`
    + `<thead>${thead}</thead><tbody>${corps}${tpl}</tbody></table>${barre}`;
});

/** Sous-écrans empilés (port de sousEcranMulti). Chaque bloc est un sous-document
 *  du sous-écran `secran`, enregistré/supprimé via l'endpoint OBE (collecte par name). */
enregistre('sousEcranMulti', (ctx) => {
  const o = lireOptions(ctx.widget);
  const secran = o['secran'] ?? ctx.widget.secran ?? '';
  const ro = estLectureSeule(ctx);
  const lignes = ctx.acces?.lignes?.({ table: o['table'] ?? secran, filtre: o['filtre'], tri: o['tri'] }) ?? [];
  const actions = ro ? '' :
    '<div class="md-sem-actions"><button type="button" class="md-sem-save">✓ Enregistrer</button>'
    + '<button type="button" class="md-sem-suppr">🗑 Supprimer</button></div>';
  const bloc = (rec: Record<string, any>, tpl: boolean): string => {
    const cle = String(rec['__cle__'] ?? rec['_id'] ?? '');
    const html = ctx.acces?.rendSousEcran?.(secran, rec) ?? '';
    const at = { class: 'secran-multi-container md-sem-bloc', 'data-se': secran, 'data-e': secran, 'data-b': tpl ? '' : cle, 'data-template': tpl ? 'insert' : undefined };
    return `<div${attrs(at)}${tpl ? ' style="display:none"' : ''}>${html}${actions}</div>`;
  };
  const blocs = lignes.map((r) => bloc(r, false)).join('');
  const tpl = ro ? '' : bloc({}, true);
  const barre = ro ? '' : `<div class="md-ea-barre"><button type="button" class="md-sem-add" data-cible="${escapeHtml(ctx.nomChamp)}">+ Ajouter</button></div>`;
  return `<div id="${ctx.nomChamp}" class="md-secran-multi">${blocs}${tpl}</div>${barre}`;
});

/* ------------------------- recherche / quérabilité ------------------------- */

/** Champ + bouton de recherche en popup (port de querabilitePopup). */
enregistre('querabilitePopup', (ctx) => {
  const o = lireOptions(ctx.widget);
  const id = ctx.nomChamp;
  const ro = estLectureSeule(ctx);
  const input = `<input${attrs({
    name: id, id, value: ctx.valeur ?? '', readonly: ro, class: 'text querabilite',
    'data-ac-table': ro ? undefined : (o['table'] ?? undefined),
    'data-ac-cle': o['cle'] ?? undefined,
    'data-ac-affichage': o['affichage'] ?? o['libelle'] ?? undefined,
  })} />`;
  const data = { 'data-cible': id, 'data-table': o['table'] ?? '', 'data-cle': o['cle'] ?? '', 'data-affichage': o['affichage'] ?? o['libelle'] ?? '', 'data-retour': o['retour'] ?? '', 'data-ecran': o['ecran'] ?? o['remote'] ?? '' };
  const bouton = ro ? '' : `<button type="button"${attrs({ class: 'querabilite-popup', ...data })}>…</button>`;
  const libelle = `<span id="${id}_lib" class="querabilite-lib"></span>`;
  return `${input}${bouton}${libelle}`;
});

/** Tableau de résultats de recherche (port de querabiliteList). */
enregistre('querabiliteList', (ctx) => {
  const o = lireOptions(ctx.widget);
  const lignes = ctx.acces?.lignes?.({ table: o['table'] ?? ctx.widget.table ?? '', filtre: o['filtre'], tri: o['tri'] }) ?? [];
  return renderTableListe(ctx, lignes, 'list record-list querabilite-list');
});

/* ------------------------- widgets clé (navigation) ------------------------- */

/** Champ(s) clé avec autocomplétion + soumission auto (port de ordreCle). */
enregistre('ordreCle', (ctx) => {
  return `<input${attrs(baseAttrs(ctx, { value: ctx.valeur ?? '', class: 'text ordre-cle', 'data-ordre-cle': '1', autocomplete: 'off' }))} />`;
});
enregistre('ordreClePar', (ctx) => {
  return `<input${attrs(baseAttrs(ctx, { value: ctx.valeur ?? '', class: 'text ordre-cle-par', 'data-ordre-cle': '1', autocomplete: 'off' }))} />`;
});

/* ------------------------- documents / médias ------------------------- */

function urlDoc(ctx: RenderContexte, table: string): string {
  return ctx.acces?.urlDocument?.(table, ctx.cle ?? '', ctx.nomChamp)
    ?? `?module=pDocument&b=${encodeURIComponent(ctx.cle ?? '')}&p=${encodeURIComponent(table)}&c=${encodeURIComponent(ctx.nomChamp)}`;
}

/** Document PDF embarqué (port de zonePDF). */
enregistre('zonePDF', (ctx) => {
  const o = lireOptions(ctx.widget);
  if (!ctx.valeur) return `<div class="md-doc-vide" id="${ctx.nomChamp}"><h1>Aucun document associé</h1></div>`;
  return `<embed${attrs({ id: ctx.nomChamp, src: urlDoc(ctx, o['table'] ?? ctx.widget.table ?? ''), type: 'application/pdf', width: o['largeur'] ?? '100%', height: o['hauteur'] ?? '600' })} />`;
});

/** Image attachée (port de zoneImg). */
enregistre('zoneImg', (ctx) => {
  const o = lireOptions(ctx.widget);
  if (!ctx.valeur) return `<span class="md-image-vide" id="${ctx.nomChamp}"></span>`;
  return `<img${attrs({ id: ctx.nomChamp, src: urlDoc(ctx, o['table'] ?? ctx.widget.table ?? ''), alt: ctx.nomChamp, class: 'md-zone-img' })} />`;
});

/** Document (PDF ou image selon le contenu) (port de zoneDoc). */
enregistre('zoneDoc', (ctx) => {
  const renderer = (String(ctx.valeur).toLowerCase().endsWith('.pdf') || ctx.widget.format === 'pdf')
    ? renderers['zonePDF']! : renderers['zoneImg']!;
  return renderer(ctx);
});

/* ------------------------- arbre ------------------------- */

interface NoeudArbre { id?: any; cle?: any; label?: any; libelle?: any; enfants?: NoeudArbre[]; children?: NoeudArbre[] }

function rendNoeudsArbre(noeuds: NoeudArbre[]): string {
  if (!Array.isArray(noeuds) || noeuds.length === 0) return '';
  const li = noeuds.map((n) => {
    const label = escapeHtml(n.label ?? n.libelle ?? n.id ?? n.cle ?? '');
    const cle = n.id ?? n.cle ?? '';
    const enfants = n.enfants ?? n.children ?? [];
    const sous = rendNoeudsArbre(enfants);
    return `<li${attrs({ 'data-cle': cle })}><span class="md-arbre-noeud">${label}</span>${sous ? `<ul>${sous}</ul>` : ''}</li>`;
  }).join('');
  return li;
}

/** Arbre hiérarchique (port de la vue arborescente / selectTreeView).
 *  Option `cible` : id d'un champ à remplir au clic sur une feuille (sélection). */
enregistre('arbre', (ctx) => {
  const o = lireOptions(ctx.widget);
  const noeuds: NoeudArbre[] = Array.isArray(ctx.valeur) ? ctx.valeur : [];
  const cible = o['cible'] ?? ctx.widget.cible ?? '';
  return `<div${attrs({ class: 'md-arbre', id: ctx.nomChamp, 'data-name': ctx.nomChamp, 'data-cible': cible || undefined })}><ul>${rendNoeudsArbre(noeuds)}</ul></div>`;
});

/* ------------------------- suite scanner (acquisition GED) ------------------------- */
/* Fidèle au legacy WebTWAIN : boutons désactivés activés par le JS quand le      */
/* plugin/scanner est disponible ; data-* portent les options pour le client.     */

function boutonScan(ctx: RenderContexte, action: string, libelle: string, data: Record<string, any> = {}): string {
  if (estLectureSeule(ctx)) return '';
  return `<button${attrs({ type: 'button', class: 'button twainIFace', disabled: true, id: ctx.nomChamp, 'data-scan': action, ...prefixeData(data) })}>${escapeHtml(libelle)}</button>`;
}
function prefixeData(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== null && v !== '') out[`data-${k}`] = v;
  return out;
}

enregistre('scanInit', (ctx) => {
  const o = lireOptions(ctx.widget);
  if (ctx.valeur) { // document déjà présent : on l'affiche
    return getWidgetRenderer('zoneDoc')(ctx);
  }
  if (estLectureSeule(ctx)) return `<div class="md-doc-vide" id="${ctx.nomChamp}">Aucun document</div>`;
  // Équivalent natif de l'acquisition scanner WebTWAIN : téléversement de fichier.
  const table = o['table'] ?? ctx.widget.table ?? '';
  return `<div class="md-upload"${attrs({ 'data-table': table, 'data-champ': ctx.nomChamp, 'data-cle': ctx.cle ?? '' })}>`
    + `<input type="file" class="md-upload-input" ${o['accept'] ? `accept="${escapeHtml(o['accept'])}"` : ''}/>`
    + `<button type="button" class="md-upload-btn">Téléverser</button>`
    + `<span class="md-upload-etat"></span>`
    + `<input type="hidden" name="${escapeHtml(ctx.nomChamp)}" value="" /></div>`;
});
enregistre('scanScan', (ctx) => {
  const o = lireOptions(ctx.widget);
  return boutonScan(ctx, 'scan', 'Scanner', { resolution: o['resolution'], chargeur: o['chargeur'], mode: o['mode'] });
});
enregistre('scanScanUpload', (ctx) => boutonScan(ctx, 'scanUpload', 'Scanner et envoyer'));
enregistre('scanUpload', (ctx) => boutonScan(ctx, 'upload', 'Envoyer'));
enregistre('scanSave', (ctx) => { const o = lireOptions(ctx.widget); return boutonScan(ctx, 'save', 'Enregistrer', { format: o['format'] ?? 'pdf' }); });
enregistre('scanEdit', (ctx) => boutonScan(ctx, 'edit', 'Éditer'));
enregistre('scanSelectSource', (ctx) =>
  estLectureSeule(ctx) ? '' : `<select${attrs({ id: ctx.nomChamp, class: 'twainIFace', disabled: true, 'data-scan': 'selectSource' })}></select>`);
enregistre('scanSetDuplex', (ctx) =>
  estLectureSeule(ctx) ? '' : `<label class="md-scan-duplex"><input${attrs({ type: 'checkbox', id: ctx.nomChamp, disabled: true, 'data-scan': 'duplex' })} /> Recto/verso</label>`);
enregistre('scanSetAutoFeed', (ctx) =>
  estLectureSeule(ctx) ? '' : `<label class="md-scan-feed"><input${attrs({ type: 'checkbox', id: ctx.nomChamp, disabled: true, 'data-scan': 'autoFeed' })} /> Chargeur auto</label>`);

/** Téléversement manuel d'un fichier vers la GED (alternative logicielle au scan). */
enregistre('scanFileUpload', (ctx) => {
  if (estLectureSeule(ctx)) return getWidgetRenderer('zoneDoc')(ctx);
  const o = lireOptions(ctx.widget);
  const champCible = o['champ'] ?? ctx.nomChamp;
  return `<input${attrs({ type: 'file', id: ctx.nomChamp, name: `${ctx.nomChamp}__fichier`, class: 'md-scan-file', 'data-scan': 'fileUpload', 'data-champ': champCible })} />`;
});

/* ------------------------- alias de types (casse / synonymes legacy) ------------------------- */
enregistre('checkbox', (ctx) => renderers['boolean']!(ctx));   // alias de boolean
enregistre('textArea', (ctx) => renderers['textarea']!(ctx));  // tolérance de casse
enregistre('timestamp', (ctx) => renderers['datetime']!(ctx)); // alias de datetime

/** Renvoie le moteur de rendu pour un type de widget (text par défaut). */
export function getWidgetRenderer(type: string | undefined): WidgetRenderer {
  return renderers[type ?? 'text'] ?? renderers['text']!;
}

/** Enregistre/Remplace un moteur de rendu de widget (extensibilité). */
export function enregistreWidget(type: string, r: WidgetRenderer): void {
  enregistre(type, r);
}

/** Liste des types de widgets supportés. */
export function typesWidgetsSupportes(): string[] {
  return Object.keys(renderers);
}

/**
 * Rend un widget complet : libellé + contrôle + messages d'erreur, enveloppés.
 */
export function renderWidget(ctx: RenderContexte): string {
  const html = getWidgetRenderer(ctx.widget.type_widget)(ctx);
  if (ctx.widget.type_widget === 'hidden') return html;

  const libelle = ctx.widget.libelle
    ? `<label for="${ctx.nomChamp}">${escapeHtml(ctx.widget.libelle)}</label>`
    : '';
  const erreurs = (ctx.erreurs ?? ctx.widget.messerr ?? []) as string[];
  const erreurHtml = erreurs.length
    ? `<span class="md-erreur">${erreurs.map(escapeHtml).join(', ')}</span>`
    : '';
  const cls = erreurs.length ? 'md-champ md-erreur-champ' : 'md-champ';
  return `<span class="${cls}" data-champ="${ctx.nomChamp}">${libelle}${html}${erreurHtml}</span>`;
}

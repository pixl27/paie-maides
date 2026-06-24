/**
 * Client maides (navigateur) — port modernisé de maides.js / maidesJS.js.
 *
 * Apporte l'interactivité absente du rendu serveur pur :
 *  - navigation et sauvegarde en AJAX (sans rechargement de page) ;
 *  - validation côté client avec messages inline (port des mdJsCheck*) ;
 *  - navigation clavier (Entrée -> champ suivant).
 *
 * Module ESM : les fonctions pures sont exportées (testables sous jsdom) ;
 * le câblage DOM ne s'active qu'au chargement de la page.
 */

/* ----------------------------- validateurs ----------------------------- */

export function estObligatoire(v) {
  return String(v ?? '').trim() === '' ? 'Obligatoire' : '';
}
export function estEntier(v) {
  if (v === '' || v == null) return '';
  return /^-?\d+$/.test(String(v)) ? '' : 'Doit être un entier';
}
export function estReel(v) {
  if (v === '' || v == null) return '';
  return Number.isNaN(Number(v)) ? 'Doit être numérique' : '';
}
export function estDate(v) {
  if (v === '' || v == null) return '';
  return Number.isNaN(Date.parse(String(v))) ? 'Date invalide' : '';
}
export function estHeure(v) {
  if (v === '' || v == null) return '';
  return /^\d{1,2}:\d{2}$/.test(String(v)) ? '' : 'Heure invalide';
}
export function longueurMax(v, n) {
  return n > 0 && String(v ?? '').length > n ? `Maximum ${n} caractères` : '';
}

/** Valide un contrôle de formulaire selon ses attributs ; renvoie un message ou ''. */
export function valideChamp(el) {
  if (el.disabled || el.type === 'hidden' || !el.name) return '';
  const v = el.value;
  if ((el.required || el.getAttribute('required') !== null) && estObligatoire(v)) return 'Obligatoire';
  if (v === '' || v == null) return '';
  const type = el.dataset ? el.dataset.mdType : el.getAttribute('data-md-type');
  let err = '';
  if (type === 'integer') err = estEntier(v);
  else if (type === 'decimal') err = estReel(v);
  else if (type === 'date') err = estDate(v);
  else if (type === 'time') err = estHeure(v);
  if (err) return err;
  const max = Number(el.maxLength);
  if (max > 0) { const e2 = longueurMax(v, max); if (e2) return e2; }
  const min = el.getAttribute('data-md-min');
  const maxv = el.getAttribute('data-md-max');
  if ((type === 'integer' || type === 'decimal') && v !== '') {
    if (min !== null && min !== '' && Number(v) < Number(min)) return `Ne peut pas être < ${min}`;
    if (maxv !== null && maxv !== '' && Number(v) > Number(maxv)) return `Ne peut pas être > ${maxv}`;
  }
  return '';
}

/** Valide tous les champs d'un formulaire, affiche les erreurs inline, renvoie true si OK. */
export function valideFormulaire(form) {
  // nettoyage des erreurs client précédentes
  form.querySelectorAll('.md-erreur-client').forEach((n) => n.remove());
  form.querySelectorAll('.md-erreur-champ').forEach((n) => n.classList.remove('md-erreur-champ'));

  let premierInvalide = null;
  for (const el of form.querySelectorAll('input, select, textarea')) {
    const err = valideChamp(el);
    if (!err) continue;
    const champ = el.closest('.md-champ') || el.parentElement;
    if (champ) {
      champ.classList.add('md-erreur-champ');
      const span = document.createElement('span');
      span.className = 'md-erreur md-erreur-client';
      span.textContent = err;
      champ.appendChild(span);
    }
    if (!premierInvalide) premierInvalide = el;
  }
  if (premierInvalide) premierInvalide.focus();
  return premierInvalide === null;
}

/* ----------------------------- AJAX + DOM ----------------------------- */

function vue() {
  return document.getElementById('md-vue');
}

function swap(html) {
  const cible = vue();
  if (!cible) return;
  cible.innerHTML = html;
  rehydrate(cible);
  const premier = cible.querySelector('input:not([type=hidden]), select, textarea');
  if (premier) premier.focus();
}

/** Récupère la valeur d'un contrôle (case à cocher -> 0/1). */
function valeurChamp(el) {
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked ? 1 : 0;
  return el.value;
}

async function ajax(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { 'X-Maides-Ajax': '1', ...(opts.headers || {}) },
    credentials: 'same-origin',
  });
  // Session expirée (souvent après un redémarrage du serveur) : on recharge la
  // page de connexion en entier plutôt que d'injecter son HTML dans le contenu.
  if (r.status === 401) { window.location.href = '/login'; throw new Error('non_authentifie'); }
  return r.text();
}

function champsNavigables(racine) {
  return [...(racine || vue() || document).querySelectorAll('input:not([type=hidden]):not([disabled]), select, textarea')];
}
function focusSuivant(el) {
  const champs = champsNavigables();
  const i = champs.indexOf(el);
  if (i >= 0 && i < champs.length - 1) champs[i + 1].focus();
}
function focusPrecedent(el) {
  const champs = champsNavigables();
  const i = champs.indexOf(el);
  if (i > 0) champs[i - 1].focus();
}

/* ----------------------------- navigation & dialogues ----------------------------- */

/** Convertit "?o=1&e=Ecran&b=Cle" en "/Ecran?o=1&b=Cle" (sinon renvoie l'URL telle quelle). */
export function urlVersEcran(q) {
  const s = String(q || '');
  if (s.startsWith('/') || s.startsWith('http')) return s;
  const p = new URLSearchParams(s.replace(/^[?#]/, ''));
  const e = p.get('e');
  if (e) return `/${encodeURIComponent(e)}?o=${encodeURIComponent(p.get('o') || '1')}&b=${encodeURIComponent(p.get('b') || '')}`;
  return s;
}

/** Navigation (corrige le clic mort des lignes de liste). Exposée en global pour les onclick. */
function goPage(q) { const u = urlVersEcran(q); if (u && u !== '#') window.location.href = u; }

function echappe(s) { const e = document.createElement('span'); e.textContent = String(s ?? ''); return e.innerHTML; }

/** Ouvre une <dialog> modale ; clic sur le fond ou Échap ferme. */
function ouvreDialog(html, classe) {
  const d = document.createElement('dialog');
  d.className = 'md-dialog' + (classe ? ' ' + classe : '');
  d.innerHTML = html;
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  return d;
}

/** Confirmation modale (remplace window.confirm). Promise<boolean>. */
export function confirmer(message) {
  return new Promise((resolve) => {
    const d = ouvreDialog(
      `<p class="md-dialog__msg">${echappe(message)}</p>`
      + `<div class="md-dialog__actions"><button type="button" class="secondaire" data-non>Annuler</button>`
      + `<button type="button" data-oui>Confirmer</button></div>`, 'md-dialog--confirm');
    let fait = false;
    const fin = (v) => { if (fait) return; fait = true; resolve(v); d.close(); };
    d.querySelector('[data-oui]').addEventListener('click', () => fin(true));
    d.querySelector('[data-non]').addEventListener('click', () => fin(false));
    d.addEventListener('cancel', () => fin(false));
    d.addEventListener('close', () => fin(false));
    d.querySelector('[data-oui]').focus();
  });
}

/** Saisie modale (port de demander) : Promise<string|null>. */
export function demander(message, defaut) {
  return new Promise((resolve) => {
    const d = ouvreDialog(
      `<p class="md-dialog__msg">${echappe(message)}</p>`
      + `<input class="md-dialog__q" type="text" value="${echappe(defaut ?? '')}" />`
      + `<div class="md-dialog__actions"><button type="button" class="secondaire" data-non>Annuler</button>`
      + `<button type="button" data-oui>Valider</button></div>`, 'md-dialog--demande');
    const champ = d.querySelector('.md-dialog__q');
    let fait = false;
    const fin = (v) => { if (fait) return; fait = true; resolve(v); d.close(); };
    d.querySelector('[data-oui]').addEventListener('click', () => fin(champ.value));
    d.querySelector('[data-non]').addEventListener('click', () => fin(null));
    d.addEventListener('cancel', () => fin(null));
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fin(champ.value); } });
    champ.focus(); champ.select();
  });
}

/** Notification transitoire (port des flash après ordre OBE). */
function toast(messages) {
  const arr = Array.isArray(messages) ? messages : [messages];
  for (const m of arr) {
    const text = typeof m === 'string' ? m : (m && m.text) || '';
    if (!text) continue;
    const type = (m && typeof m === 'object' && m.type) || 'info';
    const el = document.createElement('div');
    el.className = 'md-toast md-toast--' + type;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('part'); }, 2600);
    setTimeout(() => { el.remove(); }, 3000);
  }
}

/** Recherche popup (quérabilité) : modale de recherche, recopie la valeur choisie. */
async function ouvreQuerabilite(btn) {
  const table = btn.getAttribute('data-table');
  const cle = btn.getAttribute('data-cle') || '';
  const affichage = btn.getAttribute('data-affichage') || '';
  const cibleId = btn.getAttribute('data-cible');
  const d = ouvreDialog(
    `<h3 class="md-dialog__t">Rechercher</h3>`
    + `<input class="md-dialog__q" type="search" placeholder="Tapez pour rechercher…" autocomplete="off" />`
    + `<div class="md-dialog__res"><p class="aide">Tapez au moins 1 caractère.</p></div>`
    + `<div class="md-dialog__actions"><button type="button" class="secondaire" data-non>Fermer</button></div>`,
    'md-dialog--search');
  d.querySelector('[data-non]').addEventListener('click', () => d.close());
  const q = d.querySelector('.md-dialog__q');
  const res = d.querySelector('.md-dialog__res');
  q.focus();
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const terme = q.value.trim();
      if (!terme) { res.innerHTML = '<p class="aide">Tapez au moins 1 caractère.</p>'; return; }
      let data;
      try { data = JSON.parse(await ajax(`/_ws?op=recherche&table=${encodeURIComponent(table)}&q=${encodeURIComponent(terme)}`, { method: 'GET' })); }
      catch { res.innerHTML = '<p class="aide">Recherche indisponible.</p>'; return; }
      const rows = (data && data.rows) || [];
      if (!rows.length) { res.innerHTML = '<p class="aide">Aucun résultat.</p>'; return; }
      const SYS = new Set(['created_at', 'created_by', 'updated_at', 'updated_by']);
      const cols = Object.keys(rows[0]).filter((k) => !k.startsWith('_') && !SYS.has(k));
      res.innerHTML = '<table class="md-liste"><tbody>' + rows.map((r) => {
        const v = cle ? r[cle] : r[cols[0]];
        const lib = affichage ? r[affichage] : '';
        return `<tr data-val="${echappe(v)}" data-lib="${echappe(lib)}">` + cols.map((c) => `<td>${echappe(r[c])}</td>`).join('') + '</tr>';
      }).join('') + '</tbody></table>';
      res.querySelectorAll('tr[data-val]').forEach((tr) => tr.addEventListener('click', () => {
        const cible = document.getElementById(cibleId);
        if (cible) cible.value = tr.getAttribute('data-val');
        const lib = document.getElementById(cibleId + '_lib');
        if (lib) lib.textContent = tr.getAttribute('data-lib') || tr.getAttribute('data-val');
        d.close();
      }));
    }, 200);
  });
}

/** Navigation AJAX qui MET À JOUR la barre d'URL : sans ça, les liens relatifs
 *  (?o=2&b=…) d'un écran chargé en AJAX se résolvent contre l'URL précédente
 *  (souvent /menu) et ramènent à l'accueil. */
async function navigue(href, remplace) {
  const cible = new URL(href, location.href).href;
  swap(await ajax(cible, { method: 'GET' }));
  try { history[remplace ? 'replaceState' : 'pushState']({}, '', cible); } catch { /* ignore */ }
}

/** Soumission AJAX d'un formulaire (factorisée pour réutilisation avec confirmation). */
async function soumettreForm(form, submitter) {
  const fd = new FormData(form);
  if (submitter && submitter.name) fd.append(submitter.name, submitter.value);
  const action = (submitter && submitter.getAttribute('formaction'))
    || form.getAttribute('action') || (location.pathname + location.search);
  const body = new URLSearchParams([...fd.entries()]).toString();
  swap(await ajax(action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }));
  // l'écran courant reste sous cette URL (les liens relatifs résolvent juste)
  try { history.replaceState({}, '', new URL(action, location.href).href); } catch { /* ignore */ }
}

/* ----------------------------- tableaux éditables (editableArray) ----------------------------- */

/** Envoie une ligne au serveur (port de editableArraySend) : POST OBE {e,b,o,...champs}. */
async function eaEnvoie(tr, o) {
  const data = { e: tr.getAttribute('data-e') || '', b: tr.getAttribute('data-b') || '', o };
  tr.querySelectorAll('[data-eaf]').forEach((el) => { data[el.getAttribute('data-name')] = valeurChamp(el); });
  const body = new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString();
  const txt = await ajax('/_obe', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  try { return JSON.parse(txt); } catch { return null; }
}

/** Réinjecte les valeurs serveur dans la ligne + affiche les erreurs (port de editableArrayReceive). */
function eaRecoit(tr, rep) {
  tr.querySelectorAll('.error-label').forEach((n) => n.remove());
  tr.querySelectorAll('.md-erreur-champ').forEach((n) => n.classList.remove('md-erreur-champ'));
  if (!rep || !rep.tuple) return !!(rep && rep.ok !== false);
  let ok = true;
  for (const col of Object.keys(rep.tuple)) {
    const cell = tr.querySelector(`[data-name="${col}"]`);
    if (cell && 'value' in cell) cell.value = rep.tuple[col].v ?? '';
    if (rep.tuple[col].ne !== true) {
      ok = false;
      if (cell) {
        cell.classList.add('md-erreur-champ');
        const s = document.createElement('span');
        s.className = 'error-label md-erreur';
        s.textContent = Array.isArray(rep.tuple[col].ne) ? rep.tuple[col].ne.join(', ') : rep.tuple[col].ne;
        (cell.parentElement || tr).appendChild(s);
      }
    }
  }
  return ok && rep.ok !== false;
}

/** Clone la ligne-modèle et l'ajoute au tableau (port de editableArrayAddLine). */
function eaAjouteLigne(table) {
  const tbody = table.querySelector('tbody');
  const tpl = tbody && tbody.querySelector('[data-template="insert"]');
  if (!tpl) return null;
  const tr = tpl.cloneNode(true);
  tr.removeAttribute('data-template');
  tr.removeAttribute('style');
  tbody.appendChild(tr);
  rehydrate(tr); // initialise les widgets de la nouvelle ligne (masques, texte riche…)
  return tr;
}

/** Enregistre une ligne (o=9) ; sur une ligne neuve réussie, prépare la ligne suivante. */
async function eaEnregistre(tr) {
  const table = tr.closest('table');
  const neuve = (tr.getAttribute('data-b') || '') === '';
  const rep = await eaEnvoie(tr, 9);
  const ok = eaRecoit(tr, rep);
  if (rep && rep.messages) toast(rep.messages);
  if (ok && neuve && rep && rep.obe) {
    tr.setAttribute('data-b', (rep.obe.b || []).join('.'));
    if (table) eaAjouteLigne(table);
  }
  return ok;
}

/** Supprime une ligne (o=4) après confirmation. */
async function eaSupprime(tr) {
  if ((tr.getAttribute('data-b') || '') === '') { tr.remove(); return; }
  if (!(await confirmer('Supprimer cette ligne ?'))) return;
  const rep = await eaEnvoie(tr, 4);
  if (!rep || rep.supprime !== false) tr.remove();
}

/* sous-écrans empilés (sousEcranMulti) : même principe, collecte par attribut name */
async function semEnvoie(bloc, o) {
  const data = { e: bloc.getAttribute('data-e') || '', b: bloc.getAttribute('data-b') || '', o };
  bloc.querySelectorAll('input[name],select[name],textarea[name]').forEach((el) => {
    const n = el.getAttribute('name');
    if (n && n !== 'o' && n !== 'b' && n !== 'e') data[n] = valeurChamp(el);
  });
  const body = new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString();
  const txt = await ajax('/_obe', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  try { return JSON.parse(txt); } catch { return null; }
}
function semAjouteBloc(container) {
  const tpl = container.querySelector('[data-template="insert"]');
  if (!tpl) return null;
  const bloc = tpl.cloneNode(true);
  bloc.removeAttribute('data-template');
  bloc.removeAttribute('style');
  container.appendChild(bloc);
  rehydrate(bloc); // initialise les widgets du nouveau bloc
  return bloc;
}
/** Réinjecte les valeurs serveur dans un bloc (mirror de eaRecoit, collecte par name). */
function semRecoit(bloc, rep) {
  bloc.querySelectorAll('.error-label').forEach((n) => n.remove());
  bloc.querySelectorAll('.md-erreur-champ').forEach((n) => n.classList.remove('md-erreur-champ'));
  if (!rep || !rep.tuple) return !!(rep && rep.ok !== false);
  let ok = true;
  for (const col of Object.keys(rep.tuple)) {
    const cell = bloc.querySelector(`[name="${col}"]`);
    if (cell && 'value' in cell) cell.value = rep.tuple[col].v ?? '';
    if (rep.tuple[col].ne !== true) {
      ok = false;
      if (cell) {
        cell.classList.add('md-erreur-champ');
        const s = document.createElement('span');
        s.className = 'error-label md-erreur';
        s.textContent = Array.isArray(rep.tuple[col].ne) ? rep.tuple[col].ne.join(', ') : rep.tuple[col].ne;
        (cell.parentElement || bloc).appendChild(s);
      }
    }
  }
  return ok && rep.ok !== false;
}
async function semEnregistre(bloc) {
  const neuf = (bloc.getAttribute('data-b') || '') === '';
  const rep = await semEnvoie(bloc, 9);
  const ok = semRecoit(bloc, rep);
  if (rep && rep.messages) toast(rep.messages);
  if (ok && neuf && rep && rep.obe) {
    bloc.setAttribute('data-b', (rep.obe.b || []).join('.'));
    const cont = bloc.closest('.md-secran-multi');
    if (cont) semAjouteBloc(cont);
  }
  return ok;
}
async function semSupprime(bloc) {
  if ((bloc.getAttribute('data-b') || '') === '') { bloc.remove(); return; }
  if (!(await confirmer('Supprimer ce bloc ?'))) return;
  const rep = await semEnvoie(bloc, 4);
  if (!rep || rep.supprime !== false) bloc.remove();
}

/** Au chargement : chaque tableau éditable reçoit une ligne vierge prête à la saisie. */
function initEditableArrays(root) {
  (root || document).querySelectorAll('table.editable-record-list').forEach((table) => {
    if (table.dataset.eaInit) return;
    table.dataset.eaInit = '1';
    if (table.querySelector('[data-template="insert"]')) eaAjouteLigne(table);
  });
}

/* ----------------------------- masques de saisie ----------------------------- */

function dateAujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Masque live selon data-md-type (entier/décimal/date au format JJ-MM-AAAA). */
function appliqueMasque(el) {
  const type = el.getAttribute('data-md-type') || (el.dataset ? el.dataset.mdType : '');
  if (!type) return;
  if (type === 'date' && el.classList && el.classList.contains('hasDatepicker')) return; // datepicker gère le format
  const av = el.value;
  let v = av;
  if (type === 'integer') v = av.replace(/[^\d-]/g, '');
  else if (type === 'decimal') v = av.replace(/[^\d.,-]/g, '').replace(',', '.');
  else if (type === 'date') {
    const d = av.replace(/[^\d]/g, '').slice(0, 8);
    v = d.length > 4 ? `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`
      : d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
  } else if (type === 'time') {
    const d = av.replace(/[^\d]/g, '').slice(0, 4);
    v = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
  }
  if (v !== av) el.value = v;
}

/* ----------------------------- autocomplétion + lookup quérabilité ----------------------------- */

const minuteurs = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function differe(el, fn, ms) {
  if (!minuteurs) { fn(); return; }
  clearTimeout(minuteurs.get(el));
  minuteurs.set(el, setTimeout(fn, ms));
}

/** Alimente une datalist depuis /_ws recherche pour un champ data-ac-table. */
function autocomplete(el) {
  const table = el.getAttribute('data-ac-table');
  if (!table) return;
  const cle = el.getAttribute('data-ac-cle') || '';
  const aff = el.getAttribute('data-ac-affichage') || '';
  const terme = el.value.trim();
  if (terme.length < 1) return;
  differe(el, async () => {
    let data;
    try { data = JSON.parse(await ajax(`/_ws?op=recherche&table=${encodeURIComponent(table)}&q=${encodeURIComponent(terme)}`, { method: 'GET' })); }
    catch { return; }
    let dl = el.list;
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'dl_' + (el.id || el.name || Math.abs(hashChaine(table + terme)));
      el.setAttribute('list', dl.id);
      el.parentNode.appendChild(dl);
    }
    const rows = (data && data.rows) || [];
    dl.innerHTML = rows.map((r) => {
      const v = cle ? r[cle] : Object.keys(r).filter((k) => !k.startsWith('_'))[0];
      const lib = aff ? r[aff] : '';
      return `<option value="${String(v).replace(/"/g, '&quot;')}">${String(lib).replace(/</g, '&lt;')}</option>`;
    }).join('');
  }, 200);
}

function hashChaine(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/** Au change d'une quérabilité, récupère le libellé correspondant à la clé saisie. */
async function lookupQuerabilite(el) {
  const table = el.getAttribute('data-ac-table');
  const aff = el.getAttribute('data-ac-affichage');
  const cle = el.getAttribute('data-ac-cle');
  const lib = document.getElementById((el.id || el.name) + '_lib');
  if (!table || !aff || !lib || !el.value) return;
  try {
    const data = JSON.parse(await ajax(`/_ws?op=recherche&table=${encodeURIComponent(table)}&q=${encodeURIComponent(el.value)}`, { method: 'GET' }));
    const rows = (data && data.rows) || [];
    const row = rows.find((r) => String(cle ? r[cle] : '') === String(el.value));
    if (!row) { lib.textContent = 'NON TROUVÉ !'; lib.classList.add('md-lookup-ko'); return; }
    lib.classList.remove('md-lookup-ko');
    // `affichage` peut lister plusieurs champs (« nom prenom ») : on les concatène.
    const champs = String(aff).split(/[\s,]+/).filter(Boolean);
    const libVal = champs.length > 1 ? champs.map((f) => row[f] ?? '').join(' ').trim() : (row[aff] ?? '');
    lib.textContent = libVal;
  } catch { /* silencieux */ }
}

/* ----------------------------- éditeurs riches (texte / code) ----------------------------- */

/** Rehausse les textarea .md-richtext/.md-ckeditor : CKEditor si présent, sinon contenteditable. */
function initRichtext(root) {
  const CK = typeof window !== 'undefined' && window.CKEDITOR;
  (root || document).querySelectorAll('textarea.md-richtext, textarea.md-ckeditor').forEach((ta) => {
    if (ta.dataset.rtInit || ta.readOnly || ta.disabled) return;
    ta.dataset.rtInit = '1';
    if (CK) {
      if (!ta.id) ta.id = 'ck_' + Math.abs(hashChaine((ta.name || '') + ta.value.length + Date.now()));
      if (!CK.instances[ta.id]) { try { CK.replace(ta.id); return; } catch { /* repli ci-dessous */ } }
      else return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'md-rt';
    const bar = document.createElement('div');
    bar.className = 'md-rt-bar';
    const boutons = [['bold', 'G'], ['italic', 'I'], ['underline', 'S'], ['insertUnorderedList', '• Liste'], ['insertOrderedList', '1. Liste'], ['createLink', '🔗']];
    for (const [cmd, lab] of boutons) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'md-rt-b'; b.textContent = lab; b.dataset.cmd = cmd;
      bar.appendChild(b);
    }
    const ed = document.createElement('div');
    ed.className = 'md-rt-ed'; ed.contentEditable = 'true'; ed.innerHTML = ta.value;
    ed.addEventListener('input', () => { ta.value = ed.innerHTML; });
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (!b) return;
      e.preventDefault();
      const cmd = b.dataset.cmd;
      if (cmd === 'createLink') { const u = prompt('URL du lien :'); if (u) document.execCommand(cmd, false, u); }
      else document.execCommand(cmd, false, null);
      ed.focus(); ta.value = ed.innerHTML;
    });
    ta.style.display = 'none';
    ta.parentNode.insertBefore(wrap, ta);
    wrap.appendChild(bar); wrap.appendChild(ed); wrap.appendChild(ta);
  });
}

/** Rehausse les textarea .md-codeeditor : CodeMirror si présent, sinon textarea + tabulation. */
function initCodeEditors(root) {
  const CM = typeof window !== 'undefined' && window.CodeMirror;
  (root || document).querySelectorAll('textarea.md-codeeditor').forEach((ta) => {
    if (ta.dataset.ceInit) return;
    ta.dataset.ceInit = '1';
    if (CM) {
      try {
        ta._cm = CM.fromTextArea(ta, {
          mode: ta.getAttribute('data-mode') || 'javascript',
          lineNumbers: true,
          readOnly: ta.getAttribute('data-readonly') === '1',
        });
        return;
      } catch { /* repli ci-dessous */ }
    }
    ta.classList.add('md-code-actif');
    ta.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
    });
  });
}

/* ----------------------------- intégration jstree / jQuery UI ----------------------------- */

/** Transforme .md-arbre en jstree si la lib est présente (sinon pliage CSS natif). */
function initTree(root) {
  const jq = typeof window !== 'undefined' && window.jQuery;
  if (!jq || !jq.fn || !jq.fn.jstree) return;
  (root || document).querySelectorAll('.md-arbre').forEach((div) => {
    if (div.dataset.jstree) return;
    div.dataset.jstree = '1';
    const $t = jq(div);
    $t.jstree({ core: { themes: { dots: true, icons: true } } });
    $t.on('changed.jstree', (e, data) => {
      const cibleId = div.getAttribute('data-cible');
      if (!cibleId || !data.node) return;
      const cle = (data.node.li_attr && data.node.li_attr['data-cle']) || data.node.id;
      const cible = document.getElementById(cibleId);
      if (cible) cible.value = cle;
    });
  });
}

/** Autocomplétion jQuery UI sur les champs data-ac-table (sinon datalist natif). */
function initAutocompleteUI(root) {
  const jq = typeof window !== 'undefined' && window.jQuery;
  if (!jq || !jq.fn || !jq.fn.autocomplete) return;
  (root || document).querySelectorAll('[data-ac-table]').forEach((el) => {
    if (el.dataset.acInit) return;
    el.dataset.acInit = 'ui';
    const table = el.getAttribute('data-ac-table');
    const cle = el.getAttribute('data-ac-cle') || '';
    const aff = el.getAttribute('data-ac-affichage') || '';
    jq(el).autocomplete({
      minLength: 1,
      source: (req, resp) => {
        ajax(`/_ws?op=recherche&table=${encodeURIComponent(table)}&q=${encodeURIComponent(req.term)}`)
          .then((t) => {
            let rows = [];
            try { rows = (JSON.parse(t).rows) || []; } catch { rows = []; }
            resp(rows.map((r) => {
              const v = cle ? r[cle] : Object.keys(r).filter((k) => !k.startsWith('_'))[0];
              return { label: aff ? `${v} — ${r[aff]}` : String(v), value: v };
            }));
          })
          .catch(() => resp([]));
      },
    });
  });
}

/** Sélecteur de date jQuery UI sur les champs date (sinon masque natif). */
function initDatepicker(root) {
  const jq = typeof window !== 'undefined' && window.jQuery;
  if (!jq || !jq.fn || !jq.fn.datepicker) return;
  (root || document).querySelectorAll('input[data-md-type="date"]').forEach((el) => {
    if (el.dataset.dpInit) return;
    el.dataset.dpInit = '1';
    jq(el).datepicker({ dateFormat: 'dd-mm-yy', changeMonth: true, changeYear: true });
  });
}

/* ----------------------------- téléversement GED (équivalent scanner) ----------------------------- */

/** Téléverse le fichier choisi vers /_upload puis affiche le document. */
async function televerse(zone) {
  const input = zone.querySelector('.md-upload-input');
  const etat = zone.querySelector('.md-upload-etat');
  const file = input && input.files && input.files[0];
  if (!file) { if (etat) etat.textContent = 'Choisissez un fichier.'; return; }
  if (etat) etat.textContent = 'Envoi…';
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  }).catch(() => '');
  if (!data) { if (etat) etat.textContent = 'Lecture impossible.'; return; }
  const corps = JSON.stringify({
    table: zone.getAttribute('data-table'), b: zone.getAttribute('data-cle'),
    champ: zone.getAttribute('data-champ'), nom: file.name, type: file.type, data,
    accept: (input.getAttribute('accept') || ''),
  });
  let rep;
  try { rep = JSON.parse(await ajax('/_upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps })); }
  catch { if (etat) etat.textContent = 'Échec de l’envoi.'; return; }
  if (!rep || !rep.ok) { if (etat) etat.textContent = (rep && rep.erreur) || 'Échec.'; return; }
  const hidden = zone.querySelector('input[type=hidden]');
  if (hidden) hidden.value = rep.nom;
  const pdf = /\.pdf$/i.test(rep.nom) || file.type === 'application/pdf';
  const apercu = pdf
    ? `<embed src="${rep.url}" type="application/pdf" width="100%" height="600" />`
    : `<img src="${rep.url}" alt="${echappe(rep.nom)}" class="md-zone-img" />`;
  zone.innerHTML = `<div class="md-upload-ok">✓ ${echappe(rep.nom)}</div>${apercu}`;
}

/** Réinitialise tous les widgets interactifs d'une portion du DOM (après swap AJAX). */
function rehydrate(root) {
  initEditableArrays(root);
  initRichtext(root);
  initCodeEditors(root);
  initTree(root);
  initAutocompleteUI(root);
  initDatepicker(root);
}

/** Active l'interactivité : écoute soumissions, clics et clavier (délégation). */
export function initMaides(racine = document) {
  racine.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.matches || !form.matches('[data-md-ajax]')) return;
    e.preventDefault();
    // synchronise les éditeurs riches/code vers leur textarea avant envoi (port de CKEForceUpdate)
    form.querySelectorAll('.md-rt').forEach((wrap) => {
      const ed = wrap.querySelector('.md-rt-ed'); const ta = wrap.querySelector('textarea');
      if (ed && ta) ta.value = ed.innerHTML;
    });
    if (typeof window !== 'undefined' && window.CKEDITOR) {
      for (const id in window.CKEDITOR.instances) { try { window.CKEDITOR.instances[id].updateElement(); } catch { /* ignore */ } }
    }
    form.querySelectorAll('textarea.md-codeeditor').forEach((ta) => { if (ta._cm) ta._cm.save(); });
    if (form.id === 'md-form' && !valideFormulaire(form)) return;
    const submitter = e.submitter; // capturé avant tout await
    const confirmMsg = form.getAttribute('data-confirm');
    if (confirmMsg && !(await confirmer(confirmMsg))) return;
    await soumettreForm(form, submitter);
  });

  racine.addEventListener('click', async (e) => {
    const t = e.target;
    if (!t.closest) return;
    // lien AJAX
    const a = t.closest('a[data-md-ajax]');
    if (a) { e.preventDefault(); await navigue(a.getAttribute('href')); return; }
    // recherche popup (quérabilité)
    const qb = t.closest('.querabilite-popup');
    if (qb) { e.preventDefault(); ouvreQuerabilite(qb); return; }
    // bouton d'action OBE
    const obe = t.closest('.md-obe');
    if (obe) {
      e.preventDefault();
      const cf = obe.getAttribute('data-confirm');
      if (cf && !(await confirmer(cf))) return;
      const ecr = obe.getAttribute('data-e');
      if (ecr) goPage(`?o=${obe.getAttribute('data-o') || '1'}&e=${ecr}&b=${obe.getAttribute('data-b') || ''}`);
      return;
    }
    // duplication d'un document (o=5) : demande la nouvelle clé puis enregistre la copie
    const dup = t.closest('[data-md-dup]');
    if (dup) {
      e.preventDefault();
      const e0 = dup.getAttribute('data-e'); const b0 = dup.getAttribute('data-b') || '';
      const nv = await demander('Nouvelle clé pour la copie :', b0);
      if (nv == null || nv === '') return;
      const body = new URLSearchParams({ o: '5', b: b0, cleCible: nv }).toString();
      swap(await ajax(`/${encodeURIComponent(e0)}?o=5&b=${encodeURIComponent(b0)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }));
      return;
    }
    // tableaux éditables : ajouter / enregistrer / supprimer une ligne
    const add = t.closest('.md-ea-add');
    if (add) {
      e.preventDefault();
      const table = document.getElementById(add.getAttribute('data-cible')) || add.closest('.md-ea-barre').previousElementSibling;
      const tr = table && eaAjouteLigne(table);
      if (tr) { const f = tr.querySelector('[data-eaf]'); if (f) f.focus(); }
      return;
    }
    const save = t.closest('.md-ea-save');
    if (save) { e.preventDefault(); const tr = save.closest('tr'); if (tr) eaEnregistre(tr); return; }
    const suppr = t.closest('.md-ea-suppr');
    if (suppr) { e.preventDefault(); const tr = suppr.closest('tr'); if (tr) eaSupprime(tr); return; }
    // sous-écrans empilés : ajouter / enregistrer / supprimer un bloc
    const semAdd = t.closest('.md-sem-add');
    if (semAdd) { e.preventDefault(); const c = document.getElementById(semAdd.getAttribute('data-cible')); if (c) semAjouteBloc(c); return; }
    const semSave = t.closest('.md-sem-save');
    if (semSave) { e.preventDefault(); const b = semSave.closest('.md-sem-bloc'); if (b) semEnregistre(b); return; }
    const semSup = t.closest('.md-sem-suppr');
    if (semSup) { e.preventDefault(); const b = semSup.closest('.md-sem-bloc'); if (b) semSupprime(b); return; }
    // téléversement GED (équivalent scanner)
    const up = t.closest('.md-upload-btn');
    if (up) { e.preventDefault(); const z = up.closest('.md-upload'); if (z) televerse(z); return; }
    // fermeture (dialogue ou retour)
    const close = t.closest('[data-md-close]');
    if (close) { e.preventDefault(); const dlg = close.closest('dialog'); if (dlg) dlg.close(); else history.back(); return; }
    // arbre : sélection d'une feuille (data-cible) ou pliage d'un nœud (sauf si jstree gère l'arbre)
    const noeud = t.closest('.md-arbre-noeud');
    if (noeud && !noeud.closest('[data-jstree="1"]')) {
      const li = noeud.parentElement;
      const arbre = noeud.closest('.md-arbre');
      const cibleId = arbre && arbre.getAttribute('data-cible');
      if (cibleId && li && !li.querySelector(':scope > ul')) {
        const cible = document.getElementById(cibleId);
        if (cible) cible.value = li.getAttribute('data-cle') || '';
        arbre.querySelectorAll('.md-arbre-noeud.sel').forEach((n) => n.classList.remove('sel'));
        noeud.classList.add('sel');
      } else if (li && li.querySelector(':scope > ul')) {
        li.classList.toggle('plie');
      }
      return;
    }
  });

  // Saisie : masques live + autocomplétion (délégation).
  racine.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.tagName) return;
    if (el.getAttribute && (el.getAttribute('data-md-type') || (el.dataset && el.dataset.mdType))) appliqueMasque(el);
    // datalist natif uniquement si jQuery UI autocomplete n'a pas pris la main
    if (el.getAttribute && el.getAttribute('data-ac-table') && (!el.dataset || el.dataset.acInit !== 'ui')) autocomplete(el);
  });
  // Quérabilité : au change, récupère le libellé de la clé saisie.
  racine.addEventListener('change', (e) => {
    const el = e.target;
    if (el && el.getAttribute && el.getAttribute('data-ac-table')) lookupQuerabilite(el);
  });

  // Validation inline au blur (port de la validation mdJsCheck* à la sortie de champ).
  racine.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('#md-form input, #md-form select, #md-form textarea')) return;
    const champ = el.closest('.md-champ') || el.parentElement;
    if (!champ) return;
    champ.querySelectorAll('.md-erreur-client').forEach((n) => n.remove());
    champ.classList.remove('md-erreur-champ');
    const err = valideChamp(el);
    if (err) {
      champ.classList.add('md-erreur-champ');
      const s = document.createElement('span');
      s.className = 'md-erreur md-erreur-client';
      s.textContent = err;
      champ.appendChild(s);
    }
  });

  // Sélection du contenu à l'entrée dans un champ maides (saisie rapide, port de select()).
  racine.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el && el.matches && el.matches('input.text, input.ordre-cle, input.querabilite, input[data-md-type]') && typeof el.select === 'function') {
      setTimeout(() => { try { el.select(); } catch { /* ignore */ } }, 0);
    }
  });

  racine.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!el.tagName) return;
    const type = el.getAttribute && (el.getAttribute('data-md-type') || (el.dataset && el.dataset.mdType));
    // champ date : '=' insère la date du jour, Suppr vide le champ (port maides)
    if (type === 'date') {
      if (e.key === '=' ) { e.preventDefault(); el.value = dateAujourdhui(); return; }
      if (e.key === 'Delete') { e.preventDefault(); el.value = ''; return; }
    }
    // '=' : ouvre la recherche quérabilité, ou déroule un select (port keys.EQUAL)
    if (e.key === '=') {
      if (el.classList && el.classList.contains('querabilite')) {
        const btn = el.parentElement && el.parentElement.querySelector('.querabilite-popup');
        if (btn) { e.preventDefault(); ouvreQuerabilite(btn); return; }
      }
      if (el.tagName === 'SELECT' && el.showPicker) { e.preventDefault(); try { el.showPicker(); } catch { /* ignore */ } return; }
    }
    // F1 : aide contextuelle sur [data-help-tag]
    if (e.key === 'F1') {
      const tag = el.closest && el.closest('[data-help-tag]');
      if (tag) { e.preventDefault(); window.open(`/aide?tag=${encodeURIComponent(tag.getAttribute('data-help-tag'))}`, 'aide', 'width=600,height=700'); return; }
    }
    if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return;
    // navigation clavier : Entrée / Bas = champ suivant, Haut = champ précédent
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusSuivant(el); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusPrecedent(el); }
  });

  rehydrate(racine === document ? document : racine);
}

// Activation automatique dans le navigateur + exposition globale (onclick des lignes de liste).
if (typeof document !== 'undefined' && document.addEventListener) {
  if (typeof window !== 'undefined') {
    window.goPage = goPage; window.confirmer = confirmer; window.demander = demander;
    // Bouton « précédent » du navigateur : recharge l'écran correspondant à l'URL.
    window.addEventListener('popstate', () => { ajax(location.href, { method: 'GET' }).then(swap).catch(() => location.reload()); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initMaides());
  else initMaides();
}

/**
 * Designer visuel (UI web) : conception d'applications « à la souris ».
 *
 * Expose dans le navigateur les éditeurs PatronEditor / EcranEditor : créer des
 * tables et leurs champs, créer des écrans et y placer des widgets, puis lancer
 * l'écran. C'est « maides qui construit maides » côté interface.
 */

import {
  PatronEditor, EcranEditor, typesWidgetsSupportes,
  MenuEditor, FormuleEditor, TableParamEditor, DroitEditor, VueEditor, SequenceEcranEditor, Requetteur,
  type LayerStore, type Patron, type TypeChamp, type ValeurDroit,
} from '@maides/core';
import { renderPage } from './page.js';
import type { RequeteMaides, ReponseMaides } from './app.js';

const TYPES_CHAMP: TypeChamp[] = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'clop', 'array'];
/** Catalogue complet des widgets disponibles (issu du registre du noyau, trié). */
const TYPES_WIDGET = typesWidgetsSupportes().sort((a, b) => a.localeCompare(b));

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export class DesignerApp {
  private patronEd: PatronEditor;
  private ecranEd: EcranEditor;
  private lettreEd: EcranEditor;
  private menuEd: MenuEditor;
  private formuleEd: FormuleEditor;
  private tabEd: TableParamEditor;
  private droitEd: DroitEditor;
  private vueEd: VueEditor;
  private seqEd: SequenceEcranEditor;

  constructor(private store: LayerStore, private titre = 'Designer') {
    this.patronEd = new PatronEditor(store);
    this.ecranEd = new EcranEditor(store, 'scr');
    this.lettreEd = new EcranEditor(store, 'let');
    this.menuEd = new MenuEditor(store);
    this.formuleEd = new FormuleEditor(store);
    this.tabEd = new TableParamEditor(store);
    this.droitEd = new DroitEditor(store);
    this.vueEd = new VueEditor(store);
    this.seqEd = new SequenceEcranEditor(store);
  }

  /** Éditeur d'écran ('scr') ou de lettre ('let') selon le patron. */
  private edPour(pat?: string): EcranEditor {
    return pat === 'let' ? this.lettreEd : this.ecranEd;
  }

  private utilisateur?: string;

  handle(req: RequeteMaides): ReponseMaides {
    this.utilisateur = req.user?.login;
    try {
      if (req.method === 'POST') return this.handleAction(req.body ?? {});
      if (req.query.table) return this.vueTable(req.query.table, req.query.champ);
      if (req.query.ecran) return this.vueEcran(req.query.ecran, req.query.pat, req.query.widget);
      if (req.query.config !== undefined) return this.vueConfig(req.query.config || '', req.query);
      return this.vueAccueil();
    } catch (e: any) {
      return this.page('Designer — erreur', `<p class="md-erreur">${esc(e?.message ?? e)}</p>`, { href: '/designer', label: 'Designer' });
    }
  }

  /* ------------------------- actions ------------------------- */

  private handleAction(body: Record<string, any>): ReponseMaides {
    const a = String(body.action ?? '');
    switch (a) {
      case 'creerTable':
        this.patronEd.creerTable(String(body.nomTable), { emplacement: body.emplacement === 'P' ? 'P' : 'D' });
        return this.redirect(`/designer?table=${encodeURIComponent(body.nomTable)}`);
      case 'ajouteChamp': {
        const table = String(body.table);
        this.patronEd.ajouteChamp(table, { nom_champ: String(body.nom_champ), type_champ: body.type_champ as TypeChamp, val_def: body.val_def || '' });
        if (body.est_cle === '1') {
          const cles = [...this.patronEd.getPatron(table).is_key];
          if (!cles.includes(body.nom_champ)) cles.push(body.nom_champ);
          this.patronEd.definitCle(table, cles);
        }
        return this.redirect(`/designer?table=${encodeURIComponent(table)}`);
      }
      case 'supprimeChamp':
        this.patronEd.supprimeChamp(String(body.table), String(body.nom_champ));
        return this.redirect(`/designer?table=${encodeURIComponent(body.table)}`);
      case 'modifChamp': {
        // Modifie un champ existant (type, valeur par défaut, clé) + renommage éventuel.
        const table = String(body.table);
        const ancien = String(body.ancien_nom);
        const nouveau = (String(body.nom_champ || ancien).trim()) || ancien;
        const before = this.patronEd.getPatron(table);
        const patch = { type_champ: body.type_champ as TypeChamp, val_def: body.val_def ?? '' };
        if (nouveau !== ancien) {
          const existant = before.champs[ancien];
          this.patronEd.supprimeChamp(table, ancien);
          this.patronEd.ajouteChamp(table, { ...existant, ...patch, nom_champ: nouveau } as any);
        } else {
          this.patronEd.modifieChamp(table, ancien, patch);
        }
        // clé visée : suit le renommage puis applique la case à cocher
        let cles = before.is_key.map((c) => (c === ancien ? nouveau : c)).filter((c) => c !== nouveau);
        if (body.est_cle === '1') cles = [...cles, nouveau];
        this.patronEd.definitCle(table, cles);
        return this.redirect(`/designer?table=${encodeURIComponent(table)}`);
      }
      case 'creerEcran': {
        const pat = body.pat === 'let' ? 'let' : 'scr';
        this.edPour(pat).creerEcran(String(body.nom), { table_liee: String(body.table_liee || ''), template: String(body.template || '') });
        return this.redirect(`/designer?ecran=${encodeURIComponent(body.nom)}&pat=${pat}`);
      }
      case 'setTemplate':
        this.edPour(body.pat).setTemplate(String(body.ecran), String(body.template || ''));
        return this.redirect(`/designer?ecran=${encodeURIComponent(body.ecran)}&pat=${body.pat || 'scr'}`);
      case 'placeWidget':
        this.edPour(body.pat).placeWidget(String(body.ecran), String(body.nom_champ), {
          type_widget: String(body.type_widget),
          libelle: body.libelle || undefined,
          formule_calcul: body.formule_calcul || undefined,
          calcul_systematique: body.formule_calcul ? '1' : undefined,
          est_notnull: body.est_notnull === '1' ? 1 : undefined,
        });
        return this.redirect(`/designer?ecran=${encodeURIComponent(body.ecran)}&pat=${body.pat || 'scr'}`);
      case 'supprimeWidget':
        this.edPour(body.pat).retireWidget(String(body.ecran), String(body.nom_champ));
        return this.redirect(`/designer?ecran=${encodeURIComponent(body.ecran)}&pat=${body.pat || 'scr'}`);
      case 'modifieWidget': {
        // Édite un widget déjà posé (type, libellé, formule, obligatoire, ordre de focus).
        this.edPour(body.pat).modifieWidget(String(body.ecran), String(body.nom_champ), {
          type_widget: body.type_widget || undefined,
          libelle: body.libelle || undefined,
          formule_calcul: body.formule_calcul || undefined,
          calcul_systematique: body.formule_calcul ? '1' : undefined,
          est_notnull: body.est_notnull === '1' ? 1 : 0,
          tabindex: body.tabindex !== '' && body.tabindex != null ? Number(body.tabindex) : undefined,
        });
        return this.redirect(`/designer?ecran=${encodeURIComponent(body.ecran)}&pat=${body.pat || 'scr'}`);
      }
      case 'supprimeTable':
        this.patronEd.supprimeTable(String(body.table));
        return this.redirect('/designer');
      case 'cloneTable':
        this.patronEd.cloneTable(String(body.table), String(body.cible));
        return this.redirect(`/designer?table=${encodeURIComponent(body.cible)}`);
      case 'defSequence': {
        const ecrans = String(body.ecrans || '').split(/[\s,]+/).filter(Boolean);
        this.seqEd.definitSequence(String(body.nom), ecrans);
        return this.redirect('/designer?config=sequence');
      }
      case 'suppSequence':
        this.seqEd.supprime(String(body.nom));
        return this.redirect('/designer?config=sequence');
      case 'defRequete': {
        const sql = String(body.sql || '');
        if (!Requetteur.valideSQL(sql)) {
          return this.page('Designer — requête refusée',
            `<p class="md-erreur">Requête refusée par REQ_valideSQL (commentaire ou mot-clé d'écriture interdit).</p><p><code>${esc(sql)}</code></p>`,
            { href: '/designer?config=requete', label: 'Requêtes' });
        }
        this.tabEd.definit('requete', String(body.nom), sql);
        return this.redirect('/designer?config=requete');
      }
      case 'suppRequete':
        this.tabEd.supprime('requete', String(body.nom));
        return this.redirect('/designer?config=requete');

      /* --- paramétrage --- */
      case 'defMenu':
        this.menuEd.definitEntree({
          menu_position: String(body.menu_position), menu_libelle: String(body.menu_libelle || ''),
          menu_script: body.menu_script || undefined, menu_droit: body.menu_droit !== '' ? Number(body.menu_droit) : undefined,
        });
        return this.redirect('/designer?config=menu');
      case 'suppMenu':
        this.menuEd.supprimeEntree(String(body.menu_position));
        return this.redirect('/designer?config=menu');
      case 'defFormule':
        this.formuleEd.definitFormule(String(body.nom), String(body.corps || ''));
        return this.redirect('/designer?config=formule');
      case 'suppFormule':
        this.formuleEd.supprime(String(body.nom));
        return this.redirect('/designer?config=formule');
      case 'defParam':
        this.tabEd.definit(String(body.table), String(body.cle), String(body.valeur ?? ''));
        return this.redirect('/designer?config=param');
      case 'suppParam':
        this.tabEd.supprime(String(body.table), String(body.cle));
        return this.redirect('/designer?config=param');
      case 'defDroit':
        this.droitEd.definitDroit(String(body.table), String(body.champ), Number(body.niveau), String(body.valeur) as ValeurDroit);
        return this.redirect('/designer?config=droit');
      case 'defVue': {
        const conditions = String(body.conditions || '').split('\n').map((s) => s.trim()).filter(Boolean);
        this.vueEd.definitVue({
          nom_vue: String(body.nom_vue),
          lignes: [{ patron: String(body.patron), cle: String(body.cle || ''), conditions }],
          champs: body.champs ? String(body.champs).split(',').map((s) => s.trim()).filter(Boolean) : false,
        });
        return this.redirect('/designer?config=vue');
      }
      case 'suppVue':
        this.vueEd.supprime(String(body.nom_vue));
        return this.redirect('/designer?config=vue');

      default:
        return this.redirect('/designer');
    }
  }

  /* ------------------------- vues ------------------------- */

  private vueAccueil(): ReponseMaides {
    const patrons = (this.store.listPatrons?.() ?? []) as Patron[];
    const ecrans = this.store.listAll('scr');
    const lettres = this.store.listAll('let');

    const listePatrons = patrons.length
      ? `<ul>${patrons.map((p) => `<li><a href="/designer?table=${esc(p.nom_table)}">${esc(p.nom_table)}</a> <small>(${p.is_key.join(', ') || 'sans clé'})</small></li>`).join('')}</ul>`
      : '<p><em>Aucune table.</em></p>';
    const listeEcrans = ecrans.length
      ? `<ul>${ecrans.map((e) => `<li><a href="/designer?ecran=${esc(e.nom_ecran)}">${esc(e.nom_ecran)}</a> <small>→ ${esc(e.table_liee || '')}</small> · <a href="/${esc(e.nom_ecran)}?o=8&b=1">lancer</a></li>`).join('')}</ul>`
      : '<p><em>Aucun écran.</em></p>';
    const listeLettres = lettres.length
      ? `<ul>${lettres.map((e) => `<li><a href="/designer?ecran=${esc(e.nom_ecran)}&pat=let">${esc(e.nom_ecran)}</a> <small>→ ${esc(e.table_liee || '')}</small></li>`).join('')}</ul>`
      : '<p><em>Aucune lettre.</em></p>';

    const corps = `
      <div class="hero"><span class="eyebrow">Designer — atelier low-code</span>
        <h1>Construisez votre application</h1>
        <p>Suivez les 3 étapes : créez une <strong>table</strong>, posez un <strong>écran</strong> dessus, puis <strong>lancez</strong>.
        Réglez ensuite les menus, formules et droits dans <a href="/designer?config">⚙ Paramétrage</a>.</p>
      </div>
      <div class="steps">
        <div class="step"><span class="step__n">1</span><div class="step__b"><h3>Créer une table</h3>
          <p>Une table = un type de fiche (ex. <code>client</code>, <code>facture</code>) et ses champs.</p></div></div>
        <div class="step"><span class="step__n">2</span><div class="step__b"><h3>Créer un écran</h3>
          <p>Un écran = le formulaire posé sur une table, avec ses champs (widgets) et formules.</p></div></div>
        <div class="step"><span class="step__n">3</span><div class="step__b"><h3>Lancer & mettre au menu</h3>
          <p>Cliquez « ▶ lancer » sur l'écran, puis ajoutez-le au menu via ⚙ Paramétrage → Menus.</p></div></div>
      </div>
      <h2>① Tables</h2>${listePatrons}
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="creerTable" />
        <div class="md-champ"><label>Nom de la table</label><input name="nomTable" required placeholder="ex. client" />
          <p class="aide">Un mot court, sans espace (ex. <code>client</code>, <code>facture</code>).</p></div>
        <div class="md-champ"><label>Emplacement</label><select name="emplacement"><option value="D">Données</option><option value="P">Paramètres</option></select>
          <p class="aide"><strong>Données</strong> = vos fiches courantes (clients, factures…). <strong>Paramètres</strong> = des réglages partagés (taux, libellés…). Dans le doute : <strong>Données</strong>.</p></div>
        <div class="md-toolbar"><button type="submit">Créer la table</button></div>
      </form>
      <h2>② Écrans</h2>${listeEcrans}
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="creerEcran" />
        <div class="md-champ"><label>Nom de l'écran</label><input name="nom" required placeholder="ex. clientSaisie" /></div>
        <div class="md-champ"><label>Table liée</label><input name="table_liee" placeholder="ex. client" />
          <p class="aide">La table dont cet écran affiche/saisit les fiches.</p></div>
        <div class="md-champ"><label>Gabarit (optionnel)</label><input name="template" placeholder="ex. Nom $nom — Ville $ville" />
          <p class="aide">Disposition libre : écrivez <code>$nom_du_champ</code> là où le champ doit apparaître. Laissez vide pour empiler les champs automatiquement.</p></div>
        <div class="md-toolbar"><button type="submit">Créer l'écran</button></div>
      </form>
      <h2>Lettres / documents</h2>${listeLettres}
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="creerEcran" />
        <input type="hidden" name="pat" value="let" />
        <div class="md-champ"><label>Nouvelle lettre</label><input name="nom" required /></div>
        <div class="md-champ"><label>Table liée</label><input name="table_liee" /></div>
        <div class="md-champ"><label>Corps (placeholders $champ)</label><textarea name="template"></textarea></div>
        <div class="md-toolbar"><button type="submit">Créer la lettre</button></div>
      </form>`;
    return this.page('Designer', corps, { href: '/menu', label: 'Retour à l’accueil' });
  }

  private vueTable(nom: string, champEdit?: string): ReponseMaides {
    const p = this.patronEd.getPatron(nom);
    const champs = Object.values(p.champs).map((c) =>
      `<tr><td>${esc(c.nom_champ)}</td><td>${esc(c.type_champ)}</td><td>${c.est_cle ? '🔑' : ''}</td>
       <td><a class="btn secondaire" href="?table=${esc(nom)}&champ=${esc(c.nom_champ)}" title="Modifier le champ">✎</a>
       <form method="post" style="display:inline"><input type="hidden" name="action" value="supprimeChamp"/><input type="hidden" name="table" value="${esc(nom)}"/><input type="hidden" name="nom_champ" value="${esc(c.nom_champ)}"/><button class="secondaire" title="Supprimer le champ">✕</button></form></td></tr>`).join('');
    const champ = champEdit ? p.champs[champEdit] : undefined;
    const opts = (sel?: string) => TYPES_CHAMP.map((t) => `<option value="${t}"${t === sel ? ' selected' : ''}>${t}</option>`).join('');
    // Formulaire d'édition (champ existant) OU d'ajout (sinon).
    const formChamp = champ
      ? `<h2>Modifier le champ « ${esc(champ.nom_champ)} »</h2>
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="modifChamp" />
        <input type="hidden" name="table" value="${esc(nom)}" />
        <input type="hidden" name="ancien_nom" value="${esc(champ.nom_champ)}" />
        <div class="md-champ"><label>Nom du champ</label><input name="nom_champ" required value="${esc(champ.nom_champ)}" />
          <p class="aide">Le renommer met à jour la structure ; la clé suit automatiquement.</p></div>
        <div class="md-champ"><label>Type</label><select name="type_champ">${opts(champ.type_champ)}</select></div>
        <div class="md-champ"><label>Valeur par défaut</label><input name="val_def" value="${esc(champ.val_def ?? '')}" /></div>
        <div class="md-champ"><label><input type="checkbox" name="est_cle" value="1"${champ.est_cle ? ' checked' : ''} /> Fait partie de la clé</label></div>
        <div class="md-toolbar"><button type="submit">Enregistrer les modifications</button>
          <a class="btn secondaire" href="?table=${esc(nom)}">Annuler</a></div>
      </form>`
      : `<h2>Ajouter un champ</h2>
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="ajouteChamp" />
        <input type="hidden" name="table" value="${esc(nom)}" />
        <div class="md-champ"><label>Nom du champ</label><input name="nom_champ" required /></div>
        <div class="md-champ"><label>Type</label><select name="type_champ">${opts()}</select></div>
        <div class="md-champ"><label>Valeur par défaut</label><input name="val_def" /></div>
        <div class="md-champ"><label><input type="checkbox" name="est_cle" value="1" /> Fait partie de la clé</label></div>
        <div class="md-toolbar"><button type="submit">Ajouter le champ</button></div>
      </form>`;
    const actionsTable = `<h2>Table</h2>
      <form method="post" class="md-ecran" style="display:inline-block; margin-right:18px">
        <input type="hidden" name="action" value="cloneTable" /><input type="hidden" name="table" value="${esc(nom)}" />
        <div class="md-champ"><label>Cloner vers</label><input name="cible" required placeholder="ex. ${esc(nom)}2" /></div>
        <div class="md-toolbar"><button type="submit" class="secondaire">Cloner la table</button></div>
      </form>
      <form method="post" style="display:inline-block; vertical-align:top; margin-top:22px" data-confirm="Supprimer la table ${esc(nom)} et son patron ?">
        <input type="hidden" name="action" value="supprimeTable" /><input type="hidden" name="table" value="${esc(nom)}" />
        <button type="submit" class="secondaire">Supprimer la table</button>
      </form>`;
    const corps = `
      <p><strong>Table ${esc(nom)}</strong> — clé : ${esc(p.is_key.join(', ') || '(aucune)')}</p>
      <table class="md-liste"><thead><tr><th>Champ</th><th>Type</th><th>Clé</th><th></th></tr></thead><tbody>${champs}</tbody></table>
      ${formChamp}${actionsTable}${this.lienRetour()}`;
    return this.page(`Designer — table ${esc(nom)}`, corps, { href: '/designer', label: 'Designer' });
  }

  private vueEcran(nom: string, pat?: string, widgetEdit?: string): ReponseMaides {
    const estLettre = pat === 'let';
    const e = this.edPour(pat).getEcran(nom);
    const type = estLettre ? 'lettre' : 'écran';
    const p = esc(pat || 'scr');
    const widgets = Object.entries(e.champs).map(([k, w]) =>
      `<tr><td>${esc(k)}</td><td>${esc(w.type_widget)}</td><td>${esc(w.formule_calcul || '')}</td>
       <td><a class="btn secondaire" href="?ecran=${esc(nom)}&pat=${p}&widget=${esc(k)}" title="Modifier le widget">✎</a>
       <form method="post" style="display:inline"><input type="hidden" name="action" value="supprimeWidget"/><input type="hidden" name="pat" value="${p}"/><input type="hidden" name="ecran" value="${esc(nom)}"/><input type="hidden" name="nom_champ" value="${esc(k)}"/><button class="secondaire">✕</button></form></td></tr>`).join('');
    const w = widgetEdit ? e.champs[widgetEdit] : undefined;
    const opts = (sel?: string) => TYPES_WIDGET.map((t) => `<option value="${t}"${t === sel ? ' selected' : ''}>${t}</option>`).join('');
    const lancer = estLettre
      ? ` · <a href="/${esc(nom)}?o=14&b=1" target="_blank">🖨 aperçu PDF</a>`
      : ` · <a href="/${esc(nom)}?o=8&b=1">▶ lancer</a>`;
    // Formulaire d'ÉDITION d'un widget posé OU de placement d'un nouveau widget.
    const formWidget = w
      ? `<h2>Modifier le widget « ${esc(widgetEdit!)} »</h2>
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="modifieWidget" />
        <input type="hidden" name="pat" value="${p}" /><input type="hidden" name="ecran" value="${esc(nom)}" />
        <input type="hidden" name="nom_champ" value="${esc(widgetEdit!)}" />
        <div class="md-champ"><label>Widget</label><select name="type_widget">${opts(w.type_widget)}</select></div>
        <div class="md-champ"><label>Libellé</label><input name="libelle" value="${esc(w.libelle || '')}" /></div>
        <div class="md-champ"><label>Formule de calcul</label><input name="formule_calcul" value="${esc(w.formule_calcul || '')}" /></div>
        <div class="md-champ"><label>Ordre de focus (tabindex)</label><input name="tabindex" type="number" value="${esc((w as any).tabindex ?? '')}" />
          <p class="aide">Ordre de tabulation entre les champs (port de pOrdreFocus).</p></div>
        <div class="md-champ"><label><input type="checkbox" name="est_notnull" value="1"${w.est_notnull ? ' checked' : ''} /> Obligatoire</label></div>
        <div class="md-toolbar"><button type="submit">Enregistrer le widget</button>
          <a class="btn secondaire" href="?ecran=${esc(nom)}&pat=${p}">Annuler</a></div>
      </form>`
      : `<h2>Placer un widget</h2>
      <form method="post" class="md-ecran">
        <input type="hidden" name="action" value="placeWidget" />
        <input type="hidden" name="pat" value="${p}" />
        <input type="hidden" name="ecran" value="${esc(nom)}" />
        <div class="md-champ"><label>Champ</label><input name="nom_champ" required placeholder="ex. nom" />
          <p class="aide">Le nom du champ de la table (ou un champ d'affichage libre).</p></div>
        <div class="md-champ"><label>Widget (type de contrôle)</label><select name="type_widget">${opts()}</select>
          <p class="aide">Le plus courant : <code>text</code>, <code>integer</code>, <code>decimal</code>, <code>date</code>, <code>select</code>, <code>boolean</code>.</p></div>
        <div class="md-champ"><label>Libellé</label><input name="libelle" placeholder="ex. Nom du client" /></div>
        <div class="md-champ"><label>Formule de calcul (optionnel)</label><input name="formule_calcul" placeholder="ex. $qte * $pu" />
          <p class="aide">Rend le champ calculé automatiquement. Utilisez <code>$autreChamp</code>.</p></div>
        <div class="md-champ"><label><input type="checkbox" name="est_notnull" value="1" /> Obligatoire</label></div>
        <div class="md-toolbar"><button type="submit">Placer le widget</button></div>
      </form>`;
    const corps = `
      <p><strong>${type} ${esc(nom)}</strong> → table <code>${esc(e.table_liee || '')}</code>${lancer}</p>
      <p>Gabarit : <code>${esc(e.template || '')}</code></p>
      <table class="md-liste"><thead><tr><th>Champ</th><th>Widget</th><th>Formule</th><th></th></tr></thead><tbody>${widgets}</tbody></table>
      ${formWidget}${this.lienRetour()}`;
    return this.page(`Designer — ${type} ${esc(nom)}`, corps, { href: '/designer', label: 'Designer' });
  }

  /* ------------------------- paramétrage ------------------------- */

  private vueConfig(section: string, query: Record<string, string> = {}): ReponseMaides {
    switch (section) {
      case 'menu': return this.configMenu();
      case 'formule': return this.configFormule();
      case 'param': return this.configParam();
      case 'droit': return this.configDroit(query.dt || '');
      case 'vue': return this.configVue();
      case 'sequence': return this.configSequence();
      case 'requete': return this.configRequete();
      default: {
        const liens = [
          ['menu', 'Menus'], ['formule', 'Formules nommées'], ['param', 'Tables de paramètres'], ['droit', 'Droits par champ'], ['vue', 'Vues'], ['sequence', 'Séquences d’écrans'], ['requete', 'Requêtes SQL'],
        ].map(([k, l]) => `<li><a href="/designer?config=${k}">${l}</a></li>`).join('')
          + '<li><a href="/utilisateurs">Utilisateurs</a></li>';
        return this.page('Designer — paramétrage', `<h2>Paramétrage</h2><ul>${liens}</ul>`, { href: '/designer', label: 'Designer' });
      }
    }
  }

  private configMenu(): ReponseMaides {
    const lignes = this.menuEd.liste().map((e) =>
      `<tr><td>${esc(e.menu_position)}</td><td>${esc(e.menu_libelle)}</td><td><code>${esc(e.menu_script || '')}</code></td><td>${e.menu_droit ?? ''}</td>
       <td><form method="post" style="display:inline"><input type="hidden" name="action" value="suppMenu"/><input type="hidden" name="menu_position" value="${esc(e.menu_position)}"/><button>✕</button></form></td></tr>`).join('');
    const corps = `<h2>Menus</h2>
      <p class="aide">Ce que vous ajoutez ici apparaît sur l'<strong>Accueil</strong>. Une entrée <strong>sans script</strong> = un titre de section ; <strong>avec un script</strong> = une tuile cliquable.</p>
      <table class="md-liste"><thead><tr><th>Position</th><th>Libellé</th><th>Script</th><th>Droit</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defMenu"/>
        <div class="md-champ"><label>Position</label><input name="menu_position" required placeholder="ex. m100" />
          <p class="aide">Sert à trier et à grouper (ordre alphabétique). Mettez la section avant ses tuiles (ex. <code>m000</code> puis <code>m100</code>, <code>m110</code>…).</p></div>
        <div class="md-champ"><label>Libellé</label><input name="menu_libelle" required placeholder="ex. Nouvelle facture" /></div>
        <div class="md-champ"><label>Script (cible) — laisser vide pour un titre de section</label><input name="menu_script" placeholder="ex. /factureSaisie?o=8&amp;b=" />
          <p class="aide">Créer une fiche → <code>/monEcran?o=8&amp;b=</code> · Ouvrir une fiche → <code>/monEcran?o=1&amp;b=&lt;clé&gt;</code> · Designer → <code>/designer</code></p></div>
        <div class="md-champ"><label>Niveau de droit (optionnel)</label><input name="menu_droit" type="number" placeholder="laisser vide = visible par tous" /></div>
        <div class="md-toolbar"><button type="submit">Enregistrer l'entrée</button></div>
      </form>${this.lienRetour()}`;
    return this.page('Designer — menus', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  private configVue(): ReponseMaides {
    const lignes = this.vueEd.liste().map((nom) => {
      const v = this.vueEd.getVue(nom);
      const src = v && Array.isArray(v.lignes) ? v.lignes.map((l) => l.patron).join(', ') : '';
      return `<tr><td>${esc(nom)}</td><td>${esc(src)}</td>
       <td><form method="post" style="display:inline"><input type="hidden" name="action" value="suppVue"/><input type="hidden" name="nom_vue" value="${esc(nom)}"/><button>✕</button></form></td></tr>`;
    }).join('');
    const corps = `<h2>Vues</h2>
      <p class="aide">Une vue agrège les fiches d'une table selon des conditions (équivalent de o_genererVue). Utilisable ensuite dans une liste (<code>recordList</code> / <code>selectList</code>).</p>
      <table class="md-liste"><thead><tr><th>Nom</th><th>Table(s)</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defVue"/>
        <div class="md-champ"><label>Nom de la vue</label><input name="nom_vue" required placeholder="ex. facturesImpayees" /></div>
        <div class="md-champ"><label>Table source</label><input name="patron" required placeholder="ex. facture" /></div>
        <div class="md-champ"><label>Clé (champs pointés)</label><input name="cle" placeholder="ex. num" /></div>
        <div class="md-champ"><label>Conditions (une par ligne)</label><textarea name="conditions" placeholder="ex. solde > 0"></textarea>
          <p class="aide">Reliées par ET ; chaque ligne peut contenir <code>et</code>/<code>ou</code>. Variables <code>$champ</code>.</p></div>
        <div class="md-champ"><label>Champs affichés (optionnel, séparés par des virgules)</label><input name="champs" placeholder="ex. num,client,total" /></div>
        <div class="md-toolbar"><button type="submit">Enregistrer la vue</button></div>
      </form>${this.lienRetour()}`;
    return this.page('Designer — vues', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  private configFormule(): ReponseMaides {
    const lignes = this.formuleEd.liste().map((f) =>
      `<tr><td>${esc(f.nom)}</td><td><code>${esc(f.corps)}</code></td>
       <td><form method="post" style="display:inline"><input type="hidden" name="action" value="suppFormule"/><input type="hidden" name="nom" value="${esc(f.nom)}"/><button>✕</button></form></td></tr>`).join('');
    const corps = `<h2>Formules nommées</h2>
      <table class="md-liste"><thead><tr><th>Nom</th><th>Corps</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defFormule"/>
        <div class="md-champ"><label>Nom (utilisable via [nom])</label><input name="nom" required /></div>
        <div class="md-champ"><label>Corps (expression)</label><input name="corps" placeholder="ex: 10 * 2" required /></div>
        <div class="md-toolbar"><button type="submit">Enregistrer la formule</button></div>
      </form>${this.lienRetour()}`;
    return this.page('Designer — formules', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  private configParam(): ReponseMaides {
    const tables = [...new Set(this.store.listAll('tab').map((r) => String(r['tab1'])))].filter(Boolean);
    const lignes = tables.flatMap((t) => this.tabEd.liste(t).map((p) =>
      `<tr><td>${esc(t)}</td><td>${esc(p.cle)}</td><td>${esc(p.valeur)}</td>
       <td><form method="post" style="display:inline"><input type="hidden" name="action" value="suppParam"/><input type="hidden" name="table" value="${esc(t)}"/><input type="hidden" name="cle" value="${esc(p.cle)}"/><button>✕</button></form></td></tr>`)).join('');
    const corps = `<h2>Tables de paramètres</h2>
      <table class="md-liste"><thead><tr><th>Table</th><th>Clé</th><th>Valeur</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defParam"/>
        <div class="md-champ"><label>Table</label><input name="table" required /></div>
        <div class="md-champ"><label>Clé</label><input name="cle" required /></div>
        <div class="md-champ"><label>Valeur</label><input name="valeur" /></div>
        <div class="md-toolbar"><button type="submit">Enregistrer le paramètre</button></div>
      </form>${this.lienRetour()}`;
    return this.page('Designer — paramètres', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  private configDroit(table: string): ReponseMaides {
    const opts = (sel?: string) => ['C', 'N', 'L', 'P'].map((v) => `<option value="${v}"${v === sel ? ' selected' : ''}>${v}</option>`).join('');
    // Sélecteur de table + GRILLE complète champs × niveaux (port de pDroitTable.dessineTableau).
    const tables = (this.store.listPatrons?.() ?? []).map((p) => p.nom_table);
    const choixTable = `<form method="get" style="margin-bottom:14px"><input type="hidden" name="config" value="droit"/>
      <label>Table : <select name="dt" onchange="this.form.submit()">${['', ...tables].map((t) => `<option value="${esc(t)}"${t === table ? ' selected' : ''}>${esc(t || '— choisir —')}</option>`).join('')}</select></label></form>`;
    let grille = '';
    if (table) {
      const g = this.droitEd.grille(table);
      const champs = Object.keys(this.patronEd.getPatron(table).champs);
      const entete = `<th>Champ</th>${Array.from({ length: 9 }, (_, i) => `<th>N${i + 1}</th>`).join('')}`;
      const lignes = champs.map((c) => {
        const cells = Array.from({ length: 9 }, (_, i) => {
          const n = i + 1; const val = (g[c] && g[c][n]) || 'C';
          return `<td><form method="post" style="margin:0"><input type="hidden" name="action" value="defDroit"/><input type="hidden" name="table" value="${esc(table)}"/><input type="hidden" name="champ" value="${esc(c)}"/><input type="hidden" name="niveau" value="${n}"/>`
            + `<select name="valeur" onchange="this.form.submit()">${opts(val)}</select></form></td>`;
        }).join('');
        return `<tr><td><strong>${esc(c)}</strong></td>${cells}</tr>`;
      }).join('');
      grille = `<table class="md-liste"><thead><tr>${entete}</tr></thead><tbody>${lignes}</tbody></table>`;
    }
    const corps = `<h2>Droits par champ (C complet · N création · L lecture · P protégé)</h2>
      ${choixTable}${grille}${this.lienRetour()}`;
    return this.page('Designer — droits', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  private configSequence(): ReponseMaides {
    const lignes = this.seqEd.liste().map((s) =>
      `<tr><td>${esc(s.nom)}</td><td><code>${esc(s.ecrans.join(' → '))}</code></td>
       <td><form method="post" style="display:inline"><input type="hidden" name="action" value="suppSequence"/><input type="hidden" name="nom" value="${esc(s.nom)}"/><button>✕</button></form></td></tr>`).join('');
    const corps = `<h2>Séquences d'écrans</h2>
      <p class="aide">Une séquence ordonne des écrans pour la navigation o=6/o=7 (Écran suivant/précédent). Utilisez le paramètre <code>?o=7&amp;seq=&lt;nom&gt;</code>.</p>
      <table class="md-liste"><thead><tr><th>Nom</th><th>Écrans</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defSequence"/>
        <div class="md-champ"><label>Nom de la séquence</label><input name="nom" required placeholder="ex. saisieClient" /></div>
        <div class="md-champ"><label>Écrans (dans l'ordre, séparés par des virgules)</label><input name="ecrans" required placeholder="ex. clientSaisie, contactSaisie, adresseSaisie" /></div>
        <div class="md-toolbar"><button type="submit">Enregistrer la séquence</button></div>
      </form>${this.lienRetour()}`;
    return this.page('Designer — séquences', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  private configRequete(): ReponseMaides {
    const lignes = this.tabEd.liste('requete').map((r) =>
      `<tr><td>${esc(r.cle)}</td><td><code>${esc(String(r.valeur))}</code></td>
       <td><form method="post" style="display:inline"><input type="hidden" name="action" value="suppRequete"/><input type="hidden" name="nom" value="${esc(r.cle)}"/><button>✕</button></form></td></tr>`).join('');
    const corps = `<h2>Requêtes SQL (requetteur Lima)</h2>
      <p class="aide">Définit des requêtes SQL nommées, <strong>validées par REQ_valideSQL</strong> (SELECT uniquement ; mots-clés d'écriture et commentaires refusés). En modèle document, elles servent de définitions validées ; l'exécution requiert un backend SQL.</p>
      <table class="md-liste"><thead><tr><th>Nom</th><th>SQL</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
      <form method="post" class="md-ecran"><input type="hidden" name="action" value="defRequete"/>
        <div class="md-champ"><label>Nom</label><input name="nom" required placeholder="ex. facturesImpayees" /></div>
        <div class="md-champ"><label>SQL (SELECT …)</label><textarea name="sql" required placeholder="SELECT num, client, total FROM facture WHERE total > 0"></textarea></div>
        <div class="md-toolbar"><button type="submit">Valider et enregistrer</button></div>
      </form>${this.lienRetour()}`;
    return this.page('Designer — requêtes', corps, { href: '/designer?config', label: 'Paramétrage' });
  }

  /* ------------------------- utilitaires ------------------------- */

  private lienRetour(): string {
    return '<p><a href="/designer">&larr; Designer</a> · <a href="/menu">Menu</a></p>';
  }

  private page(titre: string, corps: string, retour?: { href: string; label: string }): ReponseMaides {
    return {
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: renderPage(titre, corps, [], { user: this.utilisateur, section: 'designer', retour }),
    };
  }

  private redirect(location: string): ReponseMaides {
    return { status: 302, contentType: 'text/html; charset=utf-8', body: '', headers: { Location: location } };
  }
}

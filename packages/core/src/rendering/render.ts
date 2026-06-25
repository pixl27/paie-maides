/**
 * Rendu d'un écran (port modernisé de compilateurTemplate.php +
 * genereSortieWidgets/generSortieHTMLJS de jyFonctions.php).
 *
 * - Mode « formulaire » (écran 'scr') : les placeholders $champ du gabarit sont
 *   remplacés par les widgets HTML.
 * - Mode « document » (lettre 'let') : les placeholders sont remplacés par les
 *   valeurs (pour impression/PDF).
 * Sans gabarit, les champs sont rendus dans l'ordre de déclaration.
 */

import { Zzz, dicoDeZzz } from '../runtime/zzz.js';
import { renderWidget, type WidgetDataAcces } from './widgets.js';
import { escapeHtml, attrs } from './html.js';
import { compileTemplate, type CompileTemplateContexte } from './template-compiler.js';

/** Placeholder de variable dans un gabarit : $nom (lettres, chiffres, _ et []). */
const PLACEHOLDER = /\$([a-zA-Z0-9_]+)/g;

export interface RenderOptions {
  /** 'form' = widgets éditables ; 'document' = substitution de valeurs. */
  mode?: 'form' | 'document';
  /** Force la lecture seule (ex. visu o1). */
  lectureSeule?: boolean;
  /** Accès données pour les widgets liés (selectTable, recordList, sous-écrans…). */
  acces?: WidgetDataAcces;
}

/** Remplace les placeholders d'un gabarit. */
export function renderTemplate(template: string, zzz: Zzz, options: RenderOptions = {}): string {
  const mode = options.mode ?? (zzz.patEcran === 'let' ? 'document' : 'form');
  return template.replace(PLACEHOLDER, (match, nom: string) => {
    const widget = zzz.champs[nom];
    if (mode === 'form' && widget) {
      const droit = zzz.droits?.[nom];
      if (droit?.masque) return ''; // droit 'P' : champ non affiché
      return renderWidget({
        nomChamp: nom,
        widget,
        valeur: zzz.valeurs[nom],
        erreurs: widget.messerr,
        lectureSeule: options.lectureSeule || droit?.ro,
        acces: options.acces,
        cle: zzz.cle.join('.'),
        valeurs: zzz.valeurs,
      });
    }
    // mode document ou variable simple : substitution de la valeur
    if (Object.prototype.hasOwnProperty.call(zzz.valeurs, nom)) {
      return escapeHtml(zzz.valeurs[nom]);
    }
    return match; // inconnu : on laisse tel quel
  });
}

/** Rend tous les champs dans l'ordre de déclaration (gabarit absent). */
function renderTousChamps(zzz: Zzz, options: RenderOptions): string {
  return Object.keys(zzz.champs)
    .filter((nom) => !zzz.droits?.[nom]?.masque) // droit 'P' : champ non affiché
    .map((nom) => renderWidget({
      nomChamp: nom,
      widget: zzz.champs[nom]!,
      valeur: zzz.valeurs[nom],
      erreurs: zzz.champs[nom]!.messerr,
      lectureSeule: options.lectureSeule || zzz.droits?.[nom]?.ro,
      acces: options.acces,
      cle: zzz.cle.join('.'),
      valeurs: zzz.valeurs,
    }))
    .join('\n');
}

/** Contexte d'évaluation des directives @ depuis l'état d'écran. */
function contexteCompilation(zzz: Zzz): CompileTemplateContexte {
  return {
    variables: { ...zzz.valeursExtra, ...zzz.valeurs },
    dico: dicoDeZzz(zzz),
    champs: zzz.patronMaitre?.champs,
  };
}

/** Rend un écran complet (formulaire). */
export function renderEcran(zzz: Zzz, options: RenderOptions = {}): string {
  const mode = options.mode ?? (zzz.patEcran === 'let' ? 'document' : 'form');
  let template = zzz.ecran?.template;
  // Compilation des directives @ (si activée) AVANT la substitution des widgets $.
  if (template && zzz.ecran?.compiler) {
    template = compileTemplate(template, contexteCompilation(zzz));
  }
  const corps = template
    ? renderTemplate(template, zzz, { ...options, mode })
    : renderTousChamps(zzz, options);

  if (mode === 'document') return corps;

  // formulaire : champs cachés de contexte (clé, écran) + enveloppe.
  // L'ordre (o) est porté par le bouton d'action cliqué, pas par un champ caché,
  // pour que « Enregistrer » soumette bien les saisies de CE formulaire.
  const cle = zzz.cle.join('.');
  // champs cachés de contexte + variables de transfert (_vt_*) ré-émises à chaque rendu
  const vt = Object.entries(zzz.valeursExtra ?? {})
    .map(([k, v]) => `<input type="hidden" name="_vt_${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join('');
  const hidden =
    `<input type="hidden" name="e" value="${escapeHtml(zzz.e)}" />` +
    `<input type="hidden" name="b" value="${escapeHtml(cle)}" />${vt}`;
  return `<form id="md-form" class="md-ecran" action="/${escapeHtml(zzz.e)}" data-ecran="${escapeHtml(zzz.e)}" data-md-ajax method="post">${hidden}${corps}</form>`;
}

export interface ColonneListe {
  champ: string;
  libelle?: string;
}

export interface ListeOptions {
  /** Écran cible pour le lien d'ouverture d'une ligne. */
  lienEcran?: string;
  /** Champs composant la clé (pour construire le lien). */
  cleChamps?: string[];
}

/** Rend une liste d'enregistrements en tableau HTML (port simplifié des vues). */
export function renderListe(records: Record<string, any>[], colonnes: ColonneListe[], options: ListeOptions = {}): string {
  const thead = colonnes.map((c) => `<th>${escapeHtml(c.libelle ?? c.champ)}</th>`).join('');
  const corps = records.map((rec) => {
    const cells = colonnes.map((c, i) => {
      const valeur = escapeHtml(rec[c.champ]);
      if (i === 0 && options.lienEcran && options.cleChamps) {
        const cle = options.cleChamps.map((f) => rec[f]).join('.');
        const href = `?e=${encodeURIComponent(options.lienEcran)}&o=1&b=${encodeURIComponent(cle)}`;
        return `<td><a${attrs({ href })}>${valeur}</a></td>`;
      }
      return `<td>${valeur}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table class="md-liste"><thead><tr>${thead}</tr></thead><tbody>${corps}</tbody></table>`;
}

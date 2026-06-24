/** Logique pure (testable sans DOM) : sérialisation de formulaire, parsing de script de menu. */

import type { ChampMeta } from './types.js';

/** Champs système non éditables (ne pas renvoyer au serveur). */
const SYSTEME = new Set(['created_at', 'created_by', 'updated_at', 'updated_by', '_type_doc', '_id', '_key', '__tag__']);
const MAGIQUES = /^(__|UTI$)/;
/** Widgets non porteurs de valeur de saisie. */
const NON_SAISIE = new Set(['label', 'titre', 'separateur', 'button', 'ordreBoutonObe', 'recordList', 'selectList', 'arrayList', 'dataReport', 'zoneDoc', 'zonePDF', 'zoneImg', 'display', 'selectAggregate', 'autoInc']);

/** Construit le corps POST à partir des champs éditables et de leurs valeurs. */
export function valeursFormulaire(
  champs: Record<string, ChampMeta>,
  valeurs: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [nom, meta] of Object.entries(champs)) {
    if (SYSTEME.has(nom) || MAGIQUES.test(nom)) continue;
    if (meta.est_lecture_seule) continue;
    if (NON_SAISIE.has(String(meta.type_widget))) continue;
    out[nom] = valeurs[nom] ?? '';
  }
  return out;
}

/**
 * Parse un script de menu legacy (querystring) en cible navigable.
 * Exemples : "?o=1&e=azxVue" -> {ecran:'azxVue', o:1} ; "?module=pStructure" -> {module:'pStructure'}.
 */
export function parseScript(script: string): { ecran?: string; b?: string; o?: number; module?: string } {
  const qs = script.replace(/^[?#]/, '');
  const params = new URLSearchParams(qs);
  const module = params.get('module') ?? undefined;
  const ecran = params.get('e') ?? undefined;
  const b = params.get('b') ?? undefined;
  const oStr = params.get('o');
  const res: { ecran?: string; b?: string; o?: number; module?: string } = {};
  if (module && !ecran) res.module = module;
  if (ecran) res.ecran = ecran;
  if (b) res.b = b;
  if (oStr !== null && oStr !== '') res.o = Number(oStr);
  return res;
}

/** Indique si une cible de menu est exécutable par la SPA (écran piloté par données). */
export function estNavigable(script: string): boolean {
  return parseScript(script).ecran !== undefined;
}

/** Utilitaires de génération HTML (échappement, attributs). */

const ESC: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Échappe le texte pour insertion dans du HTML. */
export function escapeHtml(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]!);
}

/** Échappe une valeur d'attribut. */
export function escapeAttr(s: any): string {
  return escapeHtml(s);
}

/** Construit une chaine d'attributs HTML à partir d'un objet (valeurs nulles ignorées). */
export function attrs(map: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (v === null || v === undefined || v === false) continue;
    if (v === true) { parts.push(k); continue; }
    parts.push(`${k}="${escapeAttr(v)}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

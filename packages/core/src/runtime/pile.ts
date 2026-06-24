/**
 * Pile de navigation (port de gestionPile) : empile les écrans visités, et les
 * ordres négatifs (-1/-2/-3) dépilent pour revenir en arrière.
 * État de session : à conserver côté serveur par session utilisateur.
 */

export interface EntreePile {
  e: string;
  b: string;
  o?: number | string;
}

export class PileNavigation {
  private pile: EntreePile[] = [];

  empile(entree: EntreePile): void { this.pile.push(entree); }

  /** Dépile n niveaux et renvoie l'entrée au sommet (ou null). */
  depile(n = 1): EntreePile | null {
    for (let i = 0; i < n && this.pile.length > 0; i++) this.pile.pop();
    return this.sommet();
  }

  sommet(): EntreePile | null { return this.pile[this.pile.length - 1] ?? null; }
  taille(): number { return this.pile.length; }
  vide(): void { this.pile = []; }
  entrees(): readonly EntreePile[] { return this.pile; }

  /** Ordre négatif (-1/-2/-3) : dépile |o| niveaux et renvoie la cible. */
  navigueOrdreNegatif(o: number): EntreePile | null {
    return o < 0 ? this.depile(-o) : this.sommet();
  }
}

/** Décode un ordre avec option (port de recupRequest : o = "9:8" -> ordre 9, option 8). */
export function parseOrdre(o: string | number): { ordre: string; option: string | null } {
  const s = String(o);
  const i = s.indexOf(':');
  return i === -1 ? { ordre: s, option: null } : { ordre: s.slice(0, i), option: s.slice(i + 1) };
}

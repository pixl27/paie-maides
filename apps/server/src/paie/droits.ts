/** Droits d'accès spécifiques de la paie. */
import { DroitEditor, type LayerStore } from '@maides/core';

/** Le coût employeur n'est visible que par les niveaux privilégiés (≤ 5). */
export function definitDroits(data: LayerStore): void {
  new DroitEditor(data).definitDroit('bul', 'cout_employeur', 5, 'P');
}

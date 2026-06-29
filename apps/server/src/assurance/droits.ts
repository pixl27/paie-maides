/** Droits d'accès spécifiques de l'assurance. */
import { DroitEditor, type LayerStore } from '@maides/core';

/** La commission n'est visible que par les niveaux privilégiés (≤ 5). */
export function definitDroits(data: LayerStore): void {
  new DroitEditor(data).definitDroit('qit', 'commission', 5, 'P');
}

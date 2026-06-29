/** Fabriques de widgets partagées entre écrans de la comptabilité. */
import type { Widget, TypeChamp } from '@maides/core';

/**
 * Widget en LECTURE SEULE dont la valeur est une formule nommée `[nom]`,
 * recalculée systématiquement à l'affichage (totaux, soldes, équilibre…).
 */
export const calc = (nom: string, libelle: string): Widget => ({
  type_widget: 'decimal',
  type_champ: 'decimal' as TypeChamp,
  libelle,
  formule_calcul: `[${nom}]`,
  calcul_systematique: '1',
  est_lecture_seule: 1,
});

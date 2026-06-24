/**
 * Validation de saisie (port de validationSaisie de jyFonctions.php).
 * Contrôle, champ par champ : type, obligatoire (NOT NULL), longueur, bornes
 * min/max et formule de validation. Accumule les messages d'erreur par champ et
 * positionne `zzz.erreurBloquante`.
 */

import { MdExpression } from '../expression/mdExpression.js';
import { isVoid, truthy } from '../expression/value.js';
import { Zzz, dicoDeZzz } from './zzz.js';
import { EvalContext } from './formulage.js';
import { WIDGETS_EXCLUS_VALIDATION, DB_DEFAULT_STRING_LENGTH } from './ecran.js';

/** Résultat de validation : erreurs par champ. */
export interface ResultatValidation {
  erreurBloquante: boolean;
  erreurs: Record<string, string[]>;
}

function typeChampEffectif(zzz: Zzz, nomChamp: string, widget: Record<string, any>): string {
  if (widget.type_champ) return widget.type_champ;
  const patronType = zzz.patronMaitre?.champs[nomChamp]?.type_champ;
  if (patronType) return patronType;
  switch (widget.type_widget) {
    case 'decimal': return 'decimal';
    case 'integer': return 'integer';
    case 'date': return 'date';
    default: {
      const v = zzz.valeurs[nomChamp];
      if (v !== '' && v != null && !Number.isNaN(Number(v))) {
        return Number.isInteger(Number(v)) ? 'integer' : 'decimal';
      }
      return 'string';
    }
  }
}

export function validationSaisie(zzz: Zzz, ctx: EvalContext = {}): ResultatValidation {
  zzz.erreurBloquante = false;
  const erreurs: Record<string, string[]> = {};

  for (const [nomChamp, widget] of Object.entries(zzz.champs)) {
    if (WIDGETS_EXCLUS_VALIDATION.includes(String(widget.type_widget))) continue;

    const messerr: string[] = [];
    const type = typeChampEffectif(zzz, nomChamp, widget);
    const valeur = zzz.valeurs[nomChamp];
    const estVide = valeur === '' || valeur == null;
    const valStr = String(valeur ?? '');

    switch (type) {
      case 'string': {
        let maxLen = widget.option_type_champ;
        if ((maxLen === '' || maxLen === undefined) && widget.type_var !== 'lbr') maxLen = DB_DEFAULT_STRING_LENGTH;
        if (maxLen !== '' && maxLen !== undefined && valStr.length > Number(maxLen)) {
          messerr.push('Saisie trop longue');
        }
        if (widget.est_notnull === 1 && valStr.length === 0) messerr.push('Obligatoire');
        if (widget.val_min != null && widget.val_min !== '' && !estVide && valStr < String(widget.val_min)) {
          messerr.push(`Ne peux pas être < ${widget.val_min}`);
        }
        if (widget.val_max != null && widget.val_max !== '' && !estVide && valStr > String(widget.val_max)) {
          messerr.push(`Ne peux pas être > ${widget.val_max}`);
        }
        break;
      }
      case 'integer': {
        if (!estVide && parseInt(valStr, 10) !== Number(valeur)) messerr.push('Doit être un entier');
        if (widget.est_notnull === 1 && valStr.length === 0) messerr.push('Obligatoire');
        if (widget.val_min != null && widget.val_min !== '' && !estVide && parseInt(valStr, 10) < parseInt(String(widget.val_min), 10)) {
          messerr.push(`Ne peux pas être < ${widget.val_min}`);
        }
        if (widget.val_max != null && widget.val_max !== '' && !estVide && parseInt(valStr, 10) > parseInt(String(widget.val_max), 10)) {
          messerr.push(`Ne peux pas être > ${widget.val_max}`);
        }
        break;
      }
      case 'decimal': {
        if (!estVide && Number.isNaN(Number(valeur))) messerr.push('Doit être numérique');
        if (widget.est_notnull === 1 && valStr.length === 0) messerr.push('Obligatoire');
        if (widget.val_min != null && widget.val_min !== '' && !estVide && Number(valeur) < Number(widget.val_min)) {
          messerr.push(`Ne peux pas être < ${widget.val_min}`);
        }
        if (widget.val_max != null && widget.val_max !== '' && !estVide && Number(valeur) > Number(widget.val_max)) {
          messerr.push(`Ne peux pas être > ${widget.val_max}`);
        }
        break;
      }
      case 'date': {
        // la sentinelle '0000-00-00' vaut « pas de date » (port de validationSaisie)
        const estVideDate = estVide || valStr === '0000-00-00';
        if (widget.est_notnull === 1 && estVideDate) messerr.push('Obligatoire');
        if (!estVideDate) {
          const lit = /^(\d{2})-(\d{2})-(\d{4})$/.exec(valStr);
          const aParser = lit ? `${lit[3]}-${lit[2]}-${lit[1]}` : valStr; // JJ-MM-AAAA -> AAAA-MM-JJ
          const t = Date.parse(aParser);
          if (Number.isNaN(t)) messerr.push('Date invalide');
          else {
            if (widget.val_min != null && widget.val_min !== '' && t < Date.parse(String(widget.val_min))) {
              messerr.push(`Ne peux pas être < au ${widget.val_min}`);
            }
            if (widget.val_max != null && widget.val_max !== '' && t > Date.parse(String(widget.val_max))) {
              messerr.push(`Ne peux pas être > au ${widget.val_max}`);
            }
          }
        }
        break;
      }
    }

    // validation par formule
    if (widget.validation) {
      try {
        const exp = new MdExpression(widget.validation, {
          variables: zzz.valeurs,
          dico: dicoDeZzz(zzz),
          providers: ctx.providers,
          user: ctx.user,
          isConsole: ctx.isConsole,
        });
        const res = exp.calcul();
        if (isVoid(res) || !truthy(res)) {
          messerr.push(widget.mess_validation || `Erreur code ${nomChamp} sans description`);
        }
      } catch {
        messerr.push(`Erreur de syntaxe dans le validateur : ${nomChamp}`);
      }
    }

    if (messerr.length > 0) {
      erreurs[nomChamp] = messerr;
      zzz.champs[nomChamp]!.messerr = messerr;
      zzz.erreurBloquante = true;
    }
  }

  return { erreurBloquante: zzz.erreurBloquante, erreurs };
}

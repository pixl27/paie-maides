/**
 * Formulage : application des formules de calcul des champs (port de
 * formulage()/calculFormuleChamps de jyFonctions.php).
 *
 * Pour chaque champ portant `formule_calcul` :
 *  - `calcul_systematique` = '1' : recalculé systématiquement ;
 *  - `calcul_systematique` = '0' : recalculé uniquement si le document est nouveau ;
 *  - sinon : ignoré.
 * Le résultat (non void) est écrit dans `zzz.valeurs[champ]` (dates -> AAAA-MM-JJ).
 */

import { MdExpression } from '../expression/mdExpression.js';
import { retVal, isVoid } from '../expression/value.js';
import { Providers, UserInfo } from '../expression/env.js';
import { Zzz, dicoDeZzz } from './zzz.js';

export interface EvalContext {
  providers?: Providers;
  user?: UserInfo;
  isConsole?: boolean;
}

/** Crée un moteur d'expressions partageant les valeurs de `zzz` (modifs persistées). */
export function moteurSurZzz(zzz: Zzz, formule: string, ctx: EvalContext): MdExpression {
  return new MdExpression(formule, {
    variables: zzz.valeurs, // même référence : les affectations $x := ... persistent
    dico: dicoDeZzz(zzz),
    providers: ctx.providers,
    user: ctx.user,
    isConsole: ctx.isConsole,
  });
}

/** Applique les formules de tous les champs de l'écran (port de formulage). */
export function formulage(zzz: Zzz, ctx: EvalContext = {}): void {
  for (const [nomChamp, champ] of Object.entries(zzz.champs)) {
    if (!champ.formule_calcul) continue;

    const systematique = String(champ.calcul_systematique ?? '');
    const doitCalculer =
      systematique === '1' || (systematique === '0' && zzz.nouveauDoc);
    if (!doitCalculer) continue;

    if (zzz.valeurs[nomChamp] === undefined) zzz.valeurs[nomChamp] = '';

    try {
      const moteur = moteurSurZzz(zzz, champ.formule_calcul, ctx);
      const res = moteur.calcul();
      // report des messages éventuels émis par la formule
      zzz.messages.push(...moteur.messages);
      if (!isVoid(res)) {
        zzz.valeurs[nomChamp] = retVal(res); // les dates sont converties en AAAA-MM-JJ
      }
    } catch {
      // on conserve la valeur courante et on signale l'erreur de formule
      zzz.messages.push({
        type: 'erreur',
        text: `Erreur dans la formule du widget ${nomChamp} : ${champ.formule_calcul}`,
      });
    }
  }
}

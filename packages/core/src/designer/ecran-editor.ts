/**
 * Éditeur d'écrans (port du cœur fonctionnel de pEcranAssign.php / pEcrans.php).
 *
 * Les écrans sont des documents du patron 'scr' (ou 'let' pour les lettres) :
 * l'éditeur les crée et place/retire des widgets, en s'appuyant sur le stockage
 * standard de la couche. Comme le reste, c'est « maides qui édite maides ».
 */

import { Ecran, Widget } from '../runtime/ecran.js';
import { LayerStore } from '../r4/layers.js';

const PATRON_DEFAUT = 'scr';

export class EcranEditor {
  constructor(private store: LayerStore, private patEcran: 'scr' | 'let' = PATRON_DEFAUT) {}

  private cle(nomEcran: string): string[] {
    return [nomEcran];
  }

  /** Crée un écran (port de la création d'écran). */
  creerEcran(nomEcran: string, options: { table_liee?: string; template?: string } = {}): Ecran {
    if (this.store.search(this.patEcran, this.cle(nomEcran))) {
      throw new Error(`L'écran ${nomEcran} existe déjà.`);
    }
    const ecran: Ecran & { nom_ecran: string } = {
      nom_ecran: nomEcran,
      table_liee: options.table_liee ?? '',
      template: options.template ?? '',
      champs: {},
    };
    this.store.save(this.patEcran, ecran);
    return ecran;
  }

  /** Récupère un écran. */
  getEcran(nomEcran: string): Ecran {
    const rec = this.store.search(this.patEcran, this.cle(nomEcran));
    if (!rec) throw new Error(`Écran ${nomEcran} introuvable.`);
    return rec as Ecran;
  }

  /** Définit la table liée (fichier maître). */
  setTableLiee(nomEcran: string, table: string): Ecran {
    const ecran = this.getEcran(nomEcran);
    ecran.table_liee = table;
    this.store.save(this.patEcran, ecran);
    return ecran;
  }

  /** Définit le gabarit (template). */
  setTemplate(nomEcran: string, template: string): Ecran {
    const ecran = this.getEcran(nomEcran);
    ecran.template = template;
    this.store.save(this.patEcran, ecran);
    return ecran;
  }

  /** Place (ou remplace) un widget sur un champ (port de pEcranAssign). */
  placeWidget(nomEcran: string, nomChamp: string, widget: Widget): Ecran {
    const ecran = this.getEcran(nomEcran);
    ecran.champs[nomChamp] = { ...widget, type_widget: widget.type_widget ?? 'text' };
    this.store.save(this.patEcran, ecran);
    return ecran;
  }

  /** Modifie un widget existant. */
  modifieWidget(nomEcran: string, nomChamp: string, patch: Partial<Widget>): Ecran {
    const ecran = this.getEcran(nomEcran);
    if (!ecran.champs[nomChamp]) throw new Error(`Widget ${nomChamp} inconnu dans l'écran ${nomEcran}.`);
    ecran.champs[nomChamp] = { ...ecran.champs[nomChamp], ...patch };
    this.store.save(this.patEcran, ecran);
    return ecran;
  }

  /** Retire un widget. */
  retireWidget(nomEcran: string, nomChamp: string): Ecran {
    const ecran = this.getEcran(nomEcran);
    delete ecran.champs[nomChamp];
    this.store.save(this.patEcran, ecran);
    return ecran;
  }

  /** Duplique un écran (port de pscr_clone). */
  cloneEcran(source: string, cible: string): Ecran {
    const src = this.getEcran(source);
    if (this.store.search(this.patEcran, this.cle(cible))) throw new Error(`L'écran ${cible} existe déjà.`);
    const copie = structuredClone(src) as Ecran & { nom_ecran: string };
    copie.nom_ecran = cible;
    this.store.save(this.patEcran, copie);
    return copie;
  }

  /** Supprime un écran (port de pscr_delete). */
  supprimeEcran(nomEcran: string): boolean {
    return this.store.delete(this.patEcran, this.cle(nomEcran));
  }
}

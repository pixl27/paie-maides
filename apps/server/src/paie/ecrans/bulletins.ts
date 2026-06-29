/**
 * Écrans bulletins de paie : liste `paie_buls` + fiche `paie_bul` (saisies des
 * gains + tous les résultats calculés à 100% par les formules nommées).
 */
import type { EcranEditor } from '@maides/core';
import { calc } from '../widgets.js';

export function definitEcransBulletins(scr: EcranEditor): void {
  scr.creerEcran('paie_buls', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/paie_bul?o=8&b=">+ Nouveau bulletin</a></div>$liste' });
  scr.placeWidget('paie_buls', 'liste', { type_widget: 'selectList', option_type_widget: 'table=bul\necran=paie_bul\ncols=bul_1:N°;periode:Période;sal_id:Salarié;brut:Brut;net_a_payer:Net à payer' });

  // Fiche BULLETIN : saisies + résultats 100% calculés par les formules maides.
  scr.creerEcran('paie_bul', { table_liee: 'bul', template: '' });
  scr.placeWidget('paie_bul', 'sal_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'Salarié (n°)' });
  scr.placeWidget('paie_bul', 'periode', { type_widget: 'text', type_champ: 'clop', libelle: 'Période (AAAAMM)' });
  scr.placeWidget('paie_bul', 'salaire_base', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Salaire de base (brut)' });
  scr.placeWidget('paie_bul', 'heures_sup', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Heures supplémentaires' });
  scr.placeWidget('paie_bul', 'taux_hs', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux horaire majoré' });
  scr.placeWidget('paie_bul', 'primes', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Primes' });
  scr.placeWidget('paie_bul', 'brut', calc('brut', 'Salaire brut'));
  scr.placeWidget('paie_bul', 'plafond', calc('plafond', 'Plafond SS (tranche A)'));
  scr.placeWidget('paie_bul', 'base_csg', calc('base_csg', 'Base CSG/CRDS'));
  scr.placeWidget('paie_bul', 'total_cot_sal', calc('cot_sal', 'Total cotisations salariales'));
  scr.placeWidget('paie_bul', 'net_a_payer', calc('net_ap', 'Net à payer'));
  scr.placeWidget('paie_bul', 'net_imposable', calc('net_imp', 'Net imposable'));
  scr.placeWidget('paie_bul', 'total_cot_pat', calc('cot_pat', 'Total cotisations patronales'));
  scr.placeWidget('paie_bul', 'cout_employeur', calc('cout_emp', 'Coût total employeur'));
}

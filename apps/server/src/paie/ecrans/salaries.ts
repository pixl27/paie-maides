/** Écrans salariés : fiche `paie_sal` + liste `paie_sals`. */
import type { EcranEditor } from '@maides/core';

export function definitEcransSalaries(scr: EcranEditor): void {
  scr.creerEcran('paie_sal', { table_liee: 'sal', template: 'Employeur n° $emp_id<br/>Matricule $matricule<br/>Nom $nom Prénom $prenom<br/>NIR $nir<br/>Embauche $date_embauche<br/>Statut $statut Contrat $contrat<br/>Salaire de base $salaire_base' });
  scr.placeWidget('paie_sal', 'emp_id', { type_widget: 'integer', type_champ: 'integer', libelle: 'Employeur (n°)' });
  scr.placeWidget('paie_sal', 'matricule', { type_widget: 'text', type_champ: 'string', libelle: 'Matricule' });
  scr.placeWidget('paie_sal', 'nom', { type_widget: 'text', type_champ: 'string', libelle: 'Nom', est_notnull: 1 });
  scr.placeWidget('paie_sal', 'prenom', { type_widget: 'text', type_champ: 'string', libelle: 'Prénom' });
  scr.placeWidget('paie_sal', 'nir', { type_widget: 'text', type_champ: 'string', libelle: 'N° sécurité sociale' });
  scr.placeWidget('paie_sal', 'date_embauche', { type_widget: 'date', type_champ: 'date', libelle: 'Date d’embauche' });
  scr.placeWidget('paie_sal', 'statut', { type_widget: 'text', type_champ: 'clop', libelle: 'Statut (cadre/non-cadre)' });
  scr.placeWidget('paie_sal', 'contrat', { type_widget: 'text', type_champ: 'clop', libelle: 'Contrat (CDI/CDD)' });
  scr.placeWidget('paie_sal', 'salaire_base', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Salaire de base mensuel (brut)' });

  scr.creerEcran('paie_sals', { table_liee: '', template: '<div class="md-toolbar"><a class="btn" data-md-ajax href="/paie_sal?o=8&b=">+ Nouveau salarié</a></div>$liste' });
  scr.placeWidget('paie_sals', 'liste', { type_widget: 'selectList', option_type_widget: 'table=sal\necran=paie_sal\ncols=matricule:Matricule;nom:Nom;prenom:Prénom;salaire_base:Salaire de base' });
}

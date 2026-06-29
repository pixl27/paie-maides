/**
 * Tables (patrons) de l'application d'assurance : tiers (adr), quittance (qit) et
 * renouvellement bonus-malus (renouv).
 */
import { PatronEditor, type TypeChamp } from '@maides/core';

export function definitTables(pat: PatronEditor): void {
  // tiers
  pat.creerTable('adr', { emplacement: 'D' });
  pat.ajouteChamp('adr', { nom_champ: 'adr_1', type_champ: 'integer', est_autoincrement: 1 });
  pat.ajouteChamp('adr', { nom_champ: 'adr_12', type_champ: 'string' });
  pat.ajouteChamp('adr', { nom_champ: 'adr_email', type_champ: 'string' });
  pat.definitCle('adr', ['adr_1']);

  // quittance
  pat.creerTable('qit', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'qit_1', type_champ: 'integer' as TypeChamp, est_autoincrement: 1 },
    { nom_champ: 'base', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'prorata', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'bonus', type_champ: 'integer' as TypeChamp },
    { nom_champ: 'taux_code', type_champ: 'clop' as TypeChamp },
    { nom_champ: 'com_taux', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'pnet', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'taxe', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'ttc', type_champ: 'decimal' as TypeChamp },
    { nom_champ: 'commission', type_champ: 'decimal' as TypeChamp },
  ]) pat.ajouteChamp('qit', c);
  pat.definitCle('qit', ['qit_1']);

  // renouvellement (bonus-malus)
  pat.creerTable('renouv', { emplacement: 'D' });
  pat.ajouteChamp('renouv', { nom_champ: 'renouv_1', type_champ: 'integer', est_autoincrement: 1 });
  pat.ajouteChamp('renouv', { nom_champ: 'crm_prec', type_champ: 'integer' });
  pat.ajouteChamp('renouv', { nom_champ: 'responsable', type_champ: 'integer' });
  pat.ajouteChamp('renouv', { nom_champ: 'crm', type_champ: 'integer' });
  pat.definitCle('renouv', ['renouv_1']);
}

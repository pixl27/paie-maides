/**
 * Formules nommées de la comptabilité (éditables au Designer > Formules).
 *
 * Tous les totaux sont dérivés des lignes par `aggregate(...)`. Les filtres
 * dynamiques sont construits par concaténation : "ecr_id = " + n° courant.
 */
import { FormuleEditor } from '@maides/core';

/** Définit toutes les formules nommées de la comptabilité. */
export function definitFormules(frm: FormuleEditor): void {
  // Classe PCG d'une ligne = 1er chiffre du n° de compte, robuste quelle que soit
  // la longueur (sous-comptes 6+ chiffres) : classe = compte / 10^(nb_chiffres-1).
  // nb_chiffres = LONGUEUR de la chaîne du nombre (taille(chaine(...))) : compte EXACT,
  // sans ln ni epsilon. Évite le bug du log (ex. 999999999 lu à 9 chiffres + ε → classe 0
  // au lieu de 9) ET la division par zéro sur compte vide (taille("0")=1 ⇒ 10^0=1 ⇒ classe 0).
  frm.definitFormule('lig_classe', 'int( int($compte) / (10 ^ (taille(chaine(int($compte))) - 1)) )');
  // Équilibre d'une écriture = Σ débit − Σ crédit de SES lignes (0 = équilibrée).
  frm.definitFormule('ecr_tdeb', 'rn(0.01, aggregate("somme","lig","debit","ecr_id = " + $ecr_1))');
  frm.definitFormule('ecr_tcred', 'rn(0.01, aggregate("somme","lig","credit","ecr_id = " + $ecr_1))');
  frm.definitFormule('ecr_eq', 'rn(0.01, [ecr_tdeb] - [ecr_tcred])');
  // Solde d'un compte = Σ débit − Σ crédit de SES lignes (>0 débiteur, <0 créditeur).
  frm.definitFormule('cpt_deb', 'rn(0.01, aggregate("somme","lig","debit","compte = " + $cpt_num))');
  frm.definitFormule('cpt_cred', 'rn(0.01, aggregate("somme","lig","credit","compte = " + $cpt_num))');
  frm.definitFormule('cpt_sld', 'rn(0.01, [cpt_deb] - [cpt_cred])');
  // Compte de résultat : SOLDE NET par classe (gère les avoirs / contre-passations).
  // Charge nette (classe 6) = Σ débit − Σ crédit ; produit net (classe 7) = Σ crédit − Σ débit.
  frm.definitFormule('res_ch', 'rn(0.01, aggregate("somme","lig","debit","classe = 6") - aggregate("somme","lig","credit","classe = 6"))');
  frm.definitFormule('res_pr', 'rn(0.01, aggregate("somme","lig","credit","classe = 7") - aggregate("somme","lig","debit","classe = 7"))');
  frm.definitFormule('res_net', 'rn(0.01, [res_pr] - [res_ch])');
  // BILAN par MASSES (net par classe) — ROBUSTE : ACTIF = soldes nets débiteurs des
  // classes 2,3,4,5 ; PASSIF = capitaux (classe 1, net créditeur) + résultat.
  // Identité comptable : (cl2+cl3+cl4+cl5)(D−C) ≡ cl1(C−D) + résultat ⇒ actif = passif TOUJOURS.
  frm.definitFormule('bil_immo', 'rn(0.01, aggregate("somme","lig","debit","classe = 2") - aggregate("somme","lig","credit","classe = 2"))');
  frm.definitFormule('bil_stocks', 'rn(0.01, aggregate("somme","lig","debit","classe = 3") - aggregate("somme","lig","credit","classe = 3"))');
  frm.definitFormule('bil_tiers', 'rn(0.01, aggregate("somme","lig","debit","classe = 4") - aggregate("somme","lig","credit","classe = 4"))');
  frm.definitFormule('bil_treso', 'rn(0.01, aggregate("somme","lig","debit","classe = 5") - aggregate("somme","lig","credit","classe = 5"))');
  frm.definitFormule('bil_actif', 'rn(0.01, [bil_immo] + [bil_stocks] + [bil_tiers] + [bil_treso])');
  frm.definitFormule('bil_capx', 'rn(0.01, aggregate("somme","lig","credit","classe = 1") - aggregate("somme","lig","debit","classe = 1"))');
  frm.definitFormule('bil_passif', 'rn(0.01, [bil_capx] + [res_net])');
  // DÉCLARATION DE TVA : collectée (445710) − déductible (445660) = TVA à décaisser.
  frm.definitFormule('tva_col', 'rn(0.01, aggregate("somme","lig","credit","compte = 445710") - aggregate("somme","lig","debit","compte = 445710"))');
  frm.definitFormule('tva_ded', 'rn(0.01, aggregate("somme","lig","debit","compte = 445660") - aggregate("somme","lig","credit","compte = 445660"))');
  frm.definitFormule('tva_due', 'rn(0.01, [tva_col] - [tva_ded])');
  // FACTURATION : TVA, TTC, montant réglé (Σ règlements de CETTE facture), solde restant dû.
  frm.definitFormule('fac_tva', 'rn(0.01, $ht * $tva_taux / 100)');
  frm.definitFormule('fac_ttc', 'rn(0.01, $ht + [fac_tva])');
  frm.definitFormule('fac_regle', 'rn(0.01, aggregate("somme","reg","montant","fac_id = " + $fac_1))');
  frm.definitFormule('fac_solde', 'rn(0.01, [fac_ttc] - [fac_regle])');
}

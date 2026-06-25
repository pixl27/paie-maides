/**
 * Lanceur « assurance low-code » : démarre un serveur maides dont l'application
 * d'assurance (tiers, quittance calculée, renouvellement bonus-malus) est montée
 * UNIQUEMENT par des données via les éditeurs du constructeur — puis exécutée par
 * le runtime générique. Login admin / admin.
 *
 * Lancer :  npm run start:assurance -w @maides/server
 *           (ou : npx tsx apps/server/src/serveur-assurance.ts)
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  R4, MemoryLayerStore, MemoryUserStore, Runtime, creerPatron,
  PatronEditor, EcranEditor, FormuleEditor, TableParamEditor, DroitEditor,
  type MenuEntry,
} from '@maides/core';
import { MaidesApp } from './app.js';
import { demarrer } from './http.js';

function construitAssurance() {
  const data = new MemoryLayerStore();
  const params = new MemoryLayerStore().definePatron(
    creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' }),
  );

  const pat = new PatronEditor(data);
  // tiers
  pat.creerTable('adr', { emplacement: 'D' });
  pat.ajouteChamp('adr', { nom_champ: 'adr_1', type_champ: 'integer', est_autoincrement: 1 });
  pat.ajouteChamp('adr', { nom_champ: 'adr_12', type_champ: 'string' });
  pat.ajouteChamp('adr', { nom_champ: 'adr_email', type_champ: 'string' });
  pat.definitCle('adr', ['adr_1']);
  // quittance
  pat.creerTable('qit', { emplacement: 'D' });
  for (const c of [
    { nom_champ: 'qit_1', type_champ: 'integer' as const, est_autoincrement: 1 },
    { nom_champ: 'base', type_champ: 'decimal' as const },
    { nom_champ: 'prorata', type_champ: 'decimal' as const },
    { nom_champ: 'bonus', type_champ: 'integer' as const },
    { nom_champ: 'taux_code', type_champ: 'clop' as const },
    { nom_champ: 'com_taux', type_champ: 'decimal' as const },
    { nom_champ: 'pnet', type_champ: 'decimal' as const },
    { nom_champ: 'taxe', type_champ: 'decimal' as const },
    { nom_champ: 'ttc', type_champ: 'decimal' as const },
    { nom_champ: 'commission', type_champ: 'decimal' as const },
  ]) pat.ajouteChamp('qit', c);
  pat.definitCle('qit', ['qit_1']);
  // renouvellement (bonus-malus)
  pat.creerTable('renouv', { emplacement: 'D' });
  pat.ajouteChamp('renouv', { nom_champ: 'renouv_1', type_champ: 'integer', est_autoincrement: 1 });
  pat.ajouteChamp('renouv', { nom_champ: 'crm_prec', type_champ: 'integer' });
  pat.ajouteChamp('renouv', { nom_champ: 'responsable', type_champ: 'integer' });
  pat.ajouteChamp('renouv', { nom_champ: 'crm', type_champ: 'integer' });
  pat.definitCle('renouv', ['renouv_1']);

  new TableParamEditor(params).definit('tax', 'AUTO', 18);
  new TableParamEditor(params).definit('tax', 'MRH', 9);

  const frm = new FormuleEditor(params);
  frm.definitFormule('prime_nette', 'rn(0.01, $base * $prorata * ($bonus / 1000))');
  frm.definitFormule('bonus_malus', 'SI($responsable > 0 ? rn(10, $crm_prec * 1.25) : rn(10, $crm_prec * 0.95))');

  const scr = new EcranEditor(params, 'scr');
  scr.creerEcran('aax_adr', { table_liee: 'adr', template: 'Nom $adr_12<br/>Email $adr_email' });
  scr.placeWidget('aax_adr', 'adr_12', { type_widget: 'text', type_champ: 'string', libelle: 'Nom', est_notnull: 1 });
  scr.placeWidget('aax_adr', 'adr_email', { type_widget: 'email', type_champ: 'string', libelle: 'Email' });

  scr.creerEcran('aax_qit', {
    table_liee: 'qit',
    template: 'Base prime $base<br/>Prorata $prorata<br/>Bonus (‰) $bonus<br/>Code taxe $taux_code<br/>Taux commission $com_taux<br/><hr/>Prime nette $pnet<br/>Taxe $taxe<br/>TTC $ttc<br/>Commission $commission',
  });
  scr.placeWidget('aax_qit', 'base', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Base prime' });
  scr.placeWidget('aax_qit', 'prorata', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Prorata (0..1)' });
  scr.placeWidget('aax_qit', 'bonus', { type_widget: 'integer', type_champ: 'integer', libelle: 'Bonus (millièmes)' });
  scr.placeWidget('aax_qit', 'taux_code', { type_widget: 'text', type_champ: 'clop', libelle: 'Code taxe (AUTO/MRH)' });
  scr.placeWidget('aax_qit', 'com_taux', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taux commission %' });
  scr.placeWidget('aax_qit', 'pnet', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Prime nette', formule_calcul: '[prime_nette]', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'taxe', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Taxe', formule_calcul: 'rn(0.01, $pnet * table("tax", $taux_code) / 100)', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'ttc', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'TTC', formule_calcul: '$pnet + $taxe', calcul_systematique: '1', est_lecture_seule: 1 });
  scr.placeWidget('aax_qit', 'commission', { type_widget: 'decimal', type_champ: 'decimal', libelle: 'Commission', formule_calcul: 'rn(0.01, $pnet * $com_taux / 100)', calcul_systematique: '1', est_lecture_seule: 1 });

  scr.creerEcran('aax_renouv', { table_liee: 'renouv', template: 'CRM précédent $crm_prec<br/>Sinistre responsable (0/1) $responsable<br/><hr/>Nouveau CRM $crm' });
  scr.placeWidget('aax_renouv', 'crm_prec', { type_widget: 'integer', type_champ: 'integer', libelle: 'CRM précédent (ex. 1000)' });
  scr.placeWidget('aax_renouv', 'responsable', { type_widget: 'integer', type_champ: 'integer', libelle: 'Sinistre responsable (0/1)' });
  scr.placeWidget('aax_renouv', 'crm', { type_widget: 'integer', type_champ: 'integer', libelle: 'Nouveau CRM', formule_calcul: '[bonus_malus]', calcul_systematique: '1', est_lecture_seule: 1 });

  new DroitEditor(data).definitDroit('qit', 'commission', 5, 'P');

  const r4 = new R4({ data, paramR4: params });

  // quelques données d'exemple (via le runtime générique, aucun code métier)
  const seed = new Runtime(r4, { user: { login: 'admin', superAdmin: true, niveau: 0 } });
  seed.sauvegarde('aax_adr', [], { adr_12: 'Dupont', adr_email: 'dupont@exemple.fr' });
  seed.sauvegarde('aax_adr', [], { adr_12: 'Martin', adr_email: 'martin@exemple.fr' });
  seed.sauvegarde('aax_qit', [], { base: '1000', prorata: '0.5', bonus: '950', taux_code: 'AUTO', com_taux: '10' });

  return { r4, params };
}

const { r4, params } = construitAssurance();

const userStore = new MemoryUserStore();
userStore.creer('admin', 'admin', { super_admin: 'O', niveau: 0 });
userStore.creer('agent', 'agent', { super_admin: 'N', niveau: 5 }); // voit tout sauf la commission

const menuEntries: MenuEntry[] = [
  { menu_position: 'a000', menu_libelle: 'Assurance' },
  { menu_position: 'a100', menu_libelle: 'Nouveau tiers', menu_script: '/aax_adr?o=8&b=' },
  { menu_position: 'a110', menu_libelle: 'Tiers Dupont', menu_script: '/aax_adr?o=1&b=1' },
  { menu_position: 'a200', menu_libelle: 'Nouvelle quittance', menu_script: '/aax_qit?o=8&b=' },
  { menu_position: 'a210', menu_libelle: 'Quittance n°1', menu_script: '/aax_qit?o=1&b=1' },
  { menu_position: 'a300', menu_libelle: 'Renouvellement (bonus-malus)', menu_script: '/aax_renouv?o=8&b=' },
  { menu_position: 'z900', menu_libelle: 'Designer (low-code)', menu_script: '/designer' },
];

const app = new MaidesApp(r4, { titre: 'Assurance — Maxima', userStore, menuEntries, designerStore: params });

const port = Number(process.env.PORT ?? 3000);
const spaDir = fileURLToPath(new URL('../../web/dist', import.meta.url));
const publicDir = fileURLToPath(new URL('./public', import.meta.url));
demarrer(app, port, { publicDir, ...(existsSync(spaDir) ? { spaDir } : {}) });

const ln = (s: string) => process.stdout.write(s + '\n');
ln('');
ln('  ============================================================');
ln('   ASSURANCE LOW-CODE — prête à tester');
ln(`   Ouvre :  http://localhost:${port}/        (login: admin / admin)`);
ln('   Essaie :  Menu > Nouvelle quittance > saisis Base=1000, Prorata=0.5,');
ln('             Bonus=950, Code taxe=AUTO, Taux commission=10 > Enregistrer');
ln('             => Prime nette/Taxe/TTC/Commission se calculent tout seuls.');
ln('   Agent (admin caché) :  login agent / agent  => la Commission est masquée.');
ln('   Designer low-code :  Menu > Designer (tables, écrans, formules, droits).');
ln('  ============================================================');

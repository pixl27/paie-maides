import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Runtime, FormuleEditor, TableParamEditor } from '@maides/core';
import { construitPaie } from '../src/paie.js';

const ADMIN = { login: 'admin', superAdmin: true, niveau: 0 };

describe('paie low-code — calcul 100% en formules maides, paramétré par le catalogue', () => {
  it('calcule brut, cotisations, net à payer / imposable et coût employeur (barème 2024)', () => {
    const { r4 } = construitPaie();
    const rt = new Runtime(r4, { user: ADMIN });
    const z = rt.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202406', salaire_base: '3000', heures_sup: '0', taux_hs: '0', primes: '0' }).zzz;
    const v = z.valeurs;
    expect(v.brut).toBe(3000);
    expect(v.plafond).toBe(3000);
    expect(v.base_csg).toBe(2947.5);
    expect(v.total_cot_sal).toBe(625.21);   // agrégé depuis le catalogue par les formules
    expect(v.net_a_payer).toBe(2374.79);
    expect(v.net_imposable).toBe(2460.27);
    expect(v.total_cot_pat).toBe(984.9);
    expect(v.cout_employeur).toBe(3984.9);
  });

  it('PARAMÉTRABLE (cotisations) : ajouter une rubrique au catalogue change le bulletin', () => {
    const { r4 } = construitPaie();
    const rt = new Runtime(r4, { user: ADMIN });
    expect(rt.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202406', salaire_base: '3000' }).zzz.valeurs.total_cot_sal).toBe(625.21);
    // on AJOUTE une cotisation (1 % salarial sur le brut) — pure donnée, aucune ligne de code
    rt.sauvegarde('paie_rub', [], { rub_code: 'MUT_SAL', libelle: 'Mutuelle', base_type: 'brut', tx_sal: '1', tx_pat: '0', non_deductible: '0', ordre: '150' });
    const apres = rt.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202407', salaire_base: '3000' }).zzz.valeurs;
    expect(apres.total_cot_sal).toBe(655.21);  // 625,21 + 3000 × 1 %
    expect(apres.net_a_payer).toBe(2344.79);
  });

  it('PARAMÉTRABLE (paramètre) : changer le PMSS change le plafond', () => {
    const { r4, params } = construitPaie();
    new TableParamEditor(params).definit('tx', 'PMSS', 2000); // édition du paramètre
    const rt = new Runtime(r4, { user: ADMIN });
    const z = rt.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202408', salaire_base: '3000' }).zzz;
    expect(z.valeurs.plafond).toBe(2000); // PMSS abaissé pris en compte par la formule
  });

  it('PARAMÉTRABLE (gains par formule) : éditer la formule [brut] change le brut', () => {
    const { r4, params } = construitPaie();
    // on redéfinit la formule nommée des gains pour ajouter une prime d'ancienneté de 5%
    new FormuleEditor(params).definitFormule('brut', '$salaire_base * 1.05 + $heures_sup * $taux_hs + $primes');
    const rt = new Runtime(r4, { user: ADMIN });
    const z = rt.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202409', salaire_base: '3000' }).zzz;
    expect(z.valeurs.brut).toBe(3150); // 3000 × 1,05
  });

  it('plafonne les cotisations plafonnées au PMSS', () => {
    const { r4 } = construitPaie();
    const rt = new Runtime(r4, { user: ADMIN });
    const z = rt.sauvegarde('paie_bul', [], { sal_id: '2', periode: '202406', salaire_base: '5000' }).zzz;
    expect(z.valeurs.brut).toBe(5000);
    expect(z.valeurs.plafond).toBe(3864);          // écrêté au PMSS
    expect(z.valeurs.total_cot_sal).toBe(918.07);  // cotisations plafonnées sur 3864
    expect(z.valeurs.net_a_payer).toBe(4081.93);
  });

  it('intègre les heures supplémentaires et les primes dans le brut', () => {
    const { r4 } = construitPaie();
    const rt = new Runtime(r4, { user: ADMIN });
    const z = rt.sauvegarde('paie_bul', [], { sal_id: '1', periode: '202407', salaire_base: '3000', heures_sup: '10', taux_hs: '20', primes: '150' }).zzz;
    expect(z.valeurs.brut).toBe(3350); // 3000 + 10×20 + 150
  });

  it('le coût employeur est masqué pour un gestionnaire (droit P niveau 5)', () => {
    const { r4 } = construitPaie();
    const gest = new Runtime(r4, { user: { login: 'g', superAdmin: false, niveau: 5 } });
    expect(gest.visu('paie_bul', ['1']).droits?.cout_employeur?.masque).toBe(true);
    expect(new Runtime(r4, { user: ADMIN }).visu('paie_bul', ['1']).droits?.cout_employeur?.masque).toBeFalsy();
  });

  it('PERSISTANCE disque : données et rubriques survivent au redémarrage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'paie-'));
    try {
      // 1er lancement : construit + seed + ajoute une rubrique, le tout persisté
      const a = construitPaie(dir);
      new Runtime(a.r4, { user: ADMIN }).sauvegarde('paie_rub', [], { rub_code: 'TEST1', libelle: 'Test', base_type: 'brut', tx_sal: '1', tx_pat: '0', non_deductible: '0', ordre: '500' });
      // « redémarrage » : on reconstruit depuis le MÊME dossier (recharge le disque)
      const rt = new Runtime(construitPaie(dir).r4, { user: ADMIN });
      expect(rt.chercheCles('rub')).toContain('TEST1');               // rubrique ajoutée -> persistée
      expect(rt.rechercheComplete('sal', 'Dupont').length).toBe(1);   // données d'origine rechargées
      expect(rt.chercheCles('emp').length).toBe(1);                   // pas de re-seed au redémarrage
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('le référentiel (employeur, salariés, rubriques) est en place', () => {
    const { r4 } = construitPaie();
    const rt = new Runtime(r4, { user: ADMIN });
    expect(rt.rechercheComplete('sal', 'Dupont').length).toBeGreaterThan(0);
    expect(rt.rechercheComplete('emp', 'ACME').length).toBeGreaterThan(0);
    expect(rt.chercheCles('rub').length).toBe(15); // 6 cotisations salariales + 9 patronales
  });
});

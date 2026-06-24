import { describe, it, expect, beforeEach } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import type { Ecran } from '../src/runtime/index.js';

/*
 * Démonstration : une application « facture » entièrement définie par DONNÉES.
 * - un patron (table) `facture`
 * - un écran `factureSaisie` avec un champ calculé (total = qte * pu) et une
 *   validation (qte obligatoire et > 0).
 * Le runtime exécute cet écran en CRUD, sans code spécifique.
 */

// Patron de la table de données
const patFacture = creerPatron('facture', [
  { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'client', type_champ: 'string', val_def: '' },
  { nom_champ: 'qte', type_champ: 'integer', val_def: '0' },
  { nom_champ: 'pu', type_champ: 'decimal', val_def: '0' },
  { nom_champ: 'total', type_champ: 'decimal', val_def: '0' },
], { emplacement: 'D' });

// Patron système des écrans
const patScr = creerPatron('scr', [
  { nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 },
], { emplacement: 'P' });

// Définition de l'écran (document de patron 'scr')
const ecranFacture: Ecran & { nom_ecran: string } = {
  nom_ecran: 'factureSaisie',
  table_liee: 'facture',
  template: '$num $client $qte $pu $total',
  champs: {
    num: { type_widget: 'integer', type_champ: 'integer' },
    client: { type_widget: 'text', type_champ: 'string', est_notnull: 1 },
    qte: { type_widget: 'integer', type_champ: 'integer', val_min: '1', est_notnull: 1 },
    pu: { type_widget: 'decimal', type_champ: 'decimal' },
    total: {
      type_widget: 'decimal', type_champ: 'decimal',
      formule_calcul: '$qte * $pu', calcul_systematique: '1', est_lecture_seule: 1,
    },
  },
};

function buildRuntime() {
  const data = new MemoryLayerStore().definePatron(patFacture);
  const params = new MemoryLayerStore().definePatron(patScr).definePatron(patFacture);
  params.putWithKey('scr', ['factureSaisie'], ecranFacture);
  const r4 = new R4({ data, paramR4: params });
  return { r4, runtime: new Runtime(r4, { user: { login: 'tester', superAdmin: true, niveau: 0 } }) };
}

describe('runtime générique — application définie par données', () => {
  let runtime: Runtime;
  beforeEach(() => { runtime = buildRuntime().runtime; });

  it('o8 — édition d’un nouveau document : valeurs par défaut + nouveauDoc', () => {
    const zzz = runtime.edition('factureSaisie', ['1']);
    expect(zzz.nouveauDoc).toBe(true);
    expect(zzz.ficMaitre).toBe('facture');
    expect(zzz.valeurs.total).toBe(0); // formule sur défauts : 0 * 0
  });

  it('o9 — sauvegarde : la formule calcule le total, puis relecture', () => {
    const { zzz, validation } = runtime.sauvegarde('factureSaisie', ['1'], {
      client: 'ACME', qte: 3, pu: 100,
    });
    expect(validation.erreurBloquante).toBe(false);
    expect(zzz.valeurs.total).toBe(300); // 3 * 100, recalcul systématique
    // relecture indépendante
    const relu = runtime.visu('factureSaisie', ['1']);
    expect(relu.nouveauDoc).toBe(false);
    expect(relu.valeurs.client).toBe('ACME');
    expect(relu.valeurs.total).toBe(300);
  });

  it('o9 — validation bloquante : qte obligatoire/min et client obligatoire', () => {
    const { zzz, validation } = runtime.sauvegarde('factureSaisie', ['2'], {
      client: '', qte: 0, pu: 50,
    });
    expect(validation.erreurBloquante).toBe(true);
    expect(validation.erreurs.client).toContain('Obligatoire');
    expect(validation.erreurs.qte).toContain('Ne peux pas être < 1');
    // rien n'a été sauvegardé
    expect(runtime.visu('factureSaisie', ['2']).nouveauDoc).toBe(true);
    expect(zzz.erreurBloquante).toBe(true);
  });

  it('o4 — suppression', () => {
    runtime.sauvegarde('factureSaisie', ['3'], { client: 'X', qte: 1, pu: 10 });
    expect(runtime.visu('factureSaisie', ['3']).nouveauDoc).toBe(false);
    runtime.supprime('factureSaisie', ['3']);
    expect(runtime.visu('factureSaisie', ['3']).nouveauDoc).toBe(true);
  });

  it('o12 — visu si existe, édition sinon', () => {
    runtime.sauvegarde('factureSaisie', ['4'], { client: 'Y', qte: 2, pu: 20 });
    expect(runtime.visuOuEdition('factureSaisie', ['4']).o).toBe(1); // existe -> visu
    expect(runtime.visuOuEdition('factureSaisie', ['99']).o).toBe(8); // absent -> édition
  });

  it('o5 — duplication vers une nouvelle clé', () => {
    runtime.sauvegarde('factureSaisie', ['5'], { client: 'Dup', qte: 4, pu: 25 });
    const { zzz } = runtime.duplique('factureSaisie', ['5'], ['6'], { num: 6 });
    expect(zzz.valeurs.client).toBe('Dup');
    expect(zzz.valeurs.total).toBe(100); // 4 * 25 recalculé
    expect(runtime.visu('factureSaisie', ['6']).nouveauDoc).toBe(false);
  });
});

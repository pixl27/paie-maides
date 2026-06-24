import { describe, it, expect, beforeEach } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime, SpecifiqueRegistry } from '../src/runtime/index.js';
import { creerPatron, type Ecran } from '../src/index.js';

/*
 * Trappe « code spécifique » : logique métier sur-mesure (TypeScript) qu'on ne
 * peut pas exprimer en simple formule — ici un barème de tarif par paliers, un
 * blocage conditionnel de la sauvegarde, et un ordre personnalisé.
 */

const patDevis = creerPatron('devis', [
  { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'age', type_champ: 'integer', val_def: '0' },
  { nom_champ: 'base', type_champ: 'decimal', val_def: '0' },
  { nom_champ: 'permis', type_champ: 'string', val_def: '' },
  { nom_champ: 'zone', type_champ: 'string', val_def: '' },
  { nom_champ: 'prime', type_champ: 'decimal', val_def: '0' },
], { emplacement: 'D' });

function buildRuntime() {
  const data = new MemoryLayerStore().definePatron(patDevis);
  const params = new MemoryLayerStore()
    .definePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }]))
    .definePatron(patDevis);
  const ecran: Ecran & { nom_ecran: string } = {
    nom_ecran: 'devisAuto', table_liee: 'devis', template: '$num $age $base $permis $prime',
    champs: {
      num: { type_widget: 'integer' }, age: { type_widget: 'integer' },
      base: { type_widget: 'decimal' }, permis: { type_widget: 'text' },
      zone: { type_widget: 'text' }, prime: { type_widget: 'decimal', est_lecture_seule: 1 },
    },
  };
  params.putWithKey('scr', ['devisAuto'], ecran);

  const reg = new SpecifiqueRegistry();
  reg.enregistrer('devisAuto', {
    demarre: (ctx) => { if (ctx.zzz.nouveauDoc && !ctx.valeurs.zone) ctx.zzz.valeurs.zone = 'A'; },
    avantSauvegarde: (ctx) => {
      // barème par paliers — logique impossible à écrire en simple formule
      const age = Number(ctx.valeurs.age);
      const base = Number(ctx.valeurs.base) || 0;
      const coef = age < 25 ? 1.5 : age < 60 ? 1.0 : 1.2;
      ctx.zzz.valeurs.prime = Math.round(base * coef);
      if (ctx.valeurs.permis !== 'oui') ctx.erreur('Permis requis pour établir ce devis.');
    },
    apresSauvegarde: (ctx) => ctx.message('succes', `Devis ${ctx.zzz.cle.join('.')} tarifé à ${ctx.valeurs.prime}.`),
    ordres: {
      recalculer: (ctx) => { ctx.zzz.valeurs.prime = Number(ctx.valeurs.base) * 2; },
    },
  });

  const r4 = new R4({ data, paramR4: params });
  return new Runtime(r4, { specifiques: reg, user: { login: 't', superAdmin: true, niveau: 0 } });
}

describe('runtime — code spécifique (logique métier sur-mesure)', () => {
  let rt: Runtime;
  beforeEach(() => { rt = buildRuntime(); });

  it('hook demarre : valeur par défaut posée par du code', () => {
    expect(rt.edition('devisAuto', ['1']).valeurs.zone).toBe('A');
  });

  it('hook avantSauvegarde : tarif calculé par un barème (jeune conducteur)', () => {
    const { zzz, validation } = rt.sauvegarde('devisAuto', ['1'], { age: 20, base: 100, permis: 'oui' });
    expect(validation.erreurBloquante).toBe(false);
    expect(zzz.valeurs.prime).toBe(150); // coef 1.5 pour < 25 ans
    expect(rt.visu('devisAuto', ['1']).valeurs.prime).toBe(150); // persisté
  });

  it('barème : conducteur senior', () => {
    const { zzz } = rt.sauvegarde('devisAuto', ['2'], { age: 65, base: 100, permis: 'oui' });
    expect(zzz.valeurs.prime).toBe(120); // coef 1.2 pour >= 60
  });

  it('hook avantSauvegarde : blocage conditionnel (permis manquant)', () => {
    const { zzz, validation } = rt.sauvegarde('devisAuto', ['3'], { age: 30, base: 100, permis: 'non' });
    expect(validation.erreurBloquante).toBe(true);
    expect(zzz.messages.some((m) => m.text.includes('Permis requis'))).toBe(true);
    expect(rt.visu('devisAuto', ['3']).nouveauDoc).toBe(true); // rien sauvegardé
  });

  it('hook apresSauvegarde : message émis après succès', () => {
    const { zzz } = rt.sauvegarde('devisAuto', ['4'], { age: 40, base: 200, permis: 'oui' });
    expect(zzz.messages.some((m) => m.type === 'succes' && m.text.includes('tarifé'))).toBe(true);
  });

  it('ordre personnalisé (équiv. o41–o90)', () => {
    const zzz = rt.executeOrdrePersonnalise('devisAuto', ['5'], 'recalculer', { base: 50 });
    expect(zzz.valeurs.prime).toBe(100);
  });
});

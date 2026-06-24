/**
 * Tests du contrôle d'accès par champ (appliqueDroits : C/N/L/P) au rendu,
 * à la sérialisation et au postage, + correction du défaut de niveau.
 */
import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { renderEcran } from '../src/rendering/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import { toUserInfo } from '../src/auth/auth.js';
import type { Ecran } from '../src/runtime/index.js';
import type { UserInfo } from '../src/expression/env.js';

const patT = creerPatron('t', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'publique', type_champ: 'string' },
  { nom_champ: 'secret', type_champ: 'string' },
  { nom_champ: 'lecture', type_champ: 'string' },
  { nom_champ: 'creation', type_champ: 'string' },
], { emplacement: 'D' });
const patScr = creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const ecran: Ecran & { nom_ecran: string } = {
  nom_ecran: 't_saisie', table_liee: 't',
  template: '$id $publique $secret $lecture $creation',
  champs: {
    id: { type_widget: 'integer', type_champ: 'integer' },
    publique: { type_widget: 'text', type_champ: 'string' },
    secret: { type_widget: 'text', type_champ: 'string' },
    lecture: { type_widget: 'text', type_champ: 'string' },
    creation: { type_widget: 'text', type_champ: 'string' },
  },
};

function build(user: UserInfo) {
  const data = new MemoryLayerStore().definePatron(patT);
  const params = new MemoryLayerStore().definePatron(patScr);
  params.putWithKey('scr', ['t_saisie'], ecran);
  // droits pour le niveau 5 : secret=P (masqué), lecture=L (lecture seule), creation=N (modif à la création)
  data.putWithKey('drt', ['t', 'secret'], { drt_table: 't', drt_champ: 'secret', drt_grp_5: 'P' });
  data.putWithKey('drt', ['t', 'lecture'], { drt_table: 't', drt_champ: 'lecture', drt_grp_5: 'L' });
  data.putWithKey('drt', ['t', 'creation'], { drt_table: 't', drt_champ: 'creation', drt_grp_5: 'N' });
  const r4 = new R4({ data, paramR4: params });
  return { r4, data, runtime: new Runtime(r4, { user }) };
}

const NIV5: UserInfo = { login: 'agent', superAdmin: false, niveau: 5 };
const ADMIN: UserInfo = { login: 'admin', superAdmin: true, niveau: 0 };

describe('appliqueDroits — résolution C/N/L/P', () => {
  it('calcule zzz.droits pour un utilisateur non super-admin', () => {
    const zzz = build(NIV5).runtime.edition('t_saisie', ['1']); // nouveau doc
    expect(zzz.droits!['secret']).toEqual({ ro: true, masque: true, droit: 'P' });
    expect(zzz.droits!['lecture']).toEqual({ ro: true, masque: false, droit: 'L' });
    // 'N' sur un nouveau doc => modifiable (pas d'entrée restrictive)
    expect(zzz.droits!['creation']).toBeUndefined();
    expect(zzz.droits!['publique']).toBeUndefined();
  });
  it('N devient lecture seule sur un document existant', () => {
    const app = build(NIV5);
    const admin = new Runtime(app.r4, { user: ADMIN }); // crée le doc en admin
    admin.sauvegarde('t_saisie', ['1'], { publique: 'p', secret: 's', lecture: 'l', creation: 'c' });
    const zzz = app.runtime.visu('t_saisie', ['1']); // relecture en niveau 5
    expect(zzz.droits!['creation']).toEqual({ ro: true, masque: false, droit: 'N' });
  });
  it('super-admin : aucune restriction', () => {
    const zzz = build(ADMIN).runtime.edition('t_saisie', ['1']);
    expect(zzz.droits).toEqual({});
  });
});

describe('rendu HTML respecte les droits', () => {
  it('champ P masqué, champ L en lecture seule', () => {
    const zzz = build(NIV5).runtime.edition('t_saisie', ['1']);
    const html = renderEcran(zzz);
    expect(html).not.toContain('name="secret"'); // P : non rendu
    expect(html).toContain('name="publique"'); // C : éditable
    expect(html).toMatch(/name="lecture"[^>]*readonly/); // L : lecture seule
  });
});

describe('sérialisation JSON respecte les droits', () => {
  it('exclut le champ P, marque le champ L ro', () => {
    const zzz = build(NIV5).runtime.edition('t_saisie', ['1']);
    const json = build(NIV5).runtime.serialiseJson(zzz);
    expect(json.tuple['secret']).toBeUndefined();
    expect(json.tuple['lecture']!.ro).toBe(true);
    expect(json.tuple['publique']!.ro).toBe(false);
  });
});

describe('postage refuse les champs non autorisés', () => {
  it('un champ P ou L n’est pas écrit même si soumis', () => {
    const app = build(NIV5);
    const { zzz } = app.runtime.sauvegarde('t_saisie', ['1'], { publique: 'ok', secret: 'pirate', lecture: 'pirate' });
    expect(zzz.valeurs.publique).toBe('ok');
    expect(zzz.valeurs.secret).not.toBe('pirate');
    expect(zzz.valeurs.lecture).not.toBe('pirate');
  });
});

describe('défaut de niveau (sécurité)', () => {
  it('un compte sans niveau est le MOINS privilégié (9), pas 0', () => {
    expect(toUserInfo({ login: 'x', password: '' }).niveau).toBe(9);
    expect(toUserInfo({ login: 'y', password: '', niveau: 2 }).niveau).toBe(2);
  });
});

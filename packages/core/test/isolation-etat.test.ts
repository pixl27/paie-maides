/**
 * Test d'isolation d'état (défaut de certification) : les erreurs de validation
 * (messerr) ne doivent PAS fuiter sur la définition de widget partagée entre
 * requêtes/utilisateurs — creeZzz copie les widgets par requête.
 */
import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron } from '../src/metamodel/index.js';
import type { Ecran } from '../src/runtime/index.js';

const patF = creerPatron('f', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'client', type_champ: 'string' },
], { emplacement: 'D' });
const patScr = creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }], { emplacement: 'P' });
const ecran: Ecran & { nom_ecran: string } = {
  nom_ecran: 'f_s', table_liee: 'f', template: '$client',
  champs: { id: { type_widget: 'integer' }, client: { type_widget: 'text', type_champ: 'string', est_notnull: 1 } },
};

function build() {
  const data = new MemoryLayerStore().definePatron(patF);
  const params = new MemoryLayerStore().definePatron(patScr);
  params.putWithKey('scr', ['f_s'], ecran);
  const r4 = new R4({ data, paramR4: params });
  return { r4, runtime: new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } }) };
}

describe('isolation des erreurs de validation', () => {
  it('une erreur de validation ne fuite pas vers une requête ultérieure', () => {
    const { runtime } = build();
    // requête 1 : sauvegarde invalide (client obligatoire vide) -> erreur sur le widget
    const r1 = runtime.sauvegarde('f_s', ['1'], { client: '' });
    expect(r1.zzz.erreurBloquante).toBe(true);
    expect(r1.zzz.champs.client!.messerr).toEqual(['Obligatoire']);

    // requête 2 : visu d'un autre document -> AUCUNE erreur héritée
    const z2 = runtime.visu('f_s', ['2']);
    expect(z2.champs.client!.messerr ?? []).toEqual([]);
    // ce sont bien des instances de widget distinctes (pas la définition partagée)
    expect(z2.champs.client).not.toBe(r1.zzz.champs.client);
  });

  it('la définition d’écran d’origine n’est jamais mutée', () => {
    const { runtime } = build();
    runtime.sauvegarde('f_s', ['1'], { client: '' });
    // le widget de l'écran stocké reste vierge de messerr
    expect(ecran.champs.client!.messerr).toBeUndefined();
  });
});

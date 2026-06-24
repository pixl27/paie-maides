import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime, renderListe } from '../src/index.js';
import { creerPatron, type Ecran } from '../src/index.js';

/*
 * Capacité « applications réelles » : relations entre tables.
 * contrat (maître) --enfants--> garantie ; contrat --parent--> client.
 */

const patClient = creerPatron('client', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'nom', type_champ: 'string' },
], { emplacement: 'D' });

const patGarantie = creerPatron('garantie', [
  { nom_champ: 'id', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'num_contrat', type_champ: 'integer' },
  { nom_champ: 'libelle', type_champ: 'string' },
  { nom_champ: 'montant', type_champ: 'decimal' },
], { emplacement: 'D' });

const patContrat = creerPatron('contrat', [
  { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'num_client', type_champ: 'integer' },
  { nom_champ: 'prime', type_champ: 'decimal' },
  { nom_champ: 'client_nom', type_champ: 'string' },
], {
  emplacement: 'D',
  relations: [
    { nom: 'leClient', type: 'parent', table: 'client', cle_locale: ['num_client'], cle_distante: ['id'] },
    { nom: 'garanties', type: 'enfants', table: 'garantie', cle_locale: ['num'], cle_distante: ['num_contrat'] },
  ],
});

const patScr = creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }]);

function build() {
  const data = new MemoryLayerStore().definePatron(patClient).definePatron(patGarantie).definePatron(patContrat);
  data.put('client', { id: 10, nom: 'Durand' });
  data.put('contrat', { num: 1, num_client: 10, prime: 500, client_nom: '' });
  data.put('garantie', { id: 1, num_contrat: 1, libelle: 'Incendie', montant: 200 });
  data.put('garantie', { id: 2, num_contrat: 1, libelle: 'Vol', montant: 300 });
  data.put('garantie', { id: 3, num_contrat: 2, libelle: 'Autre', montant: 99 });

  const ecran: Ecran & { nom_ecran: string } = {
    nom_ecran: 'contratFiche', table_liee: 'contrat', template: '$num $prime $client_nom',
    champs: {
      num: { type_widget: 'integer' },
      prime: { type_widget: 'decimal' },
      // formule qui lit un champ de l'enregistrement parent chargé par la relation
      client_nom: { type_widget: 'text', formule_calcul: '$leClient["nom"]', calcul_systematique: '1' },
    },
  };
  const params = new MemoryLayerStore().definePatron(patScr).definePatron(patContrat)
    .definePatron(patClient).definePatron(patGarantie);
  params.putWithKey('scr', ['contratFiche'], ecran);

  const r4 = new R4({ data, paramR4: params });
  return { r4, runtime: new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } }) };
}

describe('runtime — relations entre tables', () => {
  it('charge les enfants (un-à-plusieurs) filtrés par la clé', () => {
    const { runtime } = build();
    const zzz = runtime.visu('contratFiche', ['1']);
    expect(Array.isArray(zzz.valeurs.garanties)).toBe(true);
    expect(zzz.valeurs.garanties).toHaveLength(2); // pas la garantie du contrat 2
    expect(zzz.valeurs.garanties.map((g: any) => g.libelle).sort()).toEqual(['Incendie', 'Vol']);
  });

  it('charge le parent (plusieurs-à-un)', () => {
    const { runtime } = build();
    const zzz = runtime.visu('contratFiche', ['1']);
    expect(zzz.valeurs.leClient.nom).toBe('Durand');
  });

  it('une formule peut lire un champ du parent via la relation', () => {
    const { runtime } = build();
    const zzz = runtime.visu('contratFiche', ['1']);
    expect(zzz.valeurs.client_nom).toBe('Durand');
  });
});

describe('runtime — listes / vues', () => {
  it('liste filtrée + rendu en tableau HTML avec liens', () => {
    const { runtime } = build();
    const rows = runtime.liste('garantie', { filtre: 'num_contrat=1' });
    expect(rows).toHaveLength(2);
    const html = renderListe(rows, [
      { champ: 'libelle', libelle: 'Garantie' },
      { champ: 'montant', libelle: 'Montant' },
    ], { lienEcran: 'garantieFiche', cleChamps: ['id'] });
    expect(html).toContain('<table class="md-liste">');
    expect(html).toContain('<th>Garantie</th>');
    expect(html).toContain('Incendie');
    expect(html).toContain('e=garantieFiche&amp;o=1&amp;b=1'); // lien (attribut HTML échappé)
  });
});

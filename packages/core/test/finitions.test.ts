import { describe, it, expect } from 'vitest';
import { R4, MemoryLayerStore } from '../src/r4/index.js';
import { Runtime } from '../src/runtime/index.js';
import { creerPatron, type Ecran } from '../src/index.js';
import { renderWidget } from '../src/rendering/index.js';
import { MemoryGed, GedService, type Scanner } from '../src/ged/index.js';
import { TenantRegistry } from '../src/tenant/index.js';

const patFacture = creerPatron('facture', [
  { nom_champ: 'num', type_champ: 'integer', est_cle: 1, ordre_cle: 1 },
  { nom_champ: 'client', type_champ: 'string' },
], { emplacement: 'D' });

function buildRuntime() {
  const data = new MemoryLayerStore().definePatron(patFacture);
  data.put('facture', { num: 1, client: 'A' });
  data.put('facture', { num: 2, client: 'B' });
  data.put('facture', { num: 3, client: 'C' });
  const params = new MemoryLayerStore()
    .definePatron(creerPatron('scr', [{ nom_champ: 'nom_ecran', type_champ: 'string', est_cle: 1, ordre_cle: 1 }]))
    .definePatron(patFacture);
  const ecran: Ecran & { nom_ecran: string } = {
    nom_ecran: 'fact', table_liee: 'facture', template: '$num $client',
    champs: { num: { type_widget: 'integer' }, client: { type_widget: 'text' } },
  };
  params.putWithKey('scr', ['fact'], ecran);
  const r4 = new R4({ data, paramR4: params });
  return new Runtime(r4, { user: { login: 't', superAdmin: true, niveau: 0 } });
}

describe('finitions — navigation (o2/o3, séquences)', () => {
  const rt = buildRuntime();
  it('clé suivante / précédente', () => {
    expect(rt.cleSuivante('facture', ['1'])).toEqual(['2']);
    expect(rt.clePrecedente('facture', ['2'])).toEqual(['1']);
    expect(rt.cleSuivante('facture', ['3'])).toBeNull();
    expect(rt.clePrecedente('facture', ['1'])).toBeNull();
  });
  it('document suivant via écran', () => {
    const zzz = rt.documentSuivant('fact', ['1']);
    expect(zzz.valeurs.client).toBe('B');
  });
  it('séquence d’écrans', () => {
    expect(rt.ecranSuivant(['e1', 'e2', 'e3'], 'e2')).toBe('e3');
    expect(rt.ecranPrecedent(['e1', 'e2', 'e3'], 'e1')).toBeNull();
  });
});

describe('finitions — widgets riches', () => {
  it('richtext (CKEditor) rend une zone enrichissable', () => {
    const html = renderWidget({ nomChamp: 'corps', widget: { type_widget: 'richtext' }, valeur: '<b>x</b>' });
    expect(html).toContain('class="md-richtext');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;'); // contenu échappé
  });
  it('file et image', () => {
    expect(renderWidget({ nomChamp: 'piece', widget: { type_widget: 'file' }, valeur: 'doc1' }))
      .toContain('type="file"');
    expect(renderWidget({ nomChamp: 'logo', widget: { type_widget: 'image' }, valeur: '/img/a.png' }))
      .toContain('src="/img/a.png"');
  });
});

describe('finitions — GED', () => {
  it('stocke, liste par enregistrement, récupère et supprime', () => {
    const ged = new MemoryGed();
    const id = ged.stocker({ nom: 'cni.pdf', mime: 'application/pdf', contenu: new Uint8Array([1, 2, 3]), table: 'client', cle: '10' }, 'bob');
    expect(ged.recuperer(id)?.nom).toBe('cni.pdf');
    expect(ged.lister('client', '10')).toHaveLength(1);
    expect(ged.lister('client', '99')).toHaveLength(0);
    expect(ged.supprimer(id)).toBe(true);
    expect(ged.recuperer(id)).toBeNull();
  });
  it('GedService : numérisation via scanner injecté', async () => {
    const scanner: Scanner = { acquerir: async () => ({ nom: 'scan.png', mime: 'image/png', contenu: new Uint8Array([9]) }) };
    const svc = new GedService(new MemoryGed(), scanner);
    const id = await svc.numeriser('contrat', '1', 'bob');
    expect(id).toBeTruthy();
    expect(svc.documentsDe('contrat', '1')).toHaveLength(1);
  });
});

describe('finitions — multi-tenant', () => {
  it('résout des applications isolées', () => {
    const reg = new TenantRegistry();
    reg.enregistrer({ code: 'assurance', libelle: 'Assurance' }, () => new R4({ data: new MemoryLayerStore() }));
    reg.enregistrer({ code: 'devis', libelle: 'Devis', actif: false }, () => new R4({ data: new MemoryLayerStore() }));
    const a = reg.resoudre('assurance');
    expect(a).not.toBeNull();
    expect(reg.resoudre('assurance')).toBe(a); // mis en cache
    expect(reg.resoudre('devis')).toBeNull(); // inactif
    expect(reg.info('assurance')?.libelle).toBe('Assurance');
    expect(reg.liste().map((e) => e.code)).toEqual(['assurance']); // devis inactif masqué
  });
});

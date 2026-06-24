/** Tests du scanner logiciel de référence (FichierScanner) + intégration GedService. */
import { describe, it, expect } from 'vitest';
import { MemoryGed, GedService, FichierScanner, base64VersOctets } from '../src/ged/ged.js';

describe('base64VersOctets', () => {
  it('décode un base64 nu', () => {
    // "PDF" en base64 = "UERG"
    expect([...base64VersOctets('UERG').octets]).toEqual([80, 68, 70]);
  });
  it('décode un dataURL et en extrait le mime', () => {
    const r = base64VersOctets('data:application/pdf;base64,UERG');
    expect(r.mime).toBe('application/pdf');
    expect([...r.octets]).toEqual([80, 68, 70]);
  });
});

describe('FichierScanner', () => {
  it('acquiert depuis des octets', async () => {
    const d = await new FichierScanner().acquerir({ nom: 'a.bin', mime: 'application/octet-stream', contenu: new Uint8Array([1, 2, 3]) });
    expect(d.nom).toBe('a.bin');
    expect([...d.contenu]).toEqual([1, 2, 3]);
  });
  it('acquiert depuis un dataURL (mime déduit)', async () => {
    const d = await new FichierScanner().acquerir({ nom: 'doc', contenu: 'data:application/pdf;base64,UERG' });
    expect(d.mime).toBe('application/pdf');
    expect([...d.contenu]).toEqual([80, 68, 70]);
  });
  it('rejette si contenu manquant', async () => {
    await expect(new FichierScanner().acquerir({ nom: 'x' })).rejects.toThrow(/contenu manquant/);
  });
});

describe('GedService avec FichierScanner', () => {
  it('numérise et rattache un document à un enregistrement', async () => {
    const ged = new GedService(new MemoryGed(), new FichierScanner());
    const id = await ged.numeriser('adr', '4000', 'tester', { nom: 'piece.pdf', contenu: 'data:application/pdf;base64,UERG' });
    expect(id).toBeTruthy();
    const docs = ged.documentsDe('adr', '4000');
    expect(docs).toHaveLength(1);
    expect(docs[0]!.nom).toBe('piece.pdf');
    expect(docs[0]!.mime).toBe('application/pdf');
    expect(docs[0]!.cree_par).toBe('tester');
  });
});

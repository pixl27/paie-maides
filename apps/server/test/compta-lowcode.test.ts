import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Runtime, renderEcran } from '@maides/core';
import { construitCompta } from '../src/compta/index.js';

const ADMIN = { login: 'admin', superAdmin: true, niveau: 0 };

describe('comptabilité low-code — partie double, totaux 100% en formules Maxima', () => {
  it('équilibre d’une écriture = Σ débit − Σ crédit de ses lignes (recalculé à l’affichage)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    // écriture n°1 (vente 1200 TTC) seedée : 411=1200 / 707=1000 + 445710=200
    const e1 = rt.visu('compta_ecr', ['1']).valeurs;
    expect(e1.total_debit).toBe(1200);
    expect(e1.total_credit).toBe(1200);
    expect(e1.equilibre).toBe(0); // équilibrée
    // écriture n°2 (achat 600 TTC) : 607=500 + 445660=100 / 401=600
    const e2 = rt.visu('compta_ecr', ['2']).valeurs;
    expect(e2.total_debit).toBe(600);
    expect(e2.total_credit).toBe(600);
    expect(e2.equilibre).toBe(0);
  });

  it('solde d’un compte = Σ débit − Σ crédit de ses lignes (balance)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    expect(rt.visu('compta_cpt', ['411000']).valeurs.solde).toBe(1200);  // client, débiteur
    expect(rt.visu('compta_cpt', ['707000']).valeurs.solde).toBe(-1000); // vente, créditeur
    expect(rt.visu('compta_cpt', ['445710']).valeurs.solde).toBe(-200);  // TVA collectée
    expect(rt.visu('compta_cpt', ['401000']).valeurs.solde).toBe(-600);  // fournisseur
    expect(rt.visu('compta_cpt', ['607000']).valeurs.solde).toBe(500);   // achat, débiteur
  });

  it('le grand livre est globalement équilibré (Σ débits = Σ crédits)', () => {
    const { r4 } = construitCompta();
    expect(r4.aggregate('somme', 'lig', 'debit', '')).toBe(r4.aggregate('somme', 'lig', 'credit', ''));
    expect(r4.aggregate('somme', 'lig', 'debit', '')).toBe(1800); // 1200 + 600
  });

  it('compte de résultat : produits (classe 7) − charges (classe 6)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const r = rt.visu('compta_resultat', ['1']).valeurs;
    expect(r.produits).toBe(1000);
    expect(r.charges).toBe(500);
    expect(r.resultat).toBe(500);
  });

  it('PARAMÉTRABLE : ajouter une écriture équilibrée met à jour balance et résultat', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    // nouvelle vente : 411 = 240 / 707 = 200 + 445710 = 40 (écriture n°3)
    rt.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-26', jal_code: 'VE', piece: 'VENTE-002', libelle: 'Vente 2' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '411000', debit: '240', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '707000', debit: '0', credit: '200' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '445710', debit: '0', credit: '40' });
    expect(rt.visu('compta_ecr', ['3']).valeurs.equilibre).toBe(0);
    expect(rt.visu('compta_cpt', ['411000']).valeurs.solde).toBe(1440); // 1200 + 240
    expect(rt.visu('compta_resultat', ['1']).valeurs.resultat).toBe(700); // (1000+200) − 500
  });

  it('détecte une écriture DÉSÉQUILIBRÉE (équilibre ≠ 0)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    rt.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-26', jal_code: 'OD', piece: 'OD-001', libelle: 'Erreur' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '512000', debit: '100', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '707000', debit: '0', credit: '90' });
    expect(rt.visu('compta_ecr', ['3']).valeurs.equilibre).toBe(10); // 100 − 90, NON équilibrée
  });

  it('résultat JUSTE pour un sous-compte à plus de 6 chiffres (filtre par classe, pas par plage)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    // sous-compte d’achats 6071000 (7 chiffres, classe 6) — équilibré par une vente
    rt.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-26', jal_code: 'OD', piece: 'OD-1', libelle: 'Sous-compte' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '6071000', debit: '1000', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '707000', debit: '0', credit: '1000' });
    const r = rt.visu('compta_resultat', ['1']).valeurs;
    expect(r.charges).toBe(1500);  // 500 + 1000 (le sous-compte EST bien compté)
    expect(r.produits).toBe(2000); // 1000 + 1000
  });

  it('résultat NET : un avoir (compte de charge crédité) réduit les charges', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    // avoir fournisseur : 607000 CRÉDITÉ de 200 (contre-passation), 401000 débité 200
    rt.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-26', jal_code: 'AC', piece: 'AV-1', libelle: 'Avoir' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '401000', debit: '200', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '607000', debit: '0', credit: '200' });
    const r = rt.visu('compta_resultat', ['1']).valeurs;
    expect(r.charges).toBe(300);   // 500 − 200 (charge NETTE)
    expect(r.resultat).toBe(700);  // 1000 − 300
  });

  it('ARRONDI : une écriture de centimes équilibrée affiche bien un équilibre de 0', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    rt.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-26', jal_code: 'OD', piece: 'CTS', libelle: 'Centimes' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '512000', debit: '0.10', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '512000', debit: '0.10', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '512000', debit: '0.10', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '707000', debit: '0', credit: '0.30' });
    expect(rt.visu('compta_ecr', ['3']).valeurs.equilibre).toBe(0); // pas 5.5e-17
  });

  it('BILAN par masses équilibré (actif = passif), robuste à TOUT compte', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const b = rt.visu('compta_bilan', ['1']).valeurs;
    expect(b.b_tiers).toBe(500);           // tiers nets classe 4 (1300 D − 800 C)
    expect(b.b_actif).toBe(500);
    expect(b.b_passif).toBe(500);          // capitaux 0 + résultat 500
    expect(b.b_actif).toBe(b.b_passif);    // le bilan est équilibré
    // robustesse : une écriture équilibrée touchant un compte de classe 4 HORS référentiel
    // (467000) + un immo — l'ancienne version « liste blanche » aurait déséquilibré le bilan.
    rt.sauvegarde('compta_ecr', [], { date_ecr: '2026-06-26', jal_code: 'OD', piece: 'OD-9', libelle: 'Divers' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '218000', debit: '700', credit: '0' });
    rt.sauvegarde('compta_lig', [], { ecr_id: '3', compte: '467000', debit: '0', credit: '700' });
    const b2 = rt.visu('compta_bilan', ['1']).valeurs;
    expect(b2.b_actif).toBe(b2.b_passif); // toujours équilibré, sans liste blanche de comptes
  });

  it('DÉCLARATION DE TVA : collectée − déductible = TVA à décaisser', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const t = rt.visu('compta_tva', ['1']).valeurs;
    expect(t.t_col).toBe(200);  // 445710 (ventes)
    expect(t.t_ded).toBe(100);  // 445660 (achats)
    expect(t.t_due).toBe(100);  // à décaisser
  });

  it('filtres de liste : grammaire complète (et/ou, >, =) honorée par les widgets-listes', () => {
    const { r4 } = construitCompta();
    const acces = new Runtime(r4, { user: ADMIN }).accesDonnees();
    // grand livre d'un compte (mono-condition) — comportement de base
    expect(acces.lignes!({ table: 'lig', filtre: 'compte = 707000' }).length).toBe(1);
    // OU : deux comptes
    expect(acces.lignes!({ table: 'lig', filtre: 'compte = 707000 ou compte = 607000' }).length).toBe(2);
    // opérateur > : seulement les lignes au débit (411=1200, 607=500, 445660=100)
    expect(acces.lignes!({ table: 'lig', filtre: 'debit > 0' }).length).toBe(3);
    // ET : combinaison
    expect(acces.lignes!({ table: 'lig', filtre: 'ecr_id = 1 et credit > 0' }).length).toBe(2);
    // filtre vide interpolé (clé absente) -> AUCUNE ligne (pas toute la table)
    expect(acces.lignes!({ table: 'lig', filtre: 'ecr_id = ' }).length).toBe(0);
  });

  it('FACTURE : TVA et TTC calculés ; règlement partiel → solde restant (lettrage)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const f1 = rt.visu('compta_fac', ['1']).valeurs; // vente 1000 HT, 20% TVA, réglée 600
    expect(f1.tva).toBe(200);
    expect(f1.ttc).toBe(1200);
    expect(f1.regle).toBe(600);
    expect(f1.solde).toBe(600);   // restant dû (non lettrée)
    const f2 = rt.visu('compta_fac', ['2']).valeurs; // achat 500 HT, non réglée
    expect(f2.ttc).toBe(600);
    expect(f2.solde).toBe(600);
  });

  it('FACTURE lettrée : un règlement du solde restant ramène le solde à 0', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    // on solde la facture 1 (restait 600)
    rt.sauvegarde('compta_reg', [], { fac_id: '1', date_reg: '2026-06-20', montant: '600', mode: 'cheque' });
    expect(rt.visu('compta_fac', ['1']).valeurs.regle).toBe(1200);
    expect(rt.visu('compta_fac', ['1']).valeurs.solde).toBe(0); // lettrée / soldée
  });

  it('nouvelle ligne (compte vide) : le champ classe ne lève PLUS d’erreur de formule', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const z = rt.edition('compta_lig', []); // formulaire « + Nouvelle ligne » (compte vide)
    const msgs = JSON.stringify(z.messages ?? []) + JSON.stringify(z.champs?.classe?.messerr ?? []);
    expect(msgs.toLowerCase()).not.toContain('formule'); // pas d'« Erreur dans la formule … classe »
    // une vraie ligne calcule correctement sa classe (même un sous-compte à 7 chiffres)
    const zz = rt.sauvegarde('compta_lig', [], { ecr_id: '1', compte: '6071000', debit: '5', credit: '0' }).zzz;
    expect(zz.valeurs.classe).toBe(6);
    // sous-compte à 9 chiffres : le 1er chiffre (7) est la classe — l'ancien calcul par
    // ln+epsilon retournait 0 (et excluait la ligne de TOUS les agrégats par classe).
    const z9 = rt.sauvegarde('compta_lig', [], { ecr_id: '1', compte: '799999999', debit: '5', credit: '0' }).zzz;
    expect(z9.valeurs.classe).toBe(7);
    // compte vide (transitoire) : pas d'erreur, classe neutre 0 (jamais de division par zéro)
    expect(rt.edition('compta_lig', []).valeurs.classe).toBe(0);
  });

  it('échéancier : les listes honorent le tri (tri=date_ech) et un filtre dynamique vide ne renvoie rien', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    // facture avec échéance ANTÉRIEURE, créée en dernier (fac n°3)
    rt.sauvegarde('compta_fac', [], { type: 'vente', trs_code: 'C001', numero: 'VTE-URGENTE', date_fac: '2026-06-10', date_ech: '2026-06-15', ht: '100', tva_taux: '20' });
    const acces = rt.accesDonnees();
    const parEcheance = acces.lignes!({ table: 'fac', tri: 'date_ech' });
    expect(parEcheance[0]!.date_ech).toBe('2026-06-15');   // la plus proche échéance d'abord
    expect(parEcheance[parEcheance.length - 1]!.date_ech).toBe('2026-07-05');
    // tri décroissant
    const desc = acces.lignes!({ table: 'fac', tri: 'date_ech desc' });
    expect(desc[0]!.date_ech).toBe('2026-07-05');
  });

  it('saisie multi-ligne : la grille injecte la clé + recopie date/journal de l’en-tête', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const html = renderEcran(rt.visu('compta_ecr', ['1']), { acces: rt.accesDonnees() });
    expect(html).toContain('editable-record-list');                 // grille éditable
    expect(html).toContain('md-ea-add');                            // bouton « + Ajouter une ligne »
    expect(html).toMatch(/value="1" data-name="ecr_id"/);           // FK injectée = clé du maître
    expect(html).toMatch(/value="2026-06-25" data-name="date_ecr"/);// date recopiée de l'en-tête
    expect(html).toMatch(/value="VE" data-name="jal_code"/);        // journal recopié de l'en-tête
    expect(html).toContain('<select name="jal_code"');             // journal en liste déroulante (en-tête)
  });

  it('grille désactivée tant que l’en-tête n’est pas enregistré (pas d’échec silencieux)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const html = renderEcran(rt.edition('compta_ecr', []), { acces: rt.accesDonnees() }); // écriture neuve (o=8)
    expect(html).toContain('editable-record-list'); // la table est là…
    expect(html).not.toContain('md-ea-add');        // …mais pas de bouton d'ajout (maître non enregistré)
    expect(html).toContain('Enregistrez d’abord l’en-tête');
  });

  it('boutons contextuels + listes déroulantes : compte (lookup), tiers/journal (dropdown)', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const lig = renderEcran(rt.edition('compta_lig', []), { acces: rt.accesDonnees() });
    expect(lig).toContain('class="querabilite-popup"');            // bouton contextuel de recherche
    expect(lig).toContain('data-table="cpt"');                     // ... sur le plan comptable
    expect(lig).toContain('<select name="jal_code"');             // journal déroulant
    const fac = renderEcran(rt.edition('compta_fac', []), { acces: rt.accesDonnees() });
    expect(fac).toContain('<select name="type"');                 // type vente/achat déroulant
  });

  it('états PDF : les listes (lignes, grand livre, journal) sont rendues dans le document', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    const acces = rt.accesDonnees();
    // écriture imprimable : ses lignes apparaissent en tableau, totaux recalculés
    const ecr = renderEcran(rt.visu('compta_ecriture_pdf', ['1'], 'let'), { mode: 'document', acces });
    expect(ecr).toContain('<table');     // tableau des lignes
    expect(ecr).toContain('707000');     // compte d'une ligne de l'écriture 1
    // grand livre d'un compte : ses mouvements + solde
    const gl = renderEcran(rt.visu('compta_grandlivre_pdf', ['707000'], 'let'), { mode: 'document', acces });
    expect(gl).toContain('Grand livre');
    expect(gl).toContain('-1000');       // solde du compte 707000 (recalculé)
    // journal général : toutes les lignes
    const jr = renderEcran(rt.visu('compta_journal_pdf', [], 'let'), { mode: 'document', acces });
    expect(jr).toContain('<table');
    // résultat imprimable : valeur calculée
    const re = renderEcran(rt.visu('compta_resultat_pdf', ['1'], 'let'), { mode: 'document', acces });
    expect(re).toContain('500');         // résultat net
  });

  it('le référentiel (plan comptable, journaux, tiers) est en place', () => {
    const { r4 } = construitCompta();
    const rt = new Runtime(r4, { user: ADMIN });
    expect(rt.chercheCles('cpt').length).toBe(14);
    expect(rt.chercheCles('jal').length).toBe(5);
    expect(rt.chercheCles('trs').length).toBe(2);
    expect(rt.rechercheComplete('cpt', 'Clients').length).toBeGreaterThan(0);
  });

  it('PERSISTANCE disque : plan comptable et écritures survivent au redémarrage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'compta-'));
    try {
      const a = construitCompta(dir);
      new Runtime(a.r4, { user: ADMIN }).sauvegarde('compta_cpt', [], { cpt_num: '512100', libelle: 'Banque 2', classe: '5' });
      const rt = new Runtime(construitCompta(dir).r4, { user: ADMIN });
      expect(rt.chercheCles('cpt')).toContain('512100');          // compte ajouté -> persisté
      expect(rt.visu('compta_ecr', ['1']).valeurs.equilibre).toBe(0); // écriture rechargée et recalculée
      expect(rt.chercheCles('jal').length).toBe(5);               // pas de re-seed
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

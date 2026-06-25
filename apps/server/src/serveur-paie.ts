/**
 * Lanceur « paie low-code » : démarre un serveur maides dont l'application de PAIE
 * (employeurs, salariés, rubriques, bulletins calculés) est montée UNIQUEMENT par
 * des données via les éditeurs du constructeur, puis exécutée par le runtime.
 *
 * Lancer :  npm run start:paie -w @maides/server
 *           (ou : npx tsx apps/server/src/serveur-paie.ts)
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MemoryUserStore } from '@maides/core';
import { MaidesApp } from './app.js';
import { demarrer } from './http.js';
import { construitPaie } from './paie.js';

// Données PERSISTÉES sur disque (survivent aux redémarrages).
const dossierData = process.env.PAIE_DATA ?? fileURLToPath(new URL('../paie-data', import.meta.url));
const { r4, params, menuEntries } = construitPaie(dossierData);

const userStore = new MemoryUserStore();
userStore.creer('admin', 'admin', { super_admin: 'O', niveau: 0 });
userStore.creer('gestionnaire', 'gestionnaire', { super_admin: 'N', niveau: 5 }); // ne voit pas le coût employeur

const app = new MaidesApp(r4, { titre: 'Paie — Maxima', userStore, menuEntries, designerStore: params });

const port = Number(process.env.PORT ?? 3000);
const spaDir = fileURLToPath(new URL('../../web/dist', import.meta.url));
const publicDir = fileURLToPath(new URL('./public', import.meta.url));
demarrer(app, port, { publicDir, ...(existsSync(spaDir) ? { spaDir } : {}) });

const ln = (s: string) => process.stdout.write(s + '\n');
ln('');
ln('  ============================================================');
ln('   PAIE LOW-CODE — prête à tester');
ln(`   Ouvre :  http://localhost:${port}/        (login: admin / admin)`);
ln('   Essaie :  Menu > Nouveau bulletin > Salarié n°=1, Période=202406,');
ln('             Salaire de base=3000 > Enregistrer');
ln('             => brut, cotisations salariales/patronales, net à payer,');
ln('                net imposable et coût employeur se calculent tout seuls.');
ln('   Bulletin PDF :  Menu > Bulletin n°1 — PDF.');
ln('   Gestionnaire (coût employeur masqué) :  login gestionnaire / gestionnaire.');
ln('   Designer low-code :  Menu > Designer (tables, écrans, formules, rubriques).');
ln(`   Données persistées dans :  ${dossierData}`);
ln('  ============================================================');

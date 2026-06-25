/**
 * Lanceur « comptabilité low-code » : démarre un serveur Maxima dont l'application
 * de COMPTABILITÉ (journaux, plan comptable, tiers, écritures, balance, résultat)
 * est montée UNIQUEMENT par des données via les éditeurs du constructeur.
 *
 * Lancer :  npm run start:compta -w @maides/server
 *           (ou : npx tsx apps/server/src/serveur-compta.ts)
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MemoryUserStore } from '@maides/core';
import { MaidesApp } from './app.js';
import { demarrer } from './http.js';
import { construitCompta } from './compta.js';

// Données PERSISTÉES sur disque (survivent aux redémarrages).
const dossierData = process.env.COMPTA_DATA ?? fileURLToPath(new URL('../compta-data', import.meta.url));
const { r4, params, menuEntries } = construitCompta(dossierData);

const userStore = new MemoryUserStore();
userStore.creer('admin', 'admin', { super_admin: 'O', niveau: 0 });
userStore.creer('comptable', 'comptable', { super_admin: 'N', niveau: 5 });

const app = new MaidesApp(r4, { titre: 'Comptabilité — Maxima', userStore, menuEntries, designerStore: params });

const port = Number(process.env.PORT ?? 3000);
const spaDir = fileURLToPath(new URL('../../web/dist', import.meta.url));
const publicDir = fileURLToPath(new URL('./public', import.meta.url));
demarrer(app, port, { publicDir, ...(existsSync(spaDir) ? { spaDir } : {}) });

const ln = (s: string) => process.stdout.write(s + '\n');
ln('');
ln('  ============================================================');
ln('   COMPTABILITÉ LOW-CODE (Maxima) — prête à tester');
ln(`   Ouvre :  http://localhost:${port}/        (login: admin / admin)`);
ln('   Menu > Écritures > Nouvelle écriture (date, journal), puis');
ln('          Journal général > Nouvelle ligne (compte, débit/crédit) ;');
ln('          rouvre l’écriture : Σ débit, Σ crédit et l’équilibre se calculent.');
ln('   Plan comptable / Balance : cliquer un compte affiche son solde.');
ln('   Résultat : produits (classe 7) − charges (classe 6).');
ln(`   Données persistées dans :  ${dossierData}`);
ln('  ============================================================');

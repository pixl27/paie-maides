/**
 * Lanceur « assurance low-code » : démarre un serveur maides dont l'application
 * d'assurance (tiers, quittance calculée, renouvellement bonus-malus) est montée
 * UNIQUEMENT par des données via les éditeurs du constructeur — puis exécutée par
 * le runtime générique. Login admin / admin.
 *
 * L'application elle-même vit dans `./assurance/` (un module par responsabilité,
 * écrans par domaine) ; ce fichier n'est que le lanceur HTTP.
 *
 * Lancer :  npm run start:assurance -w @maides/server
 *           (ou : npx tsx apps/server/src/serveur-assurance.ts)
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MemoryUserStore } from '@maides/core';
import { MaidesApp } from './app.js';
import { demarrer } from './http.js';
import { construitAssurance } from './assurance/index.js';

const { r4, params, menuEntries } = construitAssurance();

const userStore = new MemoryUserStore();
userStore.creer('admin', 'admin', { super_admin: 'O', niveau: 0 });
userStore.creer('agent', 'agent', { super_admin: 'N', niveau: 5 }); // voit tout sauf la commission

const app = new MaidesApp(r4, { titre: 'Assurance — Maxima', userStore, menuEntries, designerStore: params });

const port = Number(process.env.PORT ?? 3000);
const spaDir = fileURLToPath(new URL('../../web/dist', import.meta.url));
const publicDir = fileURLToPath(new URL('./public', import.meta.url));
demarrer(app, port, { publicDir, ...(existsSync(spaDir) ? { spaDir } : {}) });

const ln = (s: string) => process.stdout.write(s + '\n');
ln('');
ln('  ============================================================');
ln('   ASSURANCE LOW-CODE — prête à tester');
ln(`   Ouvre :  http://localhost:${port}/        (login: admin / admin)`);
ln('   Essaie :  Menu > Nouvelle quittance > saisis Base=1000, Prorata=0.5,');
ln('             Bonus=950, Code taxe=AUTO, Taux commission=10 > Enregistrer');
ln('             => Prime nette/Taxe/TTC/Commission se calculent tout seuls.');
ln('   Agent (admin caché) :  login agent / agent  => la Commission est masquée.');
ln('   Designer low-code :  Menu > Designer (tables, écrans, formules, droits).');
ln('  ============================================================');

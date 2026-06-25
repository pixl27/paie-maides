/** Point d'entrée : démarre le serveur de démonstration. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creerAppDemo } from './demo.js';
import { demarrer } from './http.js';

const port = Number(process.env.PORT ?? 3000);

// Sert le front SPA (apps/web/dist) sous /app s'il a été construit.
const spaDir = fileURLToPath(new URL('../../web/dist', import.meta.url));
// Sert les assets publics (client JS interactif) à la racine.
const publicDir = fileURLToPath(new URL('./public', import.meta.url));
const options = { publicDir, ...(existsSync(spaDir) ? { spaDir } : {}) };

demarrer(creerAppDemo(), port, options);
if (options.spaDir) {

  console.log(`Maxima SPA: http://localhost:${port}/app`);
}

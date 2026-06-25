/** Adaptateur HTTP (Node http natif) : cookies, sessions, et appel à MaidesApp. */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import type { UserInfo } from '@maides/core';
import { MaidesApp, type RequeteMaides } from './app.js';
import { parseForm } from './page.js';

const COOKIE = 'maides_sess';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json',
  '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

/** Sert un fichier statique du build SPA (avec repli SPA sur index.html). */
function serviStatique(spaDir: string, sousChemin: string, res: ServerResponse): boolean {
  const rel = normalize(sousChemin).replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '');
  let fichier = join(spaDir, rel);
  if (!existsSync(fichier) || !statSync(fichier).isFile()) {
    fichier = join(spaDir, 'index.html'); // routage SPA côté client
    if (!existsSync(fichier)) return false;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(fichier)] ?? 'application/octet-stream' });
  res.end(readFileSync(fichier));
  return true;
}

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}

function parseCookies(entete: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (entete ?? '').split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.trim()] = decodeURIComponent(v.trim());
  }
  return out;
}

export function demarrer(app: MaidesApp, port = 3000, options: { spaDir?: string; publicDir?: string } = {}): ReturnType<typeof createServer> {
  const sessions = new Map<string, UserInfo>();
  const etatsSession = new Map<string, Record<string, unknown>>(); // état par session (pile de navigation…)

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    let pathname = url.pathname;
    const method = (req.method ?? 'GET').toUpperCase() as 'GET' | 'POST';

    // SPA : sert le build sous /app (même origine que l'API => cookies/sessions OK)
    if (options.spaDir && (pathname === '/app' || pathname.startsWith('/app/'))) {
      const sous = pathname === '/app' ? 'index.html' : pathname.slice('/app/'.length);
      if (serviStatique(options.spaDir, sous, res)) return;
    }

    // Assets publics (client JS, etc.) servis tels quels, sans authentification.
    if (options.publicDir && method === 'GET' && extname(pathname) && !pathname.startsWith('/api')) {
      const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
      const fichier = join(options.publicDir, rel);
      if (existsSync(fichier) && statSync(fichier).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[extname(fichier)] ?? 'application/octet-stream' });
        res.end(readFileSync(fichier));
        return;
      }
    }

    // API SPA : préfixe /api/<route> => mêmes handlers, réponse JSON forcée
    const estApi = pathname.startsWith('/api/') || pathname === '/api';
    if (estApi) pathname = pathname.replace(/^\/api\/?/, '/');

    const ecran = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    const query = Object.fromEntries(url.searchParams.entries());

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE];
    const user = token ? sessions.get(token) ?? null : null;

    const accept = String(req.headers.accept ?? '');
    const format: 'html' | 'json' = estApi || query.format === 'json' || accept.includes('application/json') ? 'json' : 'html';
    const ajax = String(req.headers['x-maides-ajax'] ?? '') === '1';

    // Sac d'état persistant par session (pile de navigation -1/-2/-3, etc.)
    let etat = token ? etatsSession.get(token) : undefined;
    if (token && !etat) { etat = {}; etatsSession.set(token, etat); }
    const requete: RequeteMaides = { method, ecran, query, user, format, ajax, etatSession: etat ?? {} };
    if (method === 'POST') {
      const corps = await lireCorps(req);
      requete.body = (req.headers['content-type'] ?? '').includes('application/json')
        ? JSON.parse(corps || '{}')
        : parseForm(corps);
    }

    const reponse = app.handle(requete);

    const headers: Record<string, string> = { 'Content-Type': reponse.contentType, ...(reponse.headers ?? {}) };
    if (reponse.session?.action === 'set' && reponse.session.user) {
      const nouveau = randomBytes(24).toString('hex');
      sessions.set(nouveau, reponse.session.user);
      headers['Set-Cookie'] = `${COOKIE}=${nouveau}; HttpOnly; Path=/; SameSite=Lax`;
    } else if (reponse.session?.action === 'clear') {
      if (token) { sessions.delete(token); etatsSession.delete(token); }
      headers['Set-Cookie'] = `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`;
    }

    res.writeHead(reponse.status, headers);
    res.end(reponse.bodyBinaire ?? reponse.body);
  });

  // Message clair si le port est déjà pris (au lieu d'une stack trace cryptique
  // pour un utilisateur non technicien : autre fenêtre déjà ouverte, etc.).
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n[!] Le port ${port} est déjà utilisé (l'application est probablement déjà ouverte dans une autre fenêtre).`);
      console.error(`    Fermez l'autre fenêtre, ou démarrez sur un autre port : définissez la variable PORT (ex. PORT=3001).\n`);
      process.exit(1);
    }
    throw e;
  });

  server.listen(port, () => {

    console.log(`Maxima server: http://localhost:${port}/  (login: admin / admin)`);
  });
  return server;
}
